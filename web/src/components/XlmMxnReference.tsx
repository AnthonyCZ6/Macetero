"use client";

import { useEffect, useState } from "react";

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

function parseXlmBalance(raw: string | null | undefined): number | null {
  if (raw == null || raw === "—") return null;
  const n = Number.parseFloat(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

type Variant = "dashboard" | "miAhorro";

/**
 * Cotización orientativa 1 XLM en MXN (CoinGecko). Opcional: equivalente del saldo en XLM.
 */
export function XlmMxnReference({
  balanceXlm,
  variant = "dashboard",
}: {
  balanceXlm?: string | null;
  variant?: Variant;
}) {
  const [mxnPerXlm, setMxnPerXlm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/price/xlm-mxn")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (typeof d.mxnPerXlm === "number" && Number.isFinite(d.mxnPerXlm)) {
          setMxnPerXlm(d.mxnPerXlm);
        } else {
          setError(typeof d.error === "string" ? d.error : "Sin cotización");
        }
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const xlmAmount = parseXlmBalance(balanceXlm);
  const approx =
    mxnPerXlm != null && xlmAmount != null ? xlmAmount * mxnPerXlm : null;

  const shell =
    variant === "miAhorro"
      ? "rounded-2xl border border-[color-mix(in_srgb,var(--mx-brown)_10%,transparent)] bg-white px-4 py-3 shadow-sm"
      : "rounded-xl border border-[color-mix(in_srgb,var(--mx-brown)_12%,transparent)] bg-[color-mix(in_srgb,var(--mx-cream)_40%,white)] px-3 py-2.5";

  return (
    <div className={shell}>
      <p
        className={
          variant === "miAhorro"
            ? "text-[11px] font-medium text-[var(--mx-fg-muted)]"
            : "text-[11px] font-medium uppercase tracking-wide text-[var(--mx-fg-muted)]"
        }
      >
        {variant === "miAhorro"
          ? "Stellar (referencia mercado, no es cotización Etherfuse)"
          : "Referencia mercado (no es cotización Etherfuse)"}
      </p>
      {loading ? (
        <p className="mt-1 text-sm text-[var(--mx-fg-muted)]">Cargando tipo de cambio…</p>
      ) : error ? (
        <p className="mt-1 text-sm text-[var(--mx-fg-muted)]">{error}</p>
      ) : mxnPerXlm != null ? (
        <>
          <p className="mt-1 text-sm text-[var(--mx-ink)]">
            <span className="font-semibold tabular-nums text-[var(--mx-green)]">1 XLM</span>{" "}
            ≈ <span className="font-semibold tabular-nums">{mxn.format(mxnPerXlm)}</span>
          </p>
          {approx != null && (
            <p className="mt-1 text-xs text-[var(--mx-fg-muted)]">
              {variant === "dashboard" ? "Tu saldo" : "Saldo en cartera"} ≈{" "}
              <span className="font-medium text-[var(--mx-ink)] tabular-nums">
                {mxn.format(approx)}
              </span>{" "}
              (aprox.)
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
