"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { XlmMxnReference } from "@/components/XlmMxnReference";

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function formatMovementWhen(iso: string): string {
  const date = new Date(iso);
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startToday = sod(new Date()).getTime();
  const startThat = sod(date).getTime();
  const diffDays = Math.round((startToday - startThat) / 86400000);
  const timeStr = new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  if (diffDays === 0) return `Hoy, ${timeStr}`;
  if (diffDays === 1) return `Ayer, ${timeStr}`;
  const dateStr = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
  }).format(date);
  return `${dateStr}, ${timeStr}`;
}

type MovimientoItem = {
  id: string;
  kind: "deposito" | "retiro" | "tanda";
  title: string;
  at: string;
  amountMxn: number;
  direction: "in" | "out";
};

export function MiAhorroSection({
  userId,
  showXlmReference = true,
}: {
  userId: string;
  /** Referencia 1 XLM en MXN + equivalente del saldo en cartera (passkey). */
  showXlmReference?: boolean;
}) {
  const { balance } = useWallet();
  const [guardado, setGuardado] = useState<number | null>(null);
  const [items, setItems] = useState<MovimientoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/liga/ahorro?userId=${encodeURIComponent(userId)}`).then((r) =>
        r.json()
      ),
      fetch(`/api/user/movimientos?userId=${encodeURIComponent(userId)}`).then(
        (r) => r.json()
      ),
    ])
      .then(([ah, mov]) => {
        if (cancelled) return;
        const g = ah?.me?.guardado;
        setGuardado(typeof g === "number" ? g : 0);
        if (!mov?.error && Array.isArray(mov?.items)) {
          setItems(mov.items);
        } else {
          setItems([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGuardado(0);
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[1.25rem] bg-[var(--mx-bg)] px-5 py-6 text-white shadow-lg ring-1 ring-black/15">
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.07] to-transparent"
          aria-hidden
        />
        <p className="relative text-xs font-medium text-white/70">Saldo disponible</p>
        {loading ? (
          <p className="relative mt-2 h-10 w-40 animate-pulse rounded-lg bg-white/10" />
        ) : (
          <p className="relative mt-1 text-3xl font-bold tabular-nums tracking-tight text-[var(--mx-green)] sm:text-4xl">
            {mxn.format(guardado ?? 0)}
          </p>
        )}
        <p className="relative mt-1 text-xs text-white/55">pesos mexicanos</p>
        <p className="relative mt-2 text-[11px] leading-snug text-white/45">
          Total depositado vía rampa (SPEI / OXXO), mismo criterio que la liga.
        </p>

        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <Link
            href="/receive"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--mx-green)] py-3.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[var(--mx-green-hover)]"
          >
            <span aria-hidden>+</span>
            Guardar
          </Link>
          <Link
            href="/send"
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-[color-mix(in_srgb,var(--mx-bg)_25%,white)] bg-[color-mix(in_srgb,white_92%,var(--mx-cream))] py-3.5 text-center text-sm font-bold text-[var(--mx-bg)] shadow-sm transition hover:bg-white"
          >
            <span aria-hidden>−</span>
            Retirar
          </Link>
        </div>
      </div>

      {showXlmReference && (
        <XlmMxnReference variant="miAhorro" balanceXlm={balance} />
      )}

      <div>
        <h2 className="text-lg font-bold tracking-tight text-[var(--mx-ink)]">Movimientos</h2>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--mx-fg-muted)]">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-[var(--mx-cream-warm)] bg-white/80 px-4 py-6 text-center text-sm text-[var(--mx-fg-muted)]">
            Aún no hay movimientos. Usa <strong>Guardar</strong> para depositar o
            únete a una tanda.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {items.map((row) => {
              const isIn = row.direction === "in";
              const icon =
                row.kind === "deposito" ? (
                  <span className="text-lg" aria-hidden>
                    💰
                  </span>
                ) : row.kind === "retiro" ? (
                  <span className="text-lg" aria-hidden>
                    📤
                  </span>
                ) : (
                  <span className="text-lg font-bold text-sky-700" aria-hidden>
                    ↑
                  </span>
                );
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--mx-brown)_12%,transparent)] bg-white px-3 py-3 shadow-sm"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                      row.kind === "tanda"
                        ? "bg-sky-500/20"
                        : "bg-[color-mix(in_srgb,var(--mx-red-soft)_14%,var(--mx-cream))]"
                    }`}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--mx-ink)]">
                      {row.title}
                    </p>
                    <p className="text-xs text-[var(--mx-fg-muted)]">
                      {formatMovementWhen(row.at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      isIn ? "text-[var(--mx-green)]" : "text-[var(--mx-red-soft)]"
                    }`}
                  >
                    {isIn ? "+" : "−"}
                    {mxn.format(Math.abs(row.amountMxn))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
