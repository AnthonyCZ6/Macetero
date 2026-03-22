import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { signTransaction } from "@/lib/stellar";

/**
 * POST /api/trustless/sign-xdr-user
 * Firma un XDR con la clave Stellar del usuario (misma cuenta que en registro).
 * Body: { userId, unsignedXdr, signerPublicKey }
 * `signerPublicKey` debe coincidir con la wallet del usuario y con el signer del deploy.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const unsignedXdr =
      typeof body.unsignedXdr === "string" ? body.unsignedXdr.trim() : "";
    const signerPublicKey =
      typeof body.signerPublicKey === "string"
        ? body.signerPublicKey.trim()
        : "";

    if (!userId || !unsignedXdr || !signerPublicKey) {
      return NextResponse.json(
        { error: "userId, unsignedXdr y signerPublicKey son requeridos" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user?.wallet?.encrypted_secret) {
      return NextResponse.json(
        { error: "Wallet o secreto no disponible para este usuario" },
        { status: 400 }
      );
    }

    const pk = user.wallet.stellar_public_key.trim();
    if (pk !== signerPublicKey) {
      return NextResponse.json(
        { error: "signerPublicKey no coincide con la wallet del usuario" },
        { status: 403 }
      );
    }

    const secret = decrypt(user.wallet.encrypted_secret);
    const signedXdr = signTransaction(unsignedXdr, secret);

    return NextResponse.json({ signedXdr, signer: pk });
  } catch (e) {
    console.error("sign-xdr-user:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
