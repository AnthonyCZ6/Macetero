import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import { getBalance } from "@/lib/stellar";

/** GET /api/wallet/balance — saldo XLM de la wallet del usuario de la sesión. */
export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
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
    return errorResponse("Balance", e);
  }
}
