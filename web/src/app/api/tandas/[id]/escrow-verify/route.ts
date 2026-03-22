import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET — Datos para comprobar que el escrow quedó registrado en Macetero (y referencias en cadena).
 * Solo participantes u organizador de la tanda.
 *
 * Query: `userId` (requerido)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = req.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    const { id: tandaId } = await params;

    const tanda = await prisma.tanda.findUnique({
      where: { id: tandaId },
      include: {
        turnos: { select: { participante_id: true } },
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

    if (!tanda) {
      return NextResponse.json({ error: "Tanda no encontrada" }, { status: 404 });
    }

    const isOrganizer = tanda.organizador_id === userId;
    const isParticipant = tanda.turnos.some((t) => t.participante_id === userId);
    if (!isOrganizer && !isParticipant) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

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
    console.error("escrow-verify:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
