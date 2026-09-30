import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/cron-auth";
import { diasEntre, sumarDias } from "@/lib/fechas";
import { isPlaceholderPhone } from "@/lib/phone-placeholder";

const TIPO_POR_DIAS: Record<number, string> = {
  3: "3_days_before",
  1: "1_day_before",
  0: "same_day",
};

/**
 * Cron: send payment reminders for the current period of active tandas.
 * - 3 days before: gentle reminder
 * - 1 day before: urgent reminder
 * - Same day: final reminder
 * Called daily at 8:00 AM (hora de APP_TIMEZONE). Requires `Authorization: Bearer <CRON_SECRET>`.
 */
async function handler(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return cronUnauthorizedResponse();
  }
  try {
    const ahora = new Date();

    const pagos = await prisma.pago.findMany({
      where: {
        estado: "pendiente",
        fecha_vencimiento: { gte: sumarDias(ahora, -1), lt: sumarDias(ahora, 5) },
        tanda: { estado: "activa" },
      },
      include: {
        pagador: { select: { id: true, name: true, phone: true } },
        tanda: { select: { nombre: true, monto_aportacion: true, periodo_actual: true } },
      },
    });

    const notifications = pagos
      .filter((p) => p.periodo === p.tanda.periodo_actual)
      .map((p) => ({ p, dias: diasEntre(ahora, p.fecha_vencimiento!) }))
      .filter(({ dias }) => dias in TIPO_POR_DIAS)
      .map(({ p, dias }) => ({
        type: TIPO_POR_DIAS[dias],
        userId: p.pagador.id,
        phone: isPlaceholderPhone(p.pagador.phone) ? null : p.pagador.phone,
        tanda: p.tanda.nombre,
        monto: Number(p.monto_total),
        vencimiento: p.fecha_vencimiento,
      }));

    // In production: send push notifications and SMS for each category
    const count = (type: string) =>
      notifications.filter((n) => n.type === type).length;

    return NextResponse.json({
      reminders: {
        threeDaysBefore: count("3_days_before"),
        oneDayBefore: count("1_day_before"),
        sameDay: count("same_day"),
      },
      notifications,
    });
  } catch (e) {
    return errorResponse("Cron tanda-remind", e);
  }
}

// Vercel Cron invoca con GET; POST se mantiene para llamadas manuales.
export const GET = handler;
export const POST = handler;
