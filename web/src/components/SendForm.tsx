"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";

const NATIVE_TOKEN = process.env.NEXT_PUBLIC_NATIVE_TOKEN_CONTRACT!;

export function SendForm() {
  const { kit, connected, refreshBalance, balance } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!connected) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!recipient || !amount) return;
    setSending(true);
    setStatus(null);
    try {
      if (!kit) return;
      const stroops = Math.round(parseFloat(amount) * 10_000_000);
      const result = await kit.transfer(NATIVE_TOKEN, recipient, stroops);
      setStatus(`Sent! TX: ${result.hash?.slice(0, 12)}…`);
      setRecipient("");
      setAmount("");
      await refreshBalance();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[color-mix(in_srgb,var(--mx-brown-light)_40%,transparent)] px-4 py-2 text-sm focus:border-[var(--mx-green)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-green)]/25";

  return (
    <form
      onSubmit={handleSend}
      className="mx-card-solid w-full max-w-md space-y-4 p-6"
    >
      <div className="flex items-start gap-2 border-b border-[var(--mx-cream-warm)] pb-4">
        <span className="text-2xl" aria-hidden>
          📤
        </span>
        <div>
          <h2 className="text-lg font-semibold text-[var(--mx-ink)]">
            Retirar dinero
          </h2>
          <p className="text-sm text-[var(--mx-fg-muted)]">
            Disponible:{" "}
            <span className="font-semibold tabular-nums text-[var(--mx-ink)]">
              {balance ?? "—"} XLM
            </span>
          </p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--mx-brown-light)]">
          ¿A dónde retiras?
        </label>
        <div className="mx-highlight px-4 py-3 text-sm font-medium" role="status">
          Etherfuse — MXN a tu cuenta bancaria
        </div>
        <p className="mt-1 text-xs text-[var(--mx-fg-muted)]">
          Rampa fiat gestionada por Etherfuse (pesos a tu banco).
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--mx-brown)]">
          Dirección de destino (G… o C…)
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="GABC…"
          className={`${inputClass} font-mono`}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--mx-brown-light)]">
          Cantidad a retirar (XLM)
        </label>
        <input
          type="number"
          step="0.0000001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className={`${inputClass} tabular-nums`}
        />
      </div>

      <button
        type="submit"
        disabled={sending || !recipient || !amount}
        className="w-full cursor-pointer rounded-xl bg-[var(--mx-green)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[var(--mx-green-hover)] disabled:opacity-50"
      >
        {sending ? "Firmando…" : "Retirar ✓"}
      </button>

      {status && (
        <p className="break-all text-center text-sm text-[var(--mx-brown)]">
          {status}
        </p>
      )}
    </form>
  );
}
