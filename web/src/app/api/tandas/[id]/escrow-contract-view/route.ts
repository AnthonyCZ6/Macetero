import { NextRequest, NextResponse } from "next/server";
import {
  getEscrowContractViewForMember,
  trustlessWorkConfigured,
} from "@/lib/tanda-escrow";
import { prisma } from "@/lib/prisma";

/**
 * GET — texto del contrato (mismo cuerpo que al firmar) para el modal de solo lectura.
 * Participantes u organizador. `periodo` opcional (default: periodo actual de la tanda).
 */
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
    const msg = e instanceof Error ? e.message : "Error";
    const status =
      msg.includes("Solo participantes") || msg.includes("organizador")
        ? 403
        : msg.includes("no encontrada")
          ? 404
          : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
