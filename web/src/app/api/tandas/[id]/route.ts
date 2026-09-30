import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { isPlaceholderPhone } from "@/lib/phone-placeholder";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import { assertMiembroDeTanda } from "@/lib/tanda-acceso";
import { trustlessWorkConfigured } from "@/lib/tanda-escrow";
import { isTandaPayVisualOnly } from "@/lib/tanda-pay-visual";

function nombreVisible(user: { name: string | null; phone: string | null }): string {
  return user.name || (isPlaceholderPhone(user.phone) ? null : user.phone) || "Participante";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const { id: tandaId } = await params;
    await assertMiembroDeTanda(tandaId, userId);

    const tanda = await prisma.tanda.findUniqueOrThrow({
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

    // Build participant status summary
    const participants = tanda.turnos.map((turno) => {
      const currentPago = tanda.pagos.find(
        (p) =>
          p.pagador_id === turno.participante_id &&
          p.periodo === tanda.periodo_actual
      );
      return {
        userId: turno.participante_id,
        name: nombreVisible(turno.participante),
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
              fechaVencimiento: currentPago.fecha_vencimiento,
              fechaPago:
                currentPago.estado === "pagado" ? currentPago.fecha_pago : null,
            }
          : null,
      };
    });

    // Payment history for all periods (las aportaciones canceladas no cuentan)
    const periodos = [];
    for (let p = 1; p <= tanda.num_participantes; p++) {
      const pagosPeriodo = tanda.pagos.filter(
        (pg) => pg.periodo === p && pg.estado !== "cancelado"
      );
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

    return NextResponse.json({
      id: tanda.id,
      nombre: tanda.nombre,
      organizadorId: tanda.organizador_id,
      organizador: {
        id: tanda.organizador.id,
        name: nombreVisible(tanda.organizador),
      },
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
      // El deploy del organizador lo hace el servidor (/escrow-deploy).
      trustlessClientReady: trustlessEscrowEnabled,
      payVisualOnly: isTandaPayVisualOnly(),
    });
  } catch (e) {
    return errorResponse("Get tanda", e);
  }
}
