import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";

/** GET /api/user/wallet-public — dirección Stellar (G…) del usuario de la sesión. */
export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet?.stellar_public_key) {
      return NextResponse.json(
        { error: "Usuario sin wallet Stellar registrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      publicKey: wallet.stellar_public_key.trim(),
    });
  } catch (e) {
    return errorResponse("Wallet public", e);
  }
}
