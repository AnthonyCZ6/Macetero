import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { signTransaction, submitTransaction } from "@/lib/stellar";
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
        { error: "No active bank account" },
        { status: 400 }
      );
    }

    const orderId = randomUUID();

    // 1. Create the off-ramp order — Etherfuse returns a burnTransaction
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
        type: "offramp",
        amount: parseFloat(amount),
        status: efOrder.status || "created",
      },
    });

    // 2. If Etherfuse returned a burnTransaction, sign and submit it
    if (efOrder.burnTransaction) {
      const secret = decrypt(user.wallet.encrypted_secret);
      const signedXdr = signTransaction(efOrder.burnTransaction, secret);
      const result = await submitTransaction(signedXdr);

      await prisma.order.update({
        where: { etherfuse_order_id: orderId },
        data: { tx_hash: result.hash, status: "funded" },
      });

      return NextResponse.json({
        orderId,
        status: "funded",
        txHash: result.hash,
      });
    }

    // If no burn transaction yet, return the order for polling
    return NextResponse.json({
      orderId,
      status: efOrder.status,
      statusPage: efOrder.statusPage,
    });
  } catch (e) {
    console.error("Offramp error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
