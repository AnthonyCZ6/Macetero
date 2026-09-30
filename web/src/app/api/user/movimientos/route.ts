import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";

/** GET /api/user/movimientos — depósitos/retiros rampa + aportaciones a tandas del usuario de la sesión. */
export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const [orders, pagos] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      prisma.pago.findMany({
        where: { pagador_id: userId, estado: "pagado" },
        orderBy: { fecha_pago: "desc" },
        take: 40,
        include: { tanda: { select: { nombre: true } } },
      }),
    ]);

    type Item = {
      id: string;
      kind: "deposito" | "retiro" | "tanda";
      title: string;
      at: string;
      amountMxn: number;
      direction: "in" | "out";
    };

    const items: Item[] = [];

    for (const o of orders) {
      const amt = Number(o.amount);
      if (o.type === "onramp") {
        items.push({
          id: `order-${o.id}`,
          kind: "deposito",
          title: "Depósito SPEI / OXXO",
          at: o.updatedAt.toISOString(),
          amountMxn: amt,
          direction: "in",
        });
      } else if (o.type === "offramp") {
        items.push({
          id: `order-${o.id}`,
          kind: "retiro",
          title: "Retiro a cuenta bancaria",
          at: o.updatedAt.toISOString(),
          amountMxn: amt,
          direction: "out",
        });
      }
    }

    for (const p of pagos) {
      if (!p.fecha_pago) continue;
      const nombre = p.tanda.nombre?.trim() || "Tanda";
      items.push({
        id: `pago-${p.id}`,
        kind: "tanda",
        title: `Aportación tanda · ${nombre}`,
        at: p.fecha_pago.toISOString(),
        amountMxn: Number(p.monto_total),
        direction: "out",
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return NextResponse.json({ items: items.slice(0, 25) });
  } catch (e) {
    return errorResponse("Movimientos", e);
  }
}
