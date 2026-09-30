import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import {
  getEscrowDeployPreviewForOrganizer,
  trustlessWorkConfigured,
} from "@/lib/tanda-escrow";

/** GET — vista previa del contrato escrow para el organizador (modal antes de firmar). */
export async function GET(
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
    const preview = await getEscrowDeployPreviewForOrganizer(tandaId, userId);
    return NextResponse.json(preview);
  } catch (e) {
    return errorResponse("Escrow preview", e);
  }
}
