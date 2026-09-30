import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { isBearerAuthorized } from "@/lib/cron-auth";
import {
  deploySingleReleaseFromPostmanBody,
  getSignerKeypair,
  getTrustlineConfig,
  signAndSubmit,
  syncIndexerFromTx,
  findContractIdByEngagement,
} from "@/lib/trustless-work";

export const maxDuration = 120;

/**
 * POST — herramienta de administración (Postman): mismo cuerpo que
 * `POST /deployer/single-release`. Firma con la cuenta del operador, así que
 * exige `Authorization: Bearer <ADMIN_API_SECRET>` (sin la variable, 401 siempre).
 * El campo `signer` del JSON se ignora: siempre usa la cuenta de TRUSTLESS_SIGNER_SECRET / TRUSTLESS_WORK_OPERATOR_SECRET.
 *
 * Trustline: si no envías `trustline`, usa USDC testnet por defecto (GBBD47…).
 */
export async function POST(req: NextRequest) {
  if (!isBearerAuthorized(req, "ADMIN_API_SECRET")) {
    return NextResponse.json(
      { error: "No autorizado: falta o no coincide ADMIN_API_SECRET" },
      { status: 401 }
    );
  }
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
    return errorResponse("Trustless deploy", e);
  }
}
