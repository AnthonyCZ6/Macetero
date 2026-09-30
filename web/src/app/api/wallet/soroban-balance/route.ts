import { NextRequest, NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { getBalance } from "@/lib/stellar";

/**
 * Saldo XLM (SAC nativo) de un contrato smart (C…) — wallet passkey.
 * Se ejecuta en el servidor para evitar CORS / fallos al llamar al RPC Soroban desde el navegador.
 * Son datos públicos de la red, por eso no requiere sesión.
 *
 * GET /api/wallet/soroban-balance?contractId=C...
 */
export async function GET(req: NextRequest) {
  const contractId = req.nextUrl.searchParams.get("contractId")?.trim();
  if (!contractId || !StrKey.isValidContract(contractId)) {
    return NextResponse.json(
      { error: "contractId (C…) es requerido" },
      { status: 400 }
    );
  }

  const displayXlm = await getBalance(contractId);
  return NextResponse.json({
    sacXlm: Number(displayXlm),
    displayXlm,
  });
}
