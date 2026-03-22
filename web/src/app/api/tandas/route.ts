import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInviteCode, calcEndDate } from "@/lib/tanda";
import { maxTandasForLevel, maxTandasExceededMessage } from "@/lib/tanda-limits";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

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
    console.error("List tandas error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, nombre, monto_aportacion, frecuencia, num_participantes, fecha_inicio } =
      await req.json();

    if (!userId || !nombre || !monto_aportacion || !num_participantes || !fecha_inicio) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const freq = frecuencia || "semanal";
    const monto = parseFloat(monto_aportacion);
    const numPart = parseInt(num_participantes);
    const startDate = new Date(fecha_inicio);

    if (monto <= 0 || numPart < 2) {
      return NextResponse.json({ error: "Invalid monto or participants" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rule 6: organizer must have at least the first payment amount
    // (simplified: just check user exists and has wallet)
    if (!user.wallet) {
      return NextResponse.json(
        { error: "You need a wallet to create a tanda" },
        { status: 400 }
      );
    }

    // Rule 7: check max simultaneous tandas by level
    const activeTandas = await prisma.turno.count({
      where: {
        participante_id: userId,
        tanda: { estado: { in: ["pendiente", "activa"] } },
      },
    });

    const maxAllowed = maxTandasForLevel(user.level);
    if (activeTandas >= maxAllowed) {
      return NextResponse.json(
        { error: maxTandasExceededMessage(user.level) },
        { status: 400 }
      );
    }

    // Rule 1: cannot create if has overdue payments > 3 days
    if (user.blocked_tandas) {
      return NextResponse.json(
        { error: "Cannot create tandas while blocked" },
        { status: 400 }
      );
    }

    const codigo = generateInviteCode();
    const fechaFin = calcEndDate(startDate, freq, numPart);
    const montoPremio = monto * numPart;

    const tanda = await prisma.tanda.create({
      data: {
        nombre,
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
    await prisma.turno.create({
      data: {
        tanda_id: tanda.id,
        participante_id: userId,
        numero_turno: 1,
        monto_premio: montoPremio,
      },
    });

    return NextResponse.json({
      tandaId: tanda.id,
      codigoInvitacion: codigo,
      turnoAsignado: 1,
      montoPremio,
      fechaInicio: startDate,
      fechaFin: fechaFin,
    });
  } catch (e) {
    console.error("Create tanda error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
