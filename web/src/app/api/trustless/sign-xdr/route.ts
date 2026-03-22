import { NextRequest, NextResponse } from "next/server";
import { signTransaction } from "@/lib/stellar";
import { getSignerKeypair } from "@/lib/trustless-work";

/**
 * POST /api/trustless/sign-xdr
 * Firma un XDR sin enviarlo (para completar el flujo deployEscrow → sign → sendTransaction del SDK).
 * Body: { unsignedXdr: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const unsignedXdr =
      typeof body.unsignedXdr === "string" ? body.unsignedXdr.trim() : "";
    if (!unsignedXdr) {
      return NextResponse.json(
        { error: "unsignedXdr es requerido" },
        { status: 400 }
      );
    }

    const kp = getSignerKeypair();
    const signedXdr = signTransaction(unsignedXdr, kp.secret());

    return NextResponse.json({ signedXdr, signer: kp.publicKey() });
  } catch (e) {
    console.error("sign-xdr:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
