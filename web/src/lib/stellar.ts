import {
  Asset,
  Keypair,
  StrKey,
  TransactionBuilder,
  Networks,
  rpc,
} from "@stellar/stellar-sdk";

const NETWORK_PASSPHRASE =
  process.env["STELLAR_NETWORK_PASSPHRASE"] || Networks.TESTNET;
const RPC_URL =
  process.env["NEXT_PUBLIC_RPC_URL"] || "https://soroban-testnet.stellar.org";

export function generateKeypair() {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secret: kp.secret() };
}

export function getServer() {
  return new rpc.Server(RPC_URL);
}

/** Sign a base64 XDR transaction envelope and return the signed XDR. */
export function signTransaction(
  xdr: string,
  secret: string,
  networkPassphrase = NETWORK_PASSPHRASE
): string {
  const kp = Keypair.fromSecret(secret);
  const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  tx.sign(kp);
  return tx.toXDR();
}

/** Submit a signed XDR envelope to the Stellar network. */
export async function submitTransaction(signedXdr: string) {
  const server = getServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const response = await server.sendTransaction(tx);

  if (response.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${JSON.stringify(response)}`);
  }

  // Poll for confirmation
  let result = await server.getTransaction(response.hash);
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts && result.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    result = await server.getTransaction(response.hash);
  }

  if (result.status !== "SUCCESS") {
    throw new Error(`Transaction failed with status: ${result.status}`);
  }

  return { hash: response.hash, status: result.status };
}

const STROOPS_PER_XLM = BigInt(10_000_000);

/** Stroops (entero) → XLM con 7 decimales, sin pérdida de precisión. */
export function stroopsToXlm(stroops: bigint): string {
  const sign = stroops < BigInt(0) ? "-" : "";
  const abs = stroops < BigInt(0) ? -stroops : stroops;
  const whole = abs / STROOPS_PER_XLM;
  const frac = (abs % STROOPS_PER_XLM).toString().padStart(7, "0");
  return `${sign}${whole}.${frac}`;
}

/**
 * Saldo de XLM **nativo** en cadena (cuenta clásica `G…` o contrato `C…`).
 * Coincide con lo que suele mostrar Stellar Expert en “balances” de la cuenta.
 * Devuelve "0" si la cuenta no existe (sin fondear) o el RPC falla.
 */
export async function getBalance(address: string): Promise<string> {
  const server = getServer();
  try {
    if (StrKey.isValidContract(address)) {
      const res = await server.getSACBalance(
        address,
        Asset.native(),
        NETWORK_PASSPHRASE
      );
      return stroopsToXlm(BigInt(res.balanceEntry?.amount ?? "0"));
    }
    const entry = await server.getAccountEntry(address);
    return stroopsToXlm(BigInt(entry.balance().toString()));
  } catch {
    return "0";
  }
}
