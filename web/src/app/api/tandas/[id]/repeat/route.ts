import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, errorResponse, isUniqueViolation } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import { bloqueoVigente, calcEndDate, generateInviteCode } from "@/lib/tanda";
import { activarTanda } from "@/lib/tanda-periodo";

/**
 * POST — repite una tanda completada con los mismos participantes (excepto
 * expulsados o bloqueados) y el orden de turnos invertido. Como todos los
 * lugares quedan ocupados, la tanda nueva se activa de inmediato.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const { id: tandaId } = await params;
    const { fecha_inicio } = await req.json();

    const startDate = new Date(fecha_inicio);
    if (!fecha_inicio || Number.isNaN(startDate.getTime())) {
      throw new AppError("fecha_inicio es obligatoria y debe ser una fecha válida");
    }

    const oldTanda = await prisma.tanda.findUnique({
      where: { id: tandaId },
      include: {
        turnos: {
          orderBy: { numero_turno: "asc" },
          include: { participante: { select: { blocked_tandas: true, block_undate: true } } },
        },
      },
    });

    if (!oldTanda) {
      throw new AppError("Tanda no encontrada", 404);
    }
    if (oldTanda.organizador_id !== userId) {
      throw new AppError("Solo el organizador puede repetir la tanda", 403);
    }
    if (oldTanda.estado !== "completada") {
      throw new AppError("Solo se pueden repetir tandas completadas");
    }

    const ahora = new Date();
    const participantes = oldTanda.turnos.filter(
      (t) => t.estado_turno !== "expulsado" && !bloqueoVigente(t.participante, ahora)
    );
    if (!participantes.some((t) => t.participante_id === userId)) {
      throw new AppError("No puedes repetir la tanda mientras tu cuenta esté bloqueada", 403);
    }
    if (participantes.length < 2) {
      throw new AppError("Se necesitan al menos 2 participantes activos para repetir la tanda");
    }

    const numPart = participantes.length;
    const montoPremio = Number(oldTanda.monto_aportacion) * numPart;
    const fechaFin = calcEndDate(startDate, oldTanda.frecuencia, numPart);
    // Invert: turn 1 → last, turn 2 → second-to-last, etc. (created in new turn order)
    const rotados = [...participantes].reverse();

    for (let intento = 0; ; intento++) {
      const codigo = generateInviteCode();
      try {
        const newTanda = await prisma.$transaction(
          async (tx) => {
            const nueva = await tx.tanda.create({
              data: {
                nombre: `${oldTanda.nombre} 2`,
                organizador_id: userId,
                monto_aportacion: oldTanda.monto_aportacion,
                frecuencia: oldTanda.frecuencia,
                num_participantes: numPart,
                fecha_inicio: startDate,
                fecha_fin: fechaFin,
                estado: "pendiente",
                codigo_invitacion: codigo,
                periodo_actual: 0,
              },
            });

            for (const [i, oldTurno] of rotados.entries()) {
              await tx.turno.create({
                data: {
                  tanda_id: nueva.id,
                  participante_id: oldTurno.participante_id,
                  numero_turno: i + 1,
                  monto_premio: montoPremio,
                },
              });
            }

            await activarTanda(tx, nueva.id, ahora);
            return tx.tanda.findUniqueOrThrow({ where: { id: nueva.id } });
          },
          { timeout: 20_000 }
        );

        return NextResponse.json({
          tandaId: newTanda.id,
          codigoInvitacion: codigo,
          nombre: newTanda.nombre,
          fechaInicio: newTanda.fecha_inicio,
          fechaFin: newTanda.fecha_fin,
          participantes: numPart,
          turnosRotados: true,
          estado: newTanda.estado,
        });
      } catch (e) {
        if (isUniqueViolation(e) && intento < 4) continue;
        throw e;
      }
    }
  } catch (e) {
    return errorResponse("Repeat tanda", e);
  }
}
