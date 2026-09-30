import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/cron-auth";
import { diasEntre, sumarDias } from "@/lib/fechas";

/**
 * Cron: tandas activas cuyo calendario arranca hoy (hora de APP_TIMEZONE).
 * La activación en sí ocurre al llenarse la tanda; aquí solo se asegura el
 * periodo 1 y se listan para notificar a los participantes.
 * Called daily. Requires `Authorization: Bearer <CRON_SECRET>`.
 */
async function handler(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return cronUnauthorizedResponse();
  }
  try {
    const ahora = new Date();
    const candidatas = await prisma.tanda.findMany({
      where: {
        estado: "activa",
        periodo_actual: { lte: 1 },
        fecha_inicio: { gte: sumarDias(ahora, -2), lt: sumarDias(ahora, 2) },
      },
      select: { id: true, periodo_actual: true, fecha_inicio: true },
    });
    const tandas = candidatas.filter((t) => diasEntre(t.fecha_inicio, ahora) === 0);

    for (const tanda of tandas) {
      if (tanda.periodo_actual === 0) {
        await prisma.tanda.update({
          where: { id: tanda.id },
          data: { periodo_actual: 1 },
        });
      }
      // In production: send push notifications to all participants
    }

    return NextResponse.json({
      processed: tandas.length,
      tandaIds: tandas.map((t) => t.id),
    });
  } catch (e) {
    return errorResponse("Cron tanda-start", e);
  }
}

// Vercel Cron invoca con GET; POST se mantiene para llamadas manuales.
export const GET = handler;
export const POST = handler;
