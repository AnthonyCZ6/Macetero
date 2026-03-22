import { NextRequest, NextResponse } from "next/server";
import { submitTwSignedXdr } from "@/lib/trustless-work";
import { trustlessWorkConfigured } from "@/lib/tanda-escrow";

/**
 * POST — Envía un XDR ya firmado a la red vía Trustless (`/helper/send-transaction`)
 * o fallback a Soroban RPC. Devuelve `hash` para sincronizar el indexador antes de
 * registrar el `contractId` en Macetero.
 *
 * Body: `{ signedXdr: string }`
 */
export async function POST(req: NextRequest) {
  try {
    if (!trustlessWorkConfigured()) {
      return NextResponse.json(
        { error: "Trustless Work no está configurado en el servidor" },
        { status: 503 }
      );
    }

    const body = (await req.json()) as { signedXdr?: string };
    const signedXdr = body.signedXdr?.trim();
    if (!signedXdr) {
      return NextResponse.json(
        { error: "signedXdr es requerido" },
        { status: 400 }
      );
    }

    const out = await submitTwSignedXdr(signedXdr);
    const hash =
      out && typeof out === "object" && "hash" in out
        ? (out as { hash: string }).hash
        : undefined;
    const status =
      out && typeof out === "object" && "status" in out
        ? (out as { status: string }).status
        : undefined;

    if (!hash) {
      return NextResponse.json(
        {
          error:
            "La red aceptó la transacción pero no se obtuvo hash. Revisa logs del servidor.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ hash, status: status ?? "SUCCESS" });
  } catch (e) {
    console.error("send-signed-xdr:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al enviar la transacción" },
      { status: 500 }
    );
  }
}
