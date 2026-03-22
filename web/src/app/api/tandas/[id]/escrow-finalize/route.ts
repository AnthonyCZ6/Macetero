import { NextRequest, NextResponse } from "next/server";
import {
  finalizeOrganizerEscrowDeploy,
  trustlessWorkConfigured,
} from "@/lib/tanda-escrow";

/** POST — tras firmar y enviar la TX, registra contractId + engagement en la tanda. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!trustlessWorkConfigured()) {
      return NextResponse.json(
        { error: "Trustless Work no está configurado en el servidor" },
        { status: 503 }
      );
    }

    const body = (await req.json()) as {
      userId?: string;
      engagementId?: string;
      txHash?: string;
    };
    const userId = body.userId?.trim();
    const engagementId = body.engagementId?.trim();
    if (!userId || !engagementId) {
      return NextResponse.json(
        { error: "userId y engagementId son requeridos" },
        { status: 400 }
      );
    }

    const { id: tandaId } = await params;
    const out = await finalizeOrganizerEscrowDeploy(tandaId, userId, engagementId, {
      txHash: body.txHash?.trim(),
    });
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg.includes("Solo el organizador") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
