import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import {
  deployOrganizerEscrow,
  trustlessWorkConfigured,
} from "@/lib/tanda-escrow";

/** Deploy + espera del indexador de Trustless Work. */
export const maxDuration = 120;

/**
 * POST — el organizador confirma y el servidor despliega el escrow del periodo
 * actual firmando con su wallet. Los términos salen de la tanda (no del cliente).
 * Respuesta `pending_index`: la TX entró pero el indexador aún no la ve;
 * reintentar con POST /escrow-finalize `{ engagementId, txHash }`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    if (!trustlessWorkConfigured()) {
      return NextResponse.json(
        { error: "Trustless Work no está configurado en el servidor" },
        { status: 503 }
      );
    }
    const { id: tandaId } = await params;
    const result = await deployOrganizerEscrow(tandaId, userId);
    return NextResponse.json(result, {
      status: result.status === "deployed" ? 200 : 202,
    });
  } catch (e) {
    return errorResponse("Escrow deploy", e);
  }
}
