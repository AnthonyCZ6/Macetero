import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/stellar";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "userId query param is required" },
        { status: 400 }
      );
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404 }
      );
    }

    const balance = await getBalance(wallet.stellar_public_key);

    return NextResponse.json({
      publicKey: wallet.stellar_public_key,
      balance,
    });
  } catch (e) {
    console.error("Balance error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
