import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/etherfuse";

export async function POST(req: NextRequest) {
  try {
    const { userId, quoteId, amount } = await req.json();

    if (!userId || !quoteId || !amount) {
      return NextResponse.json(
        { error: "userId, quoteId, and amount are required" },
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
    console.error("Onramp error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
