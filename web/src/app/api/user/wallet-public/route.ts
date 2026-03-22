import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/user/wallet-public?userId= — dirección Stellar (G…) del usuario. */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user?.wallet?.stellar_public_key) {
      return NextResponse.json(
        { error: "Usuario sin wallet Stellar registrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      publicKey: user.wallet.stellar_public_key.trim(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
