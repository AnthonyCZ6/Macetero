"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SmartAccountKit } from "smart-account-kit";

interface WalletState {
  kit: SmartAccountKit | null;
  contractId: string | null;
  balance: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  createWallet: (email: string) => Promise<void>;
  connectWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

export const WalletContext = createContext<WalletState | null>(null);

const NATIVE_TOKEN = process.env.NEXT_PUBLIC_NATIVE_TOKEN_CONTRACT ?? "";

function friendlyWebAuthnError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    msg.includes("timed out") ||
    msg.includes("not allowed") ||
    (e instanceof DOMException && e.name === "NotAllowedError")
  ) {
    return "Passkey prompt was cancelled or timed out. Make sure your device has Windows Hello, Touch ID, or another security method configured, then try again.";
  }
  if (e instanceof DOMException && e.name === "SecurityError") {
    return "WebAuthn is blocked on this page. Ensure you are on localhost or HTTPS.";
  }
  if (
    msg.includes("pubKeyCredParams") &&
    msg.includes("authenticator")
  ) {
    return (
      "Tu navegador o dispositivo no pudo usar el algoritmo de firma ES256 (-7) que exige esta wallet. " +
      "Prueba: abre http://localhost:3000 (no 127.0.0.1), usa Chrome o Edge actualizado, " +
      "activa Windows Hello (PIN o huella) en Configuración → Cuentas → Opciones de inicio de sesión, " +
      "y desactiva extensiones que bloqueen WebAuthn. En VM o RDP a veces falla hasta conectar un autenticador físico."
    );
  }
  return msg;
}

/** Relying Party ID debe coincidir con el host (WebAuthn). */
function getWebAuthnRpId(): string {
  if (typeof window === "undefined") return "localhost";
  const h = window.location.hostname;
  if (h === "[::1]" || h === "::1") return "localhost";
  return h;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const kitRef = useRef<SmartAccountKit | null>(null);
  const busyRef = useRef(false);
  const initRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [contractId, setContractId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      const { SmartAccountKit, IndexedDBStorage } = await import(
        "smart-account-kit"
      );
      const { startRegistration, startAuthentication } = await import(
        "@simplewebauthn/browser"
      );

      kitRef.current = new SmartAccountKit({
        rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!,
        networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
        accountWasmHash: process.env.NEXT_PUBLIC_ACCOUNT_WASM_HASH!,
        webauthnVerifierAddress:
          process.env.NEXT_PUBLIC_WEBAUTHN_VERIFIER_ADDRESS!,
        // Sin rpId, muchos navegadores fallan con errores de algoritmo/authenticator.
        rpId:
          process.env.NEXT_PUBLIC_RP_ID?.trim() || getWebAuthnRpId(),
        rpName: "Macetero",
        storage: new IndexedDBStorage(),
        // attestation "none" suele evitar fallos en algunos entornos Windows/TPM.
        webAuthn: {
          startRegistration: async (opts) => {
            const j = opts.optionsJSON;
            return startRegistration({
              ...opts,
              optionsJSON: {
                ...j,
                attestation: "none",
              },
            });
          },
          startAuthentication,
        },
      });
      setReady(true);

      try {
        const result = await kitRef.current.connectWallet();
        if (result) {
          setContractId(result.contractId);
          setConnected(true);
        }
      } catch {
        // no stored session
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshBalance = useCallback(async () => {
    const kit = kitRef.current;
    if (!contractId || !kit) return;
    try {
      const res = await fetch(
        `/api/wallet/soroban-balance?contractId=${encodeURIComponent(contractId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setBalance("0");
        return;
      }
      const data = (await res.json()) as {
        displayXlm?: string;
        nativeXlm?: number;
        sacXlm?: number;
      };
      setBalance(data.displayXlm ?? "0");
    } catch {
      setBalance("0");
    }
  }, [contractId]);

  useEffect(() => {
    if (connected && contractId) refreshBalance();
  }, [connected, contractId, refreshBalance]);

  const createWallet = useCallback(async (email: string) => {
    const kit = kitRef.current;
    if (!kit || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const result = await kit.createWallet("Macetero", email, {
        autoSubmit: true,
        autoFund: true,
        nativeTokenContract: NATIVE_TOKEN,
        authenticatorSelection: {
          userVerification: "preferred",
          residentKey: "preferred",
        },
      });
      setContractId(result.contractId);
      setConnected(true);
    } catch (e) {
      setError(friendlyWebAuthnError(e));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    const kit = kitRef.current;
    if (!kit || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const result = await kit.connectWallet({ prompt: true });
      if (result) {
        setContractId(result.contractId);
        setConnected(true);
      }
    } catch (e) {
      setError(friendlyWebAuthnError(e));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const kit = kitRef.current;
    if (!kit) return;
    await kit.disconnect();
    setContractId(null);
    setBalance(null);
    setConnected(false);
  }, []);

  const value = useMemo(
    () => ({
      kit: kitRef.current,
      contractId,
      balance,
      connected,
      loading,
      error,
      createWallet,
      connectWallet,
      disconnect,
      refreshBalance,
    }),
    [
      ready,
      contractId,
      balance,
      connected,
      loading,
      error,
      createWallet,
      connectWallet,
      disconnect,
      refreshBalance,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
