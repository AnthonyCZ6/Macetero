import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInviteCode, calcEndDate } from "@/lib/tanda";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tandaId } = await params;
    const { userId, fecha_inicio } = await req.json();

    if (!userId || !fecha_inicio) {
      return NextResponse.json(
        { error: "userId and fecha_inicio are required" },
        { status: 400 }
      );
    }

    const oldTanda = await prisma.tanda.findUnique({
      where: { id: tandaId },
      include: {
        turnos: { orderBy: { numero_turno: "asc" } },
      },
    });

    if (!oldTanda) {
      return NextResponse.json({ error: "Tanda not found" }, { status: 404 });
    }

    if (oldTanda.estado !== "completada") {
      return NextResponse.json(
        { error: "Can only repeat completed tandas" },
        { status: 400 }
      );
    }

    if (oldTanda.organizador_id !== userId) {
      return NextResponse.json(
        { error: "Only the organizer can repeat a tanda" },
        { status: 403 }
      );
    }

    const startDate = new Date(fecha_inicio);
    const codigo = generateInviteCode();
    const fechaFin = calcEndDate(
      startDate,
      oldTanda.frecuencia,
      oldTanda.num_participantes
    );

    const newTanda = await prisma.tanda.create({
      data: {
        nombre: `${oldTanda.nombre} 2`,
        organizador_id: userId,
        monto_aportacion: oldTanda.monto_aportacion,
        frecuencia: oldTanda.frecuencia,
        num_participantes: oldTanda.num_participantes,
        fecha_inicio: startDate,
        fecha_fin: fechaFin,
        estado: "pendiente",
        codigo_invitacion: codigo,
        periodo_actual: 0,
      },
    });

    // Rotate turns: who received first now receives last
    const numPart = oldTanda.turnos.length;
    const montoPremio =
      Number(oldTanda.monto_aportacion) * oldTanda.num_participantes;

    for (const oldTurno of oldTanda.turnos) {
      // Invert: turn 1 → last, turn 2 → second-to-last, etc.
      const rotatedTurn = numPart - oldTurno.numero_turno + 1;

      await prisma.turno.create({
        data: {
          tanda_id: newTanda.id,
          participante_id: oldTurno.participante_id,
          numero_turno: rotatedTurn,
          monto_premio: montoPremio,
        },
      });
    }

    return NextResponse.json({
      tandaId: newTanda.id,
      codigoInvitacion: codigo,
      nombre: newTanda.nombre,
      fechaInicio: startDate,
      fechaFin: fechaFin,
      participantes: numPart,
      turnosRotados: true,
    });
  } catch (e) {
    console.error("Repeat tanda error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
