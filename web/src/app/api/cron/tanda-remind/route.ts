import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cron: send payment reminders.
 * - 3 days before: gentle reminder
 * - 1 day before: urgent reminder
 * - Same day: final reminder
 * Called daily at 8:00 AM. In production, protect with a secret header.
 */
export async function POST() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const in3Days = new Date(today);
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysEnd = new Date(in3Days);
    in3DaysEnd.setDate(in3DaysEnd.getDate() + 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // 3 days before
    const remind3d = await prisma.pago.findMany({
      where: {
        estado: "pendiente",
        fecha_vencimiento: { gte: in3Days, lt: in3DaysEnd },
      },
      include: {
        pagador: { select: { id: true, name: true, phone: true } },
        tanda: { select: { nombre: true, monto_aportacion: true } },
      },
    });

    // 1 day before
    const remind1d = await prisma.pago.findMany({
      where: {
        estado: "pendiente",
        fecha_vencimiento: { gte: tomorrow, lt: tomorrowEnd },
      },
      include: {
        pagador: { select: { id: true, name: true, phone: true } },
        tanda: { select: { nombre: true, monto_aportacion: true } },
      },
    });

    // Same day
    const remindToday = await prisma.pago.findMany({
      where: {
        estado: "pendiente",
        fecha_vencimiento: { gte: today, lt: todayEnd },
      },
      include: {
        pagador: { select: { id: true, name: true, phone: true } },
        tanda: { select: { nombre: true, monto_aportacion: true } },
      },
    });

    // In production: send push notifications and SMS for each category
    // For now, return the counts as a log
    const notifications = [
      ...remind3d.map((p) => ({
        type: "3_days_before",
        userId: p.pagador.id,
        phone: p.pagador.phone,
        tanda: p.tanda.nombre,
        monto: Number(p.tanda.monto_aportacion),
        vencimiento: p.fecha_vencimiento,
      })),
      ...remind1d.map((p) => ({
        type: "1_day_before",
        userId: p.pagador.id,
        phone: p.pagador.phone,
        tanda: p.tanda.nombre,
        monto: Number(p.tanda.monto_aportacion),
        vencimiento: p.fecha_vencimiento,
      })),
      ...remindToday.map((p) => ({
        type: "same_day",
        userId: p.pagador.id,
        phone: p.pagador.phone,
        tanda: p.tanda.nombre,
        monto: Number(p.tanda.monto_aportacion),
        vencimiento: p.fecha_vencimiento,
      })),
    ];

    return NextResponse.json({
      reminders: {
        threeDaysBefore: remind3d.length,
        oneDayBefore: remind1d.length,
        sameDay: remindToday.length,
      },
      notifications,
    });
  } catch (e) {
    console.error("Cron tanda-remind error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
