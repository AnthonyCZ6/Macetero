import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  LATE_FEE_PER_WEEK,
  POINTS_LATE_PENALTY,
  POINTS_EXPULSION,
  DAYS_LEVEL_DOWNGRADE,
  DAYS_POSTPONE_TURN,
  DAYS_EXPULSION,
  BLOCK_DAYS,
} from "@/lib/tanda";

/**
 * Cron: process overdue payments — gracia, fees, level downgrade,
 * turn postponement, and expulsion.
 * Called daily. In production, protect with a secret header.
 */
export async function POST() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all unpaid payments past their due date
    const overdue = await prisma.pago.findMany({
      where: {
        estado: { in: ["pendiente", "en_gracia", "vencido"] },
        fecha_vencimiento: { lt: today },
      },
      include: {
        tanda: true,
        pagador: true,
      },
    });

    const actions: Array<{ pagoId: string; action: string; userId: string }> = [];

    for (const pago of overdue) {
      const dueDate = new Date(pago.fecha_vencimiento!);
      dueDate.setHours(0, 0, 0, 0);
      const diffMs = today.getTime() - dueDate.getTime();
      const diasRetraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Update dias_retraso
      await prisma.pago.update({
        where: { id: pago.id },
        data: { dias_retraso: diasRetraso },
      });

      // Day 1-2: Grace period
      if (diasRetraso >= 1 && diasRetraso <= 2 && pago.estado === "pendiente") {
        await prisma.pago.update({
          where: { id: pago.id },
          data: { estado: "en_gracia" },
        });
        actions.push({ pagoId: pago.id, action: "gracia", userId: pago.pagador_id });
      }

      // Day 3+: Vencido, apply late fee
      if (diasRetraso >= 3 && pago.estado !== "vencido") {
        const weeksLate = Math.ceil(diasRetraso / 7);
        const cargo = weeksLate * LATE_FEE_PER_WEEK;
        await prisma.pago.update({
          where: { id: pago.id },
          data: {
            estado: "vencido",
            cargo_retraso: cargo,
            monto_total: Number(pago.monto_base) + cargo,
          },
        });
        // Penalty: -100 points, reset streak
        await prisma.user.update({
          where: { id: pago.pagador_id },
          data: {
            score: { decrement: POINTS_LATE_PENALTY },
            streak: 0,
          },
        });
        actions.push({ pagoId: pago.id, action: `vencido_cargo_${cargo}`, userId: pago.pagador_id });
      }

      // Update late fee for already-vencido payments (weekly escalation)
      if (diasRetraso >= 3 && pago.estado === "vencido") {
        const weeksLate = Math.ceil(diasRetraso / 7);
        const cargo = weeksLate * LATE_FEE_PER_WEEK;
        if (cargo !== Number(pago.cargo_retraso)) {
          await prisma.pago.update({
            where: { id: pago.id },
            data: {
              cargo_retraso: cargo,
              monto_total: Number(pago.monto_base) + cargo,
            },
          });
        }
      }

      // Day 8: Level downgrade
      if (diasRetraso >= DAYS_LEVEL_DOWNGRADE && pago.pagador.level !== "BASICO") {
        await prisma.user.update({
          where: { id: pago.pagador_id },
          data: { level: "BASICO" },
        });
        actions.push({ pagoId: pago.id, action: "level_downgrade", userId: pago.pagador_id });
      }

      // Day 15: Postpone turn to end
      if (diasRetraso >= DAYS_POSTPONE_TURN) {
        const turno = await prisma.turno.findUnique({
          where: {
            tanda_id_participante_id: {
              tanda_id: pago.tanda_id,
              participante_id: pago.pagador_id,
            },
          },
        });

        if (turno && turno.estado_turno === "pendiente") {
          const maxTurno = await prisma.turno.aggregate({
            where: { tanda_id: pago.tanda_id },
            _max: { numero_turno: true },
          });

          const currentMax = maxTurno._max.numero_turno || pago.tanda.num_participantes;

          // Only postpone if not already last
          if (turno.numero_turno < currentMax) {
            // Move everyone between turno+1..max down by 1
            const turnosToMove = await prisma.turno.findMany({
              where: {
                tanda_id: pago.tanda_id,
                numero_turno: { gt: turno.numero_turno, lte: currentMax },
              },
              orderBy: { numero_turno: "asc" },
            });

            for (const t of turnosToMove) {
              await prisma.turno.update({
                where: { id: t.id },
                data: { numero_turno: t.numero_turno - 1 },
              });
            }

            await prisma.turno.update({
              where: { id: turno.id },
              data: { numero_turno: currentMax },
            });

            actions.push({ pagoId: pago.id, action: "turn_postponed", userId: pago.pagador_id });
          }
        }
      }

      // Day 21: Expulsion
      if (diasRetraso >= DAYS_EXPULSION) {
        const blockDate = new Date(today);
        blockDate.setDate(blockDate.getDate() + BLOCK_DAYS);

        await prisma.user.update({
          where: { id: pago.pagador_id },
          data: {
            blocked_tandas: true,
            block_undate: blockDate,
            score: { decrement: POINTS_EXPULSION },
          },
        });

        // Remove the turno
        await prisma.turno.deleteMany({
          where: {
            tanda_id: pago.tanda_id,
            participante_id: pago.pagador_id,
          },
        });

        actions.push({ pagoId: pago.id, action: "expelled", userId: pago.pagador_id });
      }
    }

    return NextResponse.json({
      processed: overdue.length,
      actions,
    });
  } catch (e) {
    console.error("Cron tanda-penalties error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
