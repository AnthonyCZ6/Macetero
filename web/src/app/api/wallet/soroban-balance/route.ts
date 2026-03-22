import { NextRequest, NextResponse } from "next/server";
import {
  Address,
  Contract,
  Networks,
  rpc,
  scValToNative,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { getBalance } from "@/lib/stellar";

const STROOPS_PER_XLM = BigInt(10_000_000);

/**
 * Saldo XLM para un contrato smart (CD…): nativo en ledger + opcional SAC; devuelve el máximo.
 * Se ejecuta en el servidor para evitar CORS / fallos al llamar al RPC Soroban desde el navegador.
 *
 * GET /api/wallet/soroban-balance?contractId=CD...
 */
export async function GET(req: NextRequest) {
  const contractId = req.nextUrl.searchParams.get("contractId")?.trim();
  if (!contractId) {
    return NextResponse.json(
      { error: "contractId es requerido" },
      { status: 400 }
    );
  }

  let nativeXlm = 0;
  try {
    const s = await getBalance(contractId);
    nativeXlm = parseFloat(s) || 0;
  } catch {
    nativeXlm = 0;
  }

  let sacXlm = 0;
  const sac =
    process.env["NEXT_PUBLIC_NATIVE_TOKEN_CONTRACT"]?.trim() ?? "";

  if (sac) {
    try {
      const rpcUrl =
        process.env["NEXT_PUBLIC_RPC_URL"] ||
        "https://soroban-testnet.stellar.org";
      const passphrase =
        process.env["NEXT_PUBLIC_NETWORK_PASSPHRASE"] || Networks.TESTNET;

      const server = new rpc.Server(rpcUrl);
      const tokenContract = new Contract(sac);
      const call = tokenContract.call(
        "balance",
        new Address(contractId).toScVal()
      );
      const simResult = await server.simulateTransaction(
        new TransactionBuilder(await server.getAccount(contractId), {
          fee: "200000",
          networkPassphrase: passphrase,
        })
          .addOperation(call)
          .setTimeout(30)
          .build()
      );

      if (
        rpc.Api.isSimulationSuccess(simResult) &&
        simResult.result?.retval
      ) {
        const raw = scValToNative(simResult.result.retval);
        let stroops: bigint;
        if (typeof raw === "bigint") stroops = raw;
        else if (typeof raw === "number" && Number.isFinite(raw))
          stroops = BigInt(Math.trunc(raw));
        else stroops = BigInt(String(raw).replace(/\s/g, ""));
        sacXlm = Number(stroops) / Number(STROOPS_PER_XLM);
      }
    } catch {
      sacXlm = 0;
    }
  }

  const maxXlm = Math.max(nativeXlm, sacXlm);
  return NextResponse.json({
    nativeXlm,
    sacXlm,
    displayXlm: maxXlm.toFixed(7),
  });
}
