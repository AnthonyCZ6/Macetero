import { NextRequest, NextResponse } from "next/server";
import { deployEscrowUnsigned } from "@/lib/trustless-work";

/**
 * POST — proxy del deploy de Trustless Work.
 * Recibe `{ payload, type }` (mismo payload que `/deployer/<type>` de TW) y
 * devuelve `{ unsignedTransaction }`. La API key (`TRUSTLESS_WORK_API_KEY`)
 * vive solo en el servidor; el navegador nunca la ve.
 *
 * El XDR devuelto sigue requiriendo la firma del `signer` del payload
 * (vía /api/trustless/sign-xdr-user o sign-xdr), así que este endpoint no
 * puede mover fondos por sí solo.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body?.type as string | undefined;
    const payload = body?.payload as Record<string, unknown> | undefined;

    if (type !== "single-release" && type !== "multi-release") {
      return NextResponse.json(
        { error: "type debe ser single-release o multi-release" },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { error: "payload es requerido" },
        { status: 400 }
      );
    }

    if (typeof payload.signer !== "string" || !payload.signer.startsWith("G")) {
      return NextResponse.json(
        { error: "payload.signer debe ser una cuenta G… válida" },
        { status: 400 }
      );
    }

    if (!Array.isArray(payload.milestones) || payload.milestones.length === 0) {
      return NextResponse.json(
        { error: "payload.milestones debe ser un array no vacío" },
        { status: 400 }
      );
    }

    const { unsignedTransaction } = await deployEscrowUnsigned(payload, type);
    if (!unsignedTransaction) {
      return NextResponse.json(
        { error: "Trustless Work no devolvió unsignedTransaction" },
        { status: 502 }
      );
    }

    return NextResponse.json({ unsignedTransaction });
  } catch (e) {
    console.error("Trustless deploy-unsigned error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
