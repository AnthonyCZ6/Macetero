import { NextRequest, NextResponse } from "next/server";
import {
  getEscrowDeployPreviewForOrganizer,
  trustlessWorkConfigured,
} from "@/lib/tanda-escrow";

/** GET — vista previa del contrato escrow para el organizador (modal antes de firmar). */
export async function GET(
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

    const userId = req.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    const { id: tandaId } = await params;
    const preview = await getEscrowDeployPreviewForOrganizer(tandaId, userId);
    return NextResponse.json(preview);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg.includes("Solo el organizador") ||
      msg.includes("Ya existe") ||
      msg.includes("debe estar activa")
        ? 403
        : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
