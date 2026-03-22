import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPlaceholderPhone } from "@/lib/phone-placeholder";
import { maxTandasForLevel } from "@/lib/tanda-limits";

/** GET /api/user/profile?userId= — datos de Liga / racha para la UI. */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        phone: true,
        email: true,
        score: true,
        streak: true,
        level: true,
        kyc_status: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const activeTandasCount = await prisma.turno.count({
      where: {
        participante_id: userId,
        tanda: { estado: { in: ["pendiente", "activa"] } },
      },
    });

    const maxSim = maxTandasForLevel(user.level);

    const higherScore = await prisma.user.count({
      where: { score: { gt: user.score } },
    });
    const ligaRank = higherScore + 1;

    const now = new Date();
    const deudaAgg = await prisma.pago.aggregate({
      where: {
        pagador_id: userId,
        estado: { in: ["pendiente", "en_gracia", "vencido"] },
        fecha_vencimiento: { not: null, lt: now },
      },
      _sum: { monto_total: true },
    });
    const deudaActual = Number(deudaAgg._sum.monto_total ?? 0);

    const pagosVencidos = await prisma.pago.count({
      where: {
        pagador_id: userId,
        estado: { in: ["pendiente", "en_gracia", "vencido"] },
        fecha_vencimiento: { not: null, lt: now },
      },
    });

    const basePct = 55 + Math.min(user.streak, 10) * 4 + Math.min(user.score, 500) / 25;
    const punctualityPercent = Math.max(
      0,
      Math.min(100, Math.round(basePct - pagosVencidos * 12))
    );

    return NextResponse.json({
      name: user.name,
      phone: isPlaceholderPhone(user.phone) ? null : user.phone,
      email: user.email,
      score: user.score,
      streak: user.streak,
      level: user.level,
      kycStatus: user.kyc_status,
      activeTandasCount,
      maxSimultaneousTandas: Number.isFinite(maxSim) ? maxSim : null,
      ligaRank,
      deudaActual,
      punctualityPercent,
    });
  } catch (e) {
    console.error("Profile error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
