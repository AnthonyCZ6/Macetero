import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createQuote } from "@/lib/etherfuse";

export async function POST(req: NextRequest) {
  try {
    const { userId, type, amount, sourceAsset, targetAsset } = await req.json();

    if (!userId || !type || !amount) {
      return NextResponse.json(
        { error: "userId, type, and amount are required" },
        { status: 400 }
      );
    }

    if (type !== "onramp" && type !== "offramp") {
      return NextResponse.json(
        { error: "type must be 'onramp' or 'offramp'" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.etherfuse_customer_id) {
      return NextResponse.json(
        { error: "User has no Etherfuse customer ID. Complete KYC first." },
        { status: 400 }
      );
    }

    const quoteId = randomUUID();

    // Defaults: onramp = MXN → asset, offramp = asset → MXN
    const src = sourceAsset || (type === "onramp" ? "MXN" : targetAsset);
    const tgt = targetAsset || (type === "offramp" ? "MXN" : sourceAsset);

    if (!src || !tgt) {
      return NextResponse.json(
        { error: "sourceAsset and targetAsset are required" },
        { status: 400 }
      );
    }

    const quote = await createQuote({
      quoteId,
      customerId: user.etherfuse_customer_id,
      blockchain: "stellar",
      type,
      sourceAsset: src,
      targetAsset: tgt,
      sourceAmount: String(amount),
    });

    return NextResponse.json({
      quoteId: quote.quoteId,
      exchangeRate: quote.exchangeRate,
      feeBps: quote.feeBps,
      feeAmount: quote.feeAmount,
      sourceAmount: quote.sourceAmount,
      destinationAmount: quote.destinationAmount,
    });
  } catch (e) {
    console.error("Quote error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
