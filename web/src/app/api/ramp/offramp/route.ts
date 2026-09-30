import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { decrypt } from "@/lib/crypto";
import { signTransaction, submitTransaction } from "@/lib/stellar";
import { createOrder } from "@/lib/etherfuse";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";

export const maxDuration = 60;

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
    return errorResponse("Offramp", e);
  }
}
