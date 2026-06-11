import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/cron-auth";

/**
 * Cron: auto-start tandas whose fecha_inicio is today.
 * Called daily. Requires `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return cronUnauthorizedResponse();
  }
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find all active tandas starting today
    const tandas = await prisma.tanda.findMany({
      where: {
        estado: "activa",
        periodo_actual: { lte: 1 },
        fecha_inicio: { gte: today, lt: tomorrow },
      },
      include: {
        pagos: { where: { periodo: 1 } },
      },
    });

    const started: string[] = [];

    for (const tanda of tandas) {
      // Ensure periodo_actual is 1
      if (tanda.periodo_actual === 0) {
        await prisma.tanda.update({
          where: { id: tanda.id },
          data: { periodo_actual: 1 },
        });
      }

      started.push(tanda.id);
      // In production: send push notifications to all participants
    }

    return NextResponse.json({
      processed: started.length,
      tandaIds: started,
    });
  } catch (e) {
    console.error("Cron tanda-start error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
