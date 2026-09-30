import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { createQuote } from "@/lib/etherfuse";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const { type, amount, sourceAsset, targetAsset } = await req.json();

    if (!type || !(Number(amount) > 0)) {
      return NextResponse.json(
        { error: "type y un amount mayor a 0 son obligatorios" },
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
    return errorResponse("Quote", e);
  }
}
