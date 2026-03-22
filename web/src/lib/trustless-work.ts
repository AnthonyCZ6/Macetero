import { Keypair } from "@stellar/stellar-sdk";
import { signTransaction, submitTransaction } from "@/lib/stellar";

/**
 * Flujo con hooks del SDK (`@trustless-work/escrow`): ver `useInitializeEscrowDeploy`
 * y `TrustlessEscrowProvider` — deployEscrow → /api/trustless/sign-xdr → sendTransaction.
 * Este módulo sigue siendo la base para el servidor (tanda-escrow, /api/trustless/deploy).
 */
const TYPE = "single-release" as const;

/** USDC testnet (Stellar) — mismo issuer que en tu colección Postman. */
export const DEFAULT_TRUSTLINE_USDC_TESTNET = {
  address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  symbol: "USDC",
} as const;

/** Ejemplo Impacta / Bootcamp — approver y disputeResolver en Postman. */
export const DEFAULT_IMPACTA_APPROVER_G =
  "GB6MP3L6UGIDY6O6MXNLSKHLXT2T2TCMPZIZGUTOGYKOLHW7EORWMFCK";

/**
 * Wallet Stellar (testnet) de Macetero para roles de escrow Trustless.
 * Debe ser la misma cuenta que firma con `TRUSTLESS_SIGNER_SECRET` / `TRUSTLESS_WORK_OPERATOR_SECRET`.
 * Opcional: `TRUSTLESS_TEAM_WALLET_G` en env para otra G (p. ej. otra red o rotación).
 */
export const DEFAULT_TRUSTLESS_WALLET_G =
  "GAMAANR75JRJX3GH7C7KOAIQC342HQQOFDOG7BCDB7MZXVB2IJMNWSZ3";

/**
 * G por defecto para todos los roles cuando no hay `TRUSTLESS_*_G` en env:
 * prioriza `TRUSTLESS_TEAM_WALLET_G`, luego la wallet Macetero si el signer coincide, si no el signer (evita desalinear firma vs rol).
 */
function defaultRolePublicKey(signerPublicKey: string): string {
  const fromEnv = process.env["TRUSTLESS_TEAM_WALLET_G"]?.trim();
  if (fromEnv) return fromEnv;
  if (signerPublicKey === DEFAULT_TRUSTLESS_WALLET_G) {
    return DEFAULT_TRUSTLESS_WALLET_G;
  }
  return signerPublicKey;
}

function baseUrl(): string {
  return (
    process.env["TRUSTLESS_WORK_BASE_URL"] ||
    "https://dev.api.trustlesswork.com"
  );
}

function apiKey(): string {
  const k = process.env["TRUSTLESS_WORK_API_KEY"] || "";
  if (!k) throw new Error("TRUSTLESS_WORK_API_KEY is not set");
  return k;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey(),
  };
}

/** Quien firma el deploy (`signer` en Postman). */
export function getSignerKeypair(): Keypair {
  const s =
    process.env["TRUSTLESS_SIGNER_SECRET"] ||
    process.env["TRUSTLESS_WORK_OPERATOR_SECRET"];
  if (!s) {
    throw new Error(
      "Set TRUSTLESS_SIGNER_SECRET or TRUSTLESS_WORK_OPERATOR_SECRET"
    );
  }
  return Keypair.fromSecret(s);
}

/** Alias histórico: misma clave que el signer por defecto. */
export function getOperatorKeypair(): Keypair {
  return getSignerKeypair();
}

export interface TrustlessRoleAddresses {
  approver: string;
  serviceProvider: string;
  platformAddress: string;
  releaseSigner: string;
  disputeResolver: string;
}

/**
 * Roles del escrow (G…). Si no defines env, todo apunta al signer (una sola wallet).
 * Para copiar Postman Impacta: pon TRUSTLESS_APPROVER_G y TRUSTLESS_DISPUTE_RESOLVER_G
 * y las TRUSTLESS_*_SECRET que correspondan a cada G.
 */
export function getRoleAddresses(): TrustlessRoleAddresses {
  const signer = getSignerKeypair().publicKey();
  const useImpacta =
    process.env["TRUSTLESS_USE_IMPACTA_ROLE_DEFAULTS"] === "true";

  const roleG = defaultRolePublicKey(signer);

  const approver =
    process.env["TRUSTLESS_APPROVER_G"] ||
    (useImpacta ? DEFAULT_IMPACTA_APPROVER_G : roleG);
  const disputeResolver =
    process.env["TRUSTLESS_DISPUTE_RESOLVER_G"] ||
    (useImpacta ? DEFAULT_IMPACTA_APPROVER_G : roleG);

  return {
    approver,
    serviceProvider: process.env["TRUSTLESS_SERVICE_PROVIDER_G"] || roleG,
    platformAddress: process.env["TRUSTLESS_PLATFORM_ADDRESS_G"] || roleG,
    releaseSigner: process.env["TRUSTLESS_RELEASE_SIGNER_G"] || roleG,
    disputeResolver,
  };
}

export function getTrustlineConfig(): { address: string; symbol: string } {
  return {
    address:
      process.env["TRUSTLINE_ISSUER_G"] ||
      DEFAULT_TRUSTLINE_USDC_TESTNET.address,
    symbol:
      process.env["TRUSTLINE_SYMBOL"] ||
      DEFAULT_TRUSTLINE_USDC_TESTNET.symbol,
  };
}

/**
 * Resuelve la clave S que firma por una cuenta G concreta (cada rol puede ser otra wallet).
 */
export function resolveSecretForPublicKey(publicKey: string): string {
  const candidates = [
    process.env["TRUSTLESS_SIGNER_SECRET"],
    process.env["TRUSTLESS_WORK_OPERATOR_SECRET"],
    process.env["TRUSTLESS_APPROVER_SECRET"],
    process.env["TRUSTLESS_SERVICE_PROVIDER_SECRET"],
    process.env["TRUSTLESS_RELEASE_SIGNER_SECRET"],
    process.env["TRUSTLESS_DISPUTE_RESOLVER_SECRET"],
    process.env["TRUSTLESS_PLATFORM_SECRET"],
  ];
  for (const s of candidates) {
    if (!s) continue;
    try {
      if (Keypair.fromSecret(s).publicKey() === publicKey) return s;
    } catch {
      /* invalid secret */
    }
  }
  throw new Error(
    `No hay TRUSTLESS_*_SECRET que corresponda a ${publicKey}. ` +
      `Añade el secret de esa cuenta o alinea los roles TRUSTLESS_*_G con TRUSTLESS_WORK_OPERATOR_SECRET (misma wallet).`
  );
}

export function trustlessWorkConfigured(): boolean {
  const hasKey = Boolean(process.env["TRUSTLESS_WORK_API_KEY"]);
  const hasSigner = Boolean(
    process.env["TRUSTLESS_SIGNER_SECRET"] ||
      process.env["TRUSTLESS_WORK_OPERATOR_SECRET"]
  );
  return (
    process.env["TRUSTLESS_WORK_ENABLED"] === "true" && hasKey && hasSigner
  );
}

async function twFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string>) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Trustless Work ${res.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function submitTwSignedXdr(signedXdr: string) {
  try {
    const out = await twFetch<{ hash?: string; status?: string }>(
      "/helper/send-transaction",
      { method: "POST", body: JSON.stringify({ signedXdr }) }
    );
    if (out?.hash) {
      return { hash: out.hash, status: out.status ?? "SUCCESS" };
    }
  } catch {
    // fall through
  }
  return submitTransaction(signedXdr);
}

/** Acepta milestones solo con `description` (Postman) o title+description. */
export function normalizeMilestones(
  milestones: Array<{ title?: string; description?: string }>
): { title: string; description: string }[] {
  return milestones.map((m, i) => ({
    title:
      m.title?.trim() ||
      (m.description
        ? `Meta ${i + 1}`
        : `Milestone ${i + 1}`),
    description: (m.description ?? m.title ?? "").trim() || `Paso ${i + 1}`,
  }));
}

export interface DeploySingleReleaseInput {
  engagementId: string;
  title: string;
  description: string;
  amount: number;
  platformFee: number;
  receiver: string;
  milestones: Array<{ title?: string; description?: string }>;
}

export async function deploySingleRelease(
  input: DeploySingleReleaseInput
): Promise<{ unsignedTransaction: string }> {
  const signer = getSignerKeypair();
  const roles = getRoleAddresses();
  const body = {
    signer: signer.publicKey(),
    engagementId: input.engagementId,
    title: input.title,
    description: input.description,
    amount: input.amount,
    platformFee: input.platformFee,
    roles: {
      approver: roles.approver,
      serviceProvider: roles.serviceProvider,
      platformAddress: roles.platformAddress,
      releaseSigner: roles.releaseSigner,
      disputeResolver: roles.disputeResolver,
      receiver: input.receiver,
    },
    trustline: getTrustlineConfig(),
    milestones: normalizeMilestones(input.milestones),
  };
  return twFetch<{ unsignedTransaction: string }>("/deployer/single-release", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Body estilo Postman (deploy single-release). `signer` del JSON se ignora; firma la cuenta del env. */
export async function deploySingleReleaseFromPostmanBody(body: {
  engagementId: string;
  title: string;
  description: string;
  amount: number;
  platformFee: number;
  roles: {
    approver: string;
    serviceProvider: string;
    platformAddress: string;
    releaseSigner: string;
    disputeResolver: string;
    receiver: string;
  };
  milestones: Array<{ title?: string; description?: string }>;
  trustline?: { address: string; symbol: string };
}): Promise<{ unsignedTransaction: string }> {
  const signer = getSignerKeypair();
  const trustline = body.trustline ?? getTrustlineConfig();
  const payload = {
    signer: signer.publicKey(),
    engagementId: body.engagementId,
    title: body.title,
    description: body.description,
    amount: body.amount,
    platformFee: body.platformFee,
    roles: body.roles,
    trustline,
    milestones: normalizeMilestones(body.milestones),
  };
  return twFetch<{ unsignedTransaction: string }>("/deployer/single-release", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fundEscrow(input: {
  contractId: string;
  funderSecret: string;
  amount: string;
}): Promise<{ unsignedTransaction: string }> {
  const kp = Keypair.fromSecret(input.funderSecret);
  return twFetch<{ unsignedTransaction: string }>(
    `/escrow/${TYPE}/fund-escrow`,
    {
      method: "POST",
      body: JSON.stringify({
        contractId: input.contractId,
        signer: kp.publicKey(),
        amount: input.amount,
      }),
    }
  );
}

export async function changeMilestoneStatus(input: {
  contractId: string;
  milestoneIndex: string;
  newStatus: string;
  newEvidence?: string;
}): Promise<{ unsignedTransaction: string }> {
  const roles = getRoleAddresses();
  return twFetch<{ unsignedTransaction: string }>(
    `/escrow/${TYPE}/change-milestone-status`,
    {
      method: "POST",
      body: JSON.stringify({
        contractId: input.contractId,
        serviceProvider: roles.serviceProvider,
        milestoneIndex: input.milestoneIndex,
        newStatus: input.newStatus,
        newEvidence: input.newEvidence ?? "https://tanda.app/pago",
      }),
    }
  );
}

export async function approveMilestone(input: {
  contractId: string;
  milestoneIndex: string;
}): Promise<{ unsignedTransaction: string }> {
  const roles = getRoleAddresses();
  return twFetch<{ unsignedTransaction: string }>(
    `/escrow/${TYPE}/approve-milestone`,
    {
      method: "POST",
      body: JSON.stringify({
        contractId: input.contractId,
        approver: roles.approver,
        milestoneIndex: input.milestoneIndex,
      }),
    }
  );
}

export async function releaseFunds(input: {
  contractId: string;
}): Promise<{ unsignedTransaction: string }> {
  const roles = getRoleAddresses();
  return twFetch<{ unsignedTransaction: string }>(
    `/escrow/${TYPE}/release-funds`,
    {
      method: "POST",
      body: JSON.stringify({
        contractId: input.contractId,
        releaseSigner: roles.releaseSigner,
      }),
    }
  );
}

export async function syncIndexerFromTx(txHash: string): Promise<void> {
  try {
    await twFetch("/indexer/update-from-tx-hash", {
      method: "POST",
      body: JSON.stringify({ txHash }),
    });
  } catch {
    // non-fatal
  }
}

export async function findContractIdByEngagement(
  engagementId: string,
  signerPublic: string
): Promise<string | null> {
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(
        `${baseUrl()}/helper/get-escrows-by-signer?signer=${encodeURIComponent(signerPublic)}`,
        { headers: { Accept: "application/json" } }
      );
      const text = await res.text();
      if (!res.ok) continue;
      const data = text ? JSON.parse(text) : [];
      const rows = Array.isArray(data)
        ? data
        : ((data as { escrows?: unknown[] }).escrows ?? []);
      for (const row of rows as { engagementId?: string; contractId?: string }[]) {
        if (row?.engagementId === engagementId && row?.contractId) {
          return row.contractId;
        }
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

export async function signAndSubmit(unsignedXdr: string, secret: string) {
  const signed = signTransaction(unsignedXdr, secret);
  return submitTwSignedXdr(signed);
}
