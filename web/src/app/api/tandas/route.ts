import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, errorResponse, isUniqueViolation } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import {
  FRECUENCIAS,
  bloqueoVigente,
  calcEndDate,
  generateInviteCode,
} from "@/lib/tanda";
import { maxTandasForLevel, maxTandasExceededMessage } from "@/lib/tanda-limits";
import { simulateEscrowOnCreate } from "@/lib/tanda-simulate-escrow";

const MAX_PARTICIPANTES = 50;

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const turnos = await prisma.turno.findMany({
      where: { participante_id: userId },
      include: {
        tanda: {
          select: {
            id: true,
            nombre: true,
            monto_aportacion: true,
            frecuencia: true,
            num_participantes: true,
            estado: true,
            periodo_actual: true,
            fecha_inicio: true,
            fecha_fin: true,
            createdAt: true,
          },
        },
      },
      orderBy: { tanda: { createdAt: "desc" } },
    });

    const tandaIds = [...new Set(turnos.map((t) => t.tanda.id))];
    const recaudadoRows =
      tandaIds.length > 0
        ? await prisma.pago.groupBy({
            by: ["tanda_id"],
            where: {
              tanda_id: { in: tandaIds },
              estado: "pagado",
            },
            _sum: { monto_total: true },
          })
        : [];
    const recaudadoByTanda = new Map(
      recaudadoRows.map((r) => [
        r.tanda_id,
        Number(r._sum.monto_total ?? 0),
      ])
    );

    const inscritosRows =
      tandaIds.length > 0
        ? await prisma.turno.groupBy({
            by: ["tanda_id"],
            where: { tanda_id: { in: tandaIds } },
            _count: { id: true },
          })
        : [];
    const inscritosByTanda = new Map(
      inscritosRows.map((r) => [r.tanda_id, r._count.id])
    );

    const tandas = turnos.map((t) => ({
      id: t.tanda.id,
      nombre: t.tanda.nombre,
      montoAportacion: Number(t.tanda.monto_aportacion),
      frecuencia: t.tanda.frecuencia,
      numParticipantes: t.tanda.num_participantes,
      estado: t.tanda.estado,
      periodoActual: t.tanda.periodo_actual,
      fechaInicio: t.tanda.fecha_inicio,
      fechaFin: t.tanda.fecha_fin,
      miTurno: t.numero_turno,
      montoPremio: Number(t.tanda.monto_aportacion) * t.tanda.num_participantes,
      recaudado: recaudadoByTanda.get(t.tanda.id) ?? 0,
      participantesInscritos: inscritosByTanda.get(t.tanda.id) ?? 0,
    }));

    return NextResponse.json({ tandas });
  } catch (e) {
    return errorResponse("List tandas", e);
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const { nombre, monto_aportacion, frecuencia, num_participantes, fecha_inicio } =
      await req.json();

    const nombreLimpio = typeof nombre === "string" ? nombre.trim().slice(0, 80) : "";
    const freq = frecuencia || "semanal";
    const monto = parseFloat(monto_aportacion);
    const numPart = Number(num_participantes);
    const startDate = new Date(fecha_inicio);

    if (!nombreLimpio || !fecha_inicio) {
      throw new AppError("Faltan campos obligatorios");
    }
    if (!(FRECUENCIAS as readonly string[]).includes(freq)) {
      throw new AppError("La frecuencia debe ser semanal, quincenal o mensual");
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new AppError("El monto de aportación debe ser mayor a 0");
    }
    if (!Number.isInteger(numPart) || numPart < 2 || numPart > MAX_PARTICIPANTES) {
      throw new AppError(`El número de participantes debe estar entre 2 y ${MAX_PARTICIPANTES}`);
    }
    if (Number.isNaN(startDate.getTime())) {
      throw new AppError("La fecha de inicio no es válida");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rule 1: no puede crear mientras esté bloqueado (el bloqueo vence solo)
    if (bloqueoVigente(user)) {
      throw new AppError("No puedes crear tandas mientras tu cuenta esté bloqueada", 403);
    }

    // Rule 6: organizer must have at least the first payment amount
    // (simplified: just check user exists and has wallet)
    if (!user.wallet) {
      throw new AppError("Necesitas una wallet para crear una tanda");
    }

    // Rule 7: check max simultaneous tandas by level
    const activeTandas = await prisma.turno.count({
      where: {
        participante_id: userId,
        estado_turno: { not: "expulsado" },
        tanda: { estado: { in: ["pendiente", "activa"] } },
      },
    });

    const maxAllowed = maxTandasForLevel(user.level);
    if (activeTandas >= maxAllowed) {
      throw new AppError(maxTandasExceededMessage(user.level));
    }

    const fechaFin = calcEndDate(startDate, freq, numPart);
    const montoPremio = monto * numPart;

    // El código de invitación es corto: si choca con uno existente, se genera otro.
    for (let intento = 0; ; intento++) {
      const codigo = generateInviteCode();
      try {
        const { tanda, simulatedEscrow } = await prisma.$transaction(async (tx) => {
          const tanda = await tx.tanda.create({
            data: {
              nombre: nombreLimpio,
              organizador_id: userId,
              monto_aportacion: monto,
              frecuencia: freq,
              num_participantes: numPart,
              fecha_inicio: startDate,
              fecha_fin: fechaFin,
              estado: "pendiente",
              codigo_invitacion: codigo,
              periodo_actual: 0,
            },
          });

          // Assign organizer as turn 1
          await tx.turno.create({
            data: {
              tanda_id: tanda.id,
              participante_id: userId,
              numero_turno: 1,
              monto_premio: montoPremio,
            },
          });

          let simulatedEscrow = false;
          if (simulateEscrowOnCreate()) {
            const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
            await tx.tandaEscrow.create({
              data: {
                tanda_id: tanda.id,
                periodo: 1,
                contract_id: `SIM_${tanda.id.replace(/-/g, "").slice(0, 12)}_${suffix}`,
                engagement_id: `sim-create-${tanda.id.slice(0, 8)}-${suffix}`,
                estado: "deployed",
              },
            });
            simulatedEscrow = true;
          }
          return { tanda, simulatedEscrow };
        });

        return NextResponse.json({
          tandaId: tanda.id,
          codigoInvitacion: codigo,
          turnoAsignado: 1,
          montoPremio,
          fechaInicio: startDate,
          fechaFin: fechaFin,
          simulatedEscrow,
        });
      } catch (e) {
        if (isUniqueViolation(e) && intento < 4) continue;
        throw e;
      }
    }
  } catch (e) {
    return errorResponse("Create tanda", e);
  }
}
