import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";
import { assertMiembroDeTanda } from "@/lib/tanda-acceso";

/**
 * GET — Datos para comprobar que el escrow quedó registrado en Macetero (y referencias en cadena).
 * Solo participantes u organizador de la tanda.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const { id: tandaId } = await params;
    await assertMiembroDeTanda(tandaId, userId);

    const tanda = await prisma.tanda.findUniqueOrThrow({
      where: { id: tandaId },
      include: {
        escrows: {
          orderBy: { periodo: "asc" },
          select: {
            periodo: true,
            contract_id: true,
            engagement_id: true,
            estado: true,
            createdAt: true,
          },
        },
      },
    });

    const base =
      process.env.NEXT_PUBLIC_STELLAR_EXPERT_CONTRACT_BASE?.replace(/\/$/, "") ??
      "https://stellar.expert/explorer/testnet/contract";

    return NextResponse.json({
      tandaId: tanda.id,
      nombre: tanda.nombre,
      estado: tanda.estado,
      periodoActual: tanda.periodo_actual,
      escrows: tanda.escrows.map((e) => ({
        periodo: e.periodo,
        contractId: e.contract_id,
        engagementId: e.engagement_id,
        estado: e.estado,
        createdAt: e.createdAt,
        stellarExpertUrl: `${base}/${encodeURIComponent(e.contract_id)}`,
      })),
      count: tanda.escrows.length,
    });
  } catch (e) {
    return errorResponse("Escrow verify", e);
  }
}
