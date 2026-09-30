import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { isPlaceholderPhone } from "@/lib/phone-placeholder";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import { PAGO_ESTADOS_ABIERTOS } from "@/lib/tanda";
import { maxTandasForLevel } from "@/lib/tanda-limits";

/** GET /api/user/profile — datos de Liga / racha del usuario de la sesión. */
export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
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
        estado_turno: { not: "expulsado" },
        tanda: { estado: { in: ["pendiente", "activa"] } },
      },
    });

    const maxSim = maxTandasForLevel(user.level);

    const higherScore = await prisma.user.count({
      where: { score: { gt: user.score } },
    });
    const ligaRank = higherScore + 1;

    const now = new Date();
    // Solo cuenta como deuda el periodo en curso de tandas activas: los
    // siguientes todavía no se pueden pagar.
    const abiertosVencidos = await prisma.pago.findMany({
      where: {
        pagador_id: userId,
        estado: { in: PAGO_ESTADOS_ABIERTOS },
        fecha_vencimiento: { not: null, lt: now },
        tanda: { estado: "activa" },
      },
      select: {
        periodo: true,
        monto_total: true,
        tanda: { select: { periodo_actual: true } },
      },
    });
    const vencidos = abiertosVencidos.filter(
      (p) => p.periodo === p.tanda.periodo_actual
    );
    const deudaActual = vencidos.reduce((s, p) => s + Number(p.monto_total), 0);
    const pagosVencidos = vencidos.length;

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
    return errorResponse("Profile", e);
  }
}
