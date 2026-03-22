import {
  Keypair,
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

/** Get the native XLM balance of a classic G... account. */
export async function getBalance(publicKey: string): Promise<string> {
  const server = getServer();
  try {
    const account = await server.getAccount(publicKey);
    // Soroban RPC getAccount returns balances on the account object
    const nativeBalance =
      "balances" in account
        ? (account as unknown as { balances: { asset_type: string; balance: string }[] })
            .balances.find((b) => b.asset_type === "native")?.balance ?? "0"
        : "0";
    return nativeBalance;
  } catch {
    return "0";
  }
}
