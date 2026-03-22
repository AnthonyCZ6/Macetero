"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "macetero_acta_api_key";

type Network = "testnet" | "mainnet";

export function ActaApiKeySection({ userId }: { userId: string }) {
  const [network, setNetwork] = useState<Network>("testnet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [storedHint, setStoredHint] = useState<string | null>(null);

  useEffect(() => {
    const v = window.localStorage.getItem(STORAGE_KEY);
    setStoredHint(
      v ? "Hay una clave guardada en este navegador (solo referencia local)." : null
    );
  }, []);

  const saveLocal = useCallback((key: string) => {
    window.localStorage.setItem(STORAGE_KEY, key);
    setStoredHint("Hay una clave guardada en este navegador (solo referencia local).");
  }, []);

  const clearLocal = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setStoredHint(null);
  }, []);

  const createKey = async () => {
    setLoading(true);
    setError(null);
    setNewKey(null);
    try {
      const res = await fetch("/api/acta/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name: "Macetero web",
          network,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.hint
              ? `${data.error} — ${data.hint}`
              : data.error
            : "No se pudo crear la clave"
        );
        return;
      }
      if (typeof data.api_key === "string") {
        setNewKey(data.api_key);
      }
    } catch {
      setError("Error de red al contactar ACTA.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  };

  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--mx-brown)_14%,transparent)] bg-white px-4 py-4 shadow-sm">
      <p className="text-sm font-semibold text-[var(--mx-ink)]">Acta — API key</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--mx-fg-muted)]">
        Crea una clave para integrar{" "}
        <a
          href="https://docs.acta.build/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--mx-green)] underline-offset-2 hover:underline"
        >
          ACTA
        </a>{" "}
        (reputación verificable). La clave se muestra{" "}
        <strong>una sola vez</strong>; cópiala y guárdala en un lugar seguro. Límite ACTA: 5
        creaciones por minuto por IP.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-[var(--mx-fg-muted)]">Red:</label>
        <select
          aria-label="Red ACTA (testnet o mainnet)"
          value={network}
          onChange={(e) => setNetwork(e.target.value as Network)}
          className="rounded-lg border border-[color-mix(in_srgb,var(--mx-brown)_20%,transparent)] bg-white px-2 py-1.5 text-sm text-[var(--mx-ink)]"
        >
          <option value="testnet">Testnet</option>
          <option value="mainnet">Mainnet</option>
        </select>
        <button
          type="button"
          onClick={createKey}
          disabled={loading}
          className="rounded-xl bg-[var(--mx-bg)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
        >
          {loading ? "Creando…" : "Crear API key"}
        </button>
      </div>

      {storedHint && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--mx-fg-muted)]">
          <span>{storedHint}</span>
          <button
            type="button"
            onClick={clearLocal}
            className="text-[var(--mx-red-soft)] underline-offset-2 hover:underline"
          >
            Olvidar referencia local
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--mx-red-soft)_12%,transparent)] px-3 py-2 text-sm text-[var(--mx-ink)]">
          {error}
        </p>
      )}

      {newKey && (
        <div className="mt-4 rounded-xl border border-[var(--mx-green)]/35 bg-[color-mix(in_srgb,var(--mx-green)_8%,white)] p-3">
          <p className="text-xs font-medium text-[var(--mx-ink)]">
            Copia y guarda esta clave ahora (no volverá a mostrarse):
          </p>
          <code className="mt-2 block break-all rounded-lg bg-white/90 px-2 py-2 font-mono text-[11px] text-[var(--mx-ink)]">
            {newKey}
          </code>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy(newKey)}
              className="rounded-lg bg-[var(--mx-green)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--mx-green-hover)]"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={() => {
                saveLocal(newKey);
                setNewKey(null);
              }}
              className="rounded-lg border border-[var(--mx-brown)]/25 bg-white px-3 py-1.5 text-xs font-medium text-[var(--mx-ink)]"
            >
              Guardar en este navegador
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
