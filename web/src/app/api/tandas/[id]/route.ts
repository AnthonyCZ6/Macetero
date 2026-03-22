import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trustlessWorkConfigured } from "@/lib/tanda-escrow";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tandaId } = await params;

    const tanda = await prisma.tanda.findUnique({
      where: { id: tandaId },
      include: {
        organizador: { select: { id: true, name: true, phone: true } },
        turnos: {
          orderBy: { numero_turno: "asc" },
          include: {
            participante: { select: { id: true, name: true, phone: true } },
          },
        },
        pagos: {
          orderBy: [{ periodo: "asc" }, { pagador_id: "asc" }],
        },
        escrows: {
          orderBy: { periodo: "desc" },
          select: {
            periodo: true,
            contract_id: true,
            engagement_id: true,
            estado: true,
          },
        },
      },
    });

    if (!tanda) {
      return NextResponse.json({ error: "Tanda not found" }, { status: 404 });
    }

    // Build participant status summary
    const participants = tanda.turnos.map((turno) => {
      const currentPago = tanda.pagos.find(
        (p) =>
          p.pagador_id === turno.participante_id &&
          p.periodo === tanda.periodo_actual
      );
      return {
        userId: turno.participante_id,
        name: turno.participante.name || turno.participante.phone,
        turno: turno.numero_turno,
        estadoTurno: turno.estado_turno,
        fechaCobro: turno.fecha_cobro,
        premioEntregado: turno.premio_entregado,
        pagoActual: currentPago
          ? {
              estado: currentPago.estado,
              montoTotal: Number(currentPago.monto_total),
              cargoRetraso: Number(currentPago.cargo_retraso),
              diasRetraso: currentPago.dias_retraso,
              fechaPago: currentPago.fecha_pago,
            }
          : null,
      };
    });

    // Payment history for all periods
    const periodos = [];
    for (let p = 1; p <= tanda.num_participantes; p++) {
      const pagosPeriodo = tanda.pagos.filter((pg) => pg.periodo === p);
      periodos.push({
        periodo: p,
        pagados: pagosPeriodo.filter((pg) => pg.estado === "pagado").length,
        total: pagosPeriodo.length,
        completo: pagosPeriodo.every((pg) => pg.estado === "pagado"),
      });
    }

    const escrows = tanda.escrows.map((e) => ({
      periodo: e.periodo,
      contractId: e.contract_id,
      engagementId: e.engagement_id,
      estado: e.estado,
    }));

    const trustlessEscrowEnabled = trustlessWorkConfigured();
    const trustlessClientReady = Boolean(
      process.env.NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY?.trim()
    );

    return NextResponse.json({
      id: tanda.id,
      nombre: tanda.nombre,
      organizadorId: tanda.organizador_id,
      organizador: tanda.organizador,
      montoAportacion: Number(tanda.monto_aportacion),
      frecuencia: tanda.frecuencia,
      numParticipantes: tanda.num_participantes,
      fechaInicio: tanda.fecha_inicio,
      fechaFin: tanda.fecha_fin,
      estado: tanda.estado,
      periodoActual: tanda.periodo_actual,
      codigoInvitacion: tanda.codigo_invitacion,
      montoPremio: Number(tanda.monto_aportacion) * tanda.num_participantes,
      participants,
      periodos,
      escrows,
      trustlessEscrowEnabled,
      trustlessClientReady,
    });
  } catch (e) {
    console.error("Get tanda error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
