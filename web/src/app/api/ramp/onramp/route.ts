import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { createOrder } from "@/lib/etherfuse";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const { quoteId, amount } = await req.json();

    if (!quoteId || !(Number(amount) > 0)) {
      return NextResponse.json(
        { error: "quoteId y un amount mayor a 0 son obligatorios" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, bankAccounts: true },
    });

    if (!user?.wallet?.etherfuse_wallet_id) {
      return NextResponse.json(
        { error: "Wallet not registered with Etherfuse" },
        { status: 400 }
      );
    }

    const activeBank = user.bankAccounts.find((b) => b.status === "active");
    if (!activeBank?.etherfuse_bank_account_id) {
      return NextResponse.json(
        { error: "No active bank account. Complete KYC first." },
        { status: 400 }
      );
    }

    const orderId = randomUUID();

    const efOrder = await createOrder({
      orderId,
      bankAccountId: activeBank.etherfuse_bank_account_id,
      cryptoWalletId: user.wallet.etherfuse_wallet_id,
      quoteId,
    });

    await prisma.order.create({
      data: {
        userId,
        etherfuse_order_id: orderId,
        type: "onramp",
        amount: parseFloat(amount),
        status: efOrder.status || "created",
        deposit_clabe: efOrder.depositClabe || null,
      },
    });

    return NextResponse.json({
      orderId,
      status: efOrder.status,
      depositClabe: efOrder.depositClabe,
      statusPage: efOrder.statusPage,
    });
  } catch (e) {
    return errorResponse("Onramp", e);
  }
}
