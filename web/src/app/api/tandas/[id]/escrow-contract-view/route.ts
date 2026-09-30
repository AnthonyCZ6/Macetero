import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import {
  getEscrowContractViewForMember,
  trustlessWorkConfigured,
} from "@/lib/tanda-escrow";

/**
 * GET — texto del contrato (mismo cuerpo que al firmar) para el modal de solo lectura.
 * Participantes u organizador. `periodo` opcional (default: periodo actual de la tanda).
 */
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
    const periodoParam = req.nextUrl.searchParams.get("periodo")?.trim();
    let periodo: number;
    if (periodoParam) {
      periodo = parseInt(periodoParam, 10);
      if (Number.isNaN(periodo)) {
        return NextResponse.json({ error: "periodo inválido" }, { status: 400 });
      }
    } else {
      const tanda = await prisma.tanda.findUnique({
        where: { id: tandaId },
        select: { periodo_actual: true },
      });
      if (!tanda) {
        return NextResponse.json({ error: "Tanda no encontrada" }, { status: 404 });
      }
      periodo = tanda.periodo_actual;
    }

    const preview = await getEscrowContractViewForMember(tandaId, userId, periodo);
    return NextResponse.json(preview);
  } catch (e) {
    return errorResponse("Escrow contract view", e);
  }
}
