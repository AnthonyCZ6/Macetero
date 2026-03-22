import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcDueDate } from "@/lib/tanda";
import { maxTandasForLevel, maxTandasExceededMessage } from "@/lib/tanda-limits";

export async function POST(req: NextRequest) {
  try {
    const { userId, codigo } = await req.json();

    if (!userId || !codigo) {
      return NextResponse.json({ error: "userId and codigo are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.kyc_status !== "approved" && user.kyc_status !== "not_started") {
      // In sandbox we allow not_started; production would require approved
    }

    if (user.blocked_tandas) {
      return NextResponse.json(
        { error: "Cannot join tandas while blocked" },
        { status: 400 }
      );
    }

    // Check max tandas by level
    const activeTandas = await prisma.turno.count({
      where: {
        participante_id: userId,
        tanda: { estado: { in: ["pendiente", "activa"] } },
      },
    });
    if (activeTandas >= maxTandasForLevel(user.level)) {
      return NextResponse.json(
        { error: maxTandasExceededMessage(user.level) },
        { status: 400 }
      );
    }

    const tanda = await prisma.tanda.findUnique({
      where: { codigo_invitacion: codigo },
      include: { turnos: { orderBy: { numero_turno: "asc" } } },
    });

    if (!tanda) {
      return NextResponse.json({ error: "Tanda not found" }, { status: 404 });
    }

    if (tanda.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Tanda is no longer accepting participants" },
        { status: 400 }
      );
    }

    // Check if already in this tanda
    const alreadyIn = tanda.turnos.some((t) => t.participante_id === userId);
    if (alreadyIn) {
      return NextResponse.json({ error: "Already in this tanda" }, { status: 409 });
    }

    // Check if there are slots available
    if (tanda.turnos.length >= tanda.num_participantes) {
      return NextResponse.json({ error: "Tanda is full" }, { status: 400 });
    }

    const nextTurnNumber = tanda.turnos.length + 1;
    const montoPremio =
      Number(tanda.monto_aportacion) * tanda.num_participantes;

    // Assign the next turn
    await prisma.turno.create({
      data: {
        tanda_id: tanda.id,
        participante_id: userId,
        numero_turno: nextTurnNumber,
        monto_premio: montoPremio,
      },
    });

    const nowFull = nextTurnNumber === tanda.num_participantes;

    if (nowFull) {
      // Auto-activate the tanda and create all Pago records
      await prisma.tanda.update({
        where: { id: tanda.id },
        data: { estado: "activa", periodo_actual: 1 },
      });

      // Fetch all participants
      const allTurnos = await prisma.turno.findMany({
        where: { tanda_id: tanda.id },
        orderBy: { numero_turno: "asc" },
      });

      // Set fecha_cobro on each turno
      for (const turno of allTurnos) {
        const fechaCobro = calcDueDate(
          tanda.fecha_inicio,
          tanda.frecuencia,
          turno.numero_turno
        );
        await prisma.turno.update({
          where: { id: turno.id },
          data: { fecha_cobro: fechaCobro },
        });
      }

      // Create Pago records for every participant for every period
      const pagos = [];
      for (let periodo = 1; periodo <= tanda.num_participantes; periodo++) {
        const dueDate = calcDueDate(tanda.fecha_inicio, tanda.frecuencia, periodo);
        for (const turno of allTurnos) {
          pagos.push({
            tanda_id: tanda.id,
            pagador_id: turno.participante_id,
            periodo,
            monto_base: Number(tanda.monto_aportacion),
            monto_total: Number(tanda.monto_aportacion),
            fecha_vencimiento: dueDate,
            estado: "pendiente",
          });
        }
      }

      await prisma.pago.createMany({ data: pagos });
    }

    return NextResponse.json({
      tandaId: tanda.id,
      turnoAsignado: nextTurnNumber,
      montoPremio,
      tandaFull: nowFull,
      estado: nowFull ? "activa" : "pendiente",
      participantes: nextTurnNumber,
      totalParticipantes: tanda.num_participantes,
    });
  } catch (e) {
    console.error("Join tanda error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
