import { createHmac, timingSafeEqual } from "crypto";

const BASE_URL =
  process.env["ETHERFUSE_BASE_URL"] || "https://api.sand.etherfuse.com";
const API_KEY = process.env["ETHERFUSE_API_KEY"] || "";

// ── helpers ────────────────────────────────────────────────────────

async function efFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Etherfuse ${res.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

// ── types ──────────────────────────────────────────────────────────

export interface EfWallet {
  walletId: string;
  customerId: string;
  publicKey: string;
  blockchain: string;
  kycStatus: string;
  claimedOwnership: boolean;
}

export interface EfOnboardingResponse {
  onboardingUrl: string;
}

export interface EfQuote {
  quoteId: string;
  exchangeRate: string;
  feeBps: number;
  feeAmount: string;
  destinationAmount: string;
  sourceAmount: string;
}

export interface EfOrder {
  orderId: string;
  status: string;
  depositClabe?: string;
  burnTransaction?: string;
  confirmedTxSignature?: string;
  statusPage?: string;
}

// ── wallet ─────────────────────────────────────────────────────────

export async function registerWallet(
  publicKey: string,
  blockchain = "stellar",
  claimOwnership = false
): Promise<EfWallet> {
  return efFetch<EfWallet>("/ramp/wallet", {
    method: "POST",
    body: JSON.stringify({ publicKey, blockchain, claimOwnership }),
  });
}

// ── onboarding / KYC ───────────────────────────────────────────────

export async function getOnboardingUrl(
  customerId: string,
  bankAccountId: string,
  walletPublicKey: string,
  returnUrl: string
): Promise<EfOnboardingResponse> {
  return efFetch<EfOnboardingResponse>("/ramp/customer/onboard", {
    method: "POST",
    body: JSON.stringify({
      customerId,
      bankAccountId,
      walletPublicKey,
      returnUrl,
    }),
  });
}

// ── assets ─────────────────────────────────────────────────────────

export async function getAssets(
  blockchain = "stellar",
  currency = "MXN",
  wallet?: string
) {
  const params = new URLSearchParams({ blockchain, currency });
  if (wallet) params.set("wallet", wallet);
  return efFetch(`/ramp/assets?${params}`);
}

// ── quotes ─────────────────────────────────────────────────────────

export interface QuoteParams {
  quoteId: string;
  customerId: string;
  blockchain?: string;
  type: "onramp" | "offramp";
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
}

export async function createQuote(params: QuoteParams): Promise<EfQuote> {
  return efFetch<EfQuote>("/ramp/quote", {
    method: "POST",
    body: JSON.stringify({
      quoteId: params.quoteId,
      customerId: params.customerId,
      blockchain: params.blockchain || "stellar",
      quoteAssets: {
        type: params.type,
        sourceAsset: params.sourceAsset,
        targetAsset: params.targetAsset,
      },
      sourceAmount: params.sourceAmount,
    }),
  });
}

// ── orders ─────────────────────────────────────────────────────────

export interface OrderParams {
  orderId: string;
  bankAccountId: string;
  cryptoWalletId: string;
  quoteId: string;
}

export async function createOrder(params: OrderParams): Promise<EfOrder> {
  return efFetch<EfOrder>("/ramp/order", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getOrder(orderId: string): Promise<EfOrder> {
  return efFetch<EfOrder>(`/ramp/order/${orderId}`);
}

export async function cancelOrder(orderId: string): Promise<void> {
  await efFetch(`/ramp/order/${orderId}/cancel`, { method: "POST" });
}

// ── webhooks ───────────────────────────────────────────────────────

export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const computed = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}
