import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getOnboardingUrl } from "@/lib/etherfuse";

export async function POST(req: NextRequest) {
  try {
    const { userId, returnUrl } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      return NextResponse.json(
        { error: "User or wallet not found" },
        { status: 404 }
      );
    }

    // Generate a stable customer ID if the user doesn't have one yet
    let customerId = user.etherfuse_customer_id;
    if (!customerId) {
      customerId = randomUUID();
      await prisma.user.update({
        where: { id: userId },
        data: { etherfuse_customer_id: customerId },
      });
    }

    const bankAccountId = randomUUID();

    const result = await getOnboardingUrl(
      customerId,
      bankAccountId,
      user.wallet.stellar_public_key,
      returnUrl || `${req.nextUrl.origin}/`
    );

    // Store the bank account placeholder
    await prisma.bankAccount.create({
      data: {
        userId,
        etherfuse_bank_account_id: bankAccountId,
        clabe: "pending",
        status: "pending",
      },
    });

    return NextResponse.json({
      onboardingUrl: result.onboardingUrl,
      customerId,
      bankAccountId,
    });
  } catch (e) {
    console.error("KYC onboard error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
