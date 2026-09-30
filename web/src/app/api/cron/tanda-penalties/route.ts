import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/cron-auth";
import { diasEntre, sumarDias } from "@/lib/fechas";
import {
  BLOCK_DAYS,
  PAGO_ESTADOS_ABIERTOS,
  PAGO_ESTADOS_SALDADOS,
  POINTS_EXPULSION,
  POINTS_LATE_PENALTY,
} from "@/lib/tanda";
import { planearRetraso, reordenarAlFinal } from "@/lib/tanda-penalties";
import { cerrarPeriodoSiCompleto } from "@/lib/tanda-periodo";

/** El cierre de periodos puede liberar escrows en cadena. */
export const maxDuration = 300;

type Accion = { pagoId?: string; tandaId: string; userId?: string; action: string };

/**
 * Manda al final el turno de un participante atrasado (solo si su turno aún no
 * llega). Se hace en una transacción con un número temporal para no chocar con
 * @@unique([tanda_id, numero_turno]). Queda como `pospuesto` para no repetirse.
 */
async function posponerTurno(
  tandaId: string,
  participanteId: string
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const tanda = await tx.tanda.findUniqueOrThrow({ where: { id: tandaId } });
    const turno = await tx.turno.findUnique({
      where: {
        tanda_id_participante_id: { tanda_id: tandaId, participante_id: participanteId },
      },
    });
    if (
      !turno ||
      turno.estado_turno !== "pendiente" ||
      turno.numero_turno <= tanda.periodo_actual ||
      turno.numero_turno >= tanda.num_participantes
    ) {
      return false;
    }

    const turnos = await tx.turno.findMany({ where: { tanda_id: tandaId } });
    const idPorNumero = new Map(turnos.map((t) => [t.numero_turno, t.id]));
    const fechaPorNumero = new Map(turnos.map((t) => [t.numero_turno, t.fecha_cobro]));

    await tx.turno.update({ where: { id: turno.id }, data: { numero_turno: -1 } });
    for (const [actual, nuevo] of reordenarAlFinal(
      turno.numero_turno,
      tanda.num_participantes
    )) {
      const id = actual === turno.numero_turno ? turno.id : idPorNumero.get(actual);
      if (!id) continue;
      await tx.turno.update({
        where: { id },
        data: {
          numero_turno: nuevo,
          fecha_cobro: fechaPorNumero.get(nuevo) ?? null,
          ...(id === turno.id ? { estado_turno: "pospuesto" } : {}),
        },
      });
    }
    return true;
  });
}

/**
 * Expulsa a un participante: su turno queda `expulsado`, sus aportaciones
 * abiertas se cancelan (así el cron no vuelve a procesarlas) y se bloquea
 * BLOCK_DAYS días. Si su turno aún no llegaba, ese periodo se saltará.
 */
async function expulsar(
  tandaId: string,
  participanteId: string,
  ahora: Date
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const turno = await tx.turno.findUnique({
      where: {
        tanda_id_participante_id: { tanda_id: tandaId, participante_id: participanteId },
      },
    });
    if (!turno || turno.estado_turno === "expulsado") return false;

    await tx.turno.update({
      where: { id: turno.id },
      data: { estado_turno: "expulsado" },
    });
    await tx.pago.updateMany({
      where: {
        tanda_id: tandaId,
        pagador_id: participanteId,
        estado: { in: PAGO_ESTADOS_ABIERTOS },
      },
      data: { estado: "cancelado" },
    });
    await tx.user.update({
      where: { id: participanteId },
      data: {
        blocked_tandas: true,
        block_undate: sumarDias(ahora, BLOCK_DAYS),
        score: { decrement: POINTS_EXPULSION },
      },
    });
    return true;
  });
}

/**
 * Cron diario: gracia, cargos, baja de nivel, posponer turno y expulsión para
 * pagos atrasados del periodo en curso; además reintenta cierres de periodo
 * que quedaron pendientes (p. ej. si falló la liberación del escrow).
 * Requiere `Authorization: Bearer <CRON_SECRET>`.
 */
async function handler(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return cronUnauthorizedResponse();
  }
  try {
    const ahora = new Date();
    const actions: Accion[] = [];
    const errors: Array<{ tandaId: string; pagoId?: string; error: string }> = [];

    const candidatos = await prisma.pago.findMany({
      where: {
        estado: { in: PAGO_ESTADOS_ABIERTOS },
        fecha_vencimiento: { lt: ahora },
        tanda: { estado: "activa" },
      },
      include: {
        tanda: { select: { periodo_actual: true } },
        pagador: { select: { level: true } },
      },
    });
    // Solo el periodo en curso: los siguientes aún no se pueden pagar.
    const atrasados = candidatos.filter((p) => p.periodo === p.tanda.periodo_actual);

    for (const pago of atrasados) {
      const dias = diasEntre(pago.fecha_vencimiento!, ahora);
      if (dias < 1) continue;
      const plan = planearRetraso({ estado: pago.estado, diasRetraso: dias });

      try {
        await prisma.$transaction(async (tx) => {
          await tx.pago.update({
            where: { id: pago.id },
            data: {
              dias_retraso: plan.diasRetraso,
              estado: plan.estado,
              cargo_retraso: plan.cargoRetraso,
              monto_total: Number(pago.monto_base) + plan.cargoRetraso,
            },
          });
          if (plan.penalizar) {
            await tx.user.update({
              where: { id: pago.pagador_id },
              data: { score: { decrement: POINTS_LATE_PENALTY }, streak: 0 },
            });
          }
          if (plan.degradarNivel && pago.pagador.level !== "BASICO") {
            await tx.user.update({
              where: { id: pago.pagador_id },
              data: { level: "BASICO" },
            });
          }
        });
        if (plan.estado !== pago.estado) {
          actions.push({
            pagoId: pago.id,
            tandaId: pago.tanda_id,
            userId: pago.pagador_id,
            action: plan.estado === "vencido" ? `vencido_cargo_${plan.cargoRetraso}` : plan.estado,
          });
        }
        if (plan.degradarNivel && pago.pagador.level !== "BASICO") {
          actions.push({ pagoId: pago.id, tandaId: pago.tanda_id, userId: pago.pagador_id, action: "level_downgrade" });
        }
        if (plan.posponerTurno && (await posponerTurno(pago.tanda_id, pago.pagador_id))) {
          actions.push({ pagoId: pago.id, tandaId: pago.tanda_id, userId: pago.pagador_id, action: "turn_postponed" });
        }
        if (plan.expulsar && (await expulsar(pago.tanda_id, pago.pagador_id, ahora))) {
          actions.push({ pagoId: pago.id, tandaId: pago.tanda_id, userId: pago.pagador_id, action: "expelled" });
        }
      } catch (e) {
        console.error(`tanda-penalties pago ${pago.id}:`, e);
        errors.push({
          tandaId: pago.tanda_id,
          pagoId: pago.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Periodos que ya no tienen pagos abiertos pero siguen sin cerrarse
    // (expulsiones de hoy o cierres que fallaron antes).
    const activas = await prisma.tanda.findMany({
      where: { estado: "activa" },
      select: { id: true, periodo_actual: true },
    });
    for (const tanda of activas) {
      const abiertos = await prisma.pago.count({
        where: {
          tanda_id: tanda.id,
          periodo: tanda.periodo_actual,
          estado: { notIn: PAGO_ESTADOS_SALDADOS },
        },
      });
      if (abiertos > 0) continue;
      try {
        const cierre = await cerrarPeriodoSiCompleto(tanda.id, tanda.periodo_actual, ahora);
        if (cierre.cerrado) {
          actions.push({
            tandaId: tanda.id,
            action: cierre.tandaCompletada ? "tanda_completed" : `period_${tanda.periodo_actual}_closed`,
          });
        }
      } catch (e) {
        console.error(`tanda-penalties cierre ${tanda.id}:`, e);
        errors.push({ tandaId: tanda.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return NextResponse.json({
      processed: atrasados.length,
      actions,
      errors,
    });
  } catch (e) {
    return errorResponse("Cron tanda-penalties", e);
  }
}

// Vercel Cron invoca con GET; POST se mantiene para llamadas manuales.
export const GET = handler;
export const POST = handler;
