/** Base URLs públicas de ACTA (creación de API keys). */
export const ACTA_PUBLIC_API = {
  testnet: "https://acta.build/api/testnet",
  mainnet: "https://acta.build/api/mainnet",
} as const;

export type ActaNetwork = keyof typeof ACTA_PUBLIC_API;

export interface ActaCreateApiKeyBody {
  name?: string;
  wallet_address: string;
  metadata: {
    network: "testnet" | "mainnet";
  };
}

export interface ActaCreateApiKeySuccess {
  message: string;
  api_key: string;
  api_key_record: {
    id: string;
    name: string;
    role: string;
    is_active: boolean;
    expires_at: string;
    created_at: string;
  };
}

export async function actaCreateApiKey(
  network: ActaNetwork,
  body: ActaCreateApiKeyBody
): Promise<{ ok: true; data: ActaCreateApiKeySuccess } | { ok: false; status: number; error: string }> {
  const base = ACTA_PUBLIC_API[network];
  const url = `${base}/public/api-keys`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: body.name ?? "Macetero",
      wallet_address: body.wallet_address,
      metadata: {
        network: body.metadata.network,
      },
    }),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      status: res.status,
      error: text || res.statusText || "Invalid JSON from ACTA",
    };
  }

  if (!res.ok) {
    const err =
      typeof json === "object" && json !== null && "error" in json
        ? String((json as { error?: unknown }).error)
        : typeof json === "object" && json !== null && "message" in json
          ? String((json as { message?: unknown }).message)
          : text || res.statusText;
    return { ok: false, status: res.status, error: err };
  }

  const data = json as ActaCreateApiKeySuccess;
  if (!data.api_key) {
    return { ok: false, status: res.status, error: "Respuesta ACTA sin api_key" };
  }

  return { ok: true, data };
}
