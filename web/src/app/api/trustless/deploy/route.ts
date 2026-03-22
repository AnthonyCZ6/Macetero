import { NextRequest, NextResponse } from "next/server";
import {
  deploySingleReleaseFromPostmanBody,
  getSignerKeypair,
  getTrustlineConfig,
  signAndSubmit,
  syncIndexerFromTx,
  findContractIdByEngagement,
} from "@/lib/trustless-work";

/**
 * POST — mismo cuerpo que Postman `POST /deployer/single-release`.
 * El campo `signer` del JSON se ignora: siempre usa la cuenta de TRUSTLESS_SIGNER_SECRET / TRUSTLESS_WORK_OPERATOR_SECRET.
 *
 * Trustline: si no envías `trustline`, usa USDC testnet por defecto (GBBD47…).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.engagementId || !body?.title || body.amount == null) {
      return NextResponse.json(
        { error: "engagementId, title y amount son requeridos" },
        { status: 400 }
      );
    }

    if (!body?.roles?.receiver) {
      return NextResponse.json(
        { error: "roles.receiver es requerido (G… del beneficiario)" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.milestones) || body.milestones.length === 0) {
      return NextResponse.json(
        { error: "milestones debe ser un array no vacío" },
        { status: 400 }
      );
    }

    const merged = {
      engagementId: String(body.engagementId),
      title: String(body.title),
      description: String(body.description ?? ""),
      amount: Number(body.amount),
      platformFee: Number(body.platformFee ?? 0),
      roles: {
        approver: String(body.roles.approver),
        serviceProvider: String(body.roles.serviceProvider),
        platformAddress: String(body.roles.platformAddress),
        releaseSigner: String(body.roles.releaseSigner),
        disputeResolver: String(body.roles.disputeResolver),
        receiver: String(body.roles.receiver),
      },
      milestones: body.milestones as Array<{ title?: string; description?: string }>,
      trustline: body.trustline
        ? {
            address: String(body.trustline.address),
            symbol: String(body.trustline.symbol),
          }
        : undefined,
    };

    const { unsignedTransaction } = await deploySingleReleaseFromPostmanBody(merged);
    const signer = getSignerKeypair();
    const result = await signAndSubmit(unsignedTransaction, signer.secret());
    await syncIndexerFromTx(result.hash);

    let contractId: string | null = null;
    try {
      contractId = await findContractIdByEngagement(
        merged.engagementId,
        signer.publicKey()
      );
    } catch {
      contractId = null;
    }

    return NextResponse.json({
      ok: true,
      txHash: result.hash,
      signerUsed: signer.publicKey(),
      engagementId: merged.engagementId,
      contractId,
      trustline: merged.trustline ?? getTrustlineConfig(),
    });
  } catch (e) {
    console.error("Trustless deploy error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
