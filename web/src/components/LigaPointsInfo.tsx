"use client";

import { useEffect, useId, useState } from "react";
import {
  POINTS_EARLY_BONUS,
  POINTS_EXPULSION,
  POINTS_LATE_PENALTY,
  POINTS_ON_TIME,
  POINTS_STREAK_4W_BONUS,
} from "@/lib/tanda";

function ruleIcon(kind: "gain" | "bonus" | "loss") {
  if (kind === "gain") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--mx-green)_22%,var(--mx-cream))] text-[var(--mx-green)]">
        ✓
      </span>
    );
  }
  if (kind === "bonus") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--mx-red-soft)_22%,var(--mx-cream))] text-[var(--mx-brown)]">
        ⚡
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--mx-red)_18%,var(--mx-cream))] text-[var(--mx-red)]">
      −
    </span>
  );
}

export function LigaPointsInfo() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--mx-green)_28%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--mx-green)_10%,var(--mx-cream))] via-[var(--mx-cream)] to-[color-mix(in_srgb,var(--mx-cream-warm)_80%,white)] px-4 py-3.5 text-left shadow-sm ring-1 ring-[var(--mx-cream-warm)] transition hover:border-[var(--mx-green)] hover:shadow-md sm:w-auto sm:min-w-[280px]"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--mx-green)] to-[var(--mx-bg)] text-xl shadow-md">
            📊
          </span>
          <span>
            <span className="block text-sm font-bold text-[var(--mx-ink)]">
              ¿Cómo se ganan puntos?
            </span>
            <span className="text-xs text-[var(--mx-brown)]">
              Toca para ver reglas y bonos
            </span>
          </span>
        </span>
        <span
          className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-[var(--mx-green)] shadow-sm transition group-hover:bg-[color-mix(in_srgb,var(--mx-green)_12%,var(--mx-cream))]"
          aria-hidden
        >
          Ver
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[var(--mx-bg)]/50 backdrop-blur-sm transition-opacity"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-white/20 bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-3xl"
          >
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[var(--mx-bg)] via-[var(--mx-bg-soft)] to-[var(--mx-green)] px-5 pb-8 pt-6 text-white">
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--mx-green)]/20 blur-2xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-10 left-1/4 h-24 w-40 rounded-full bg-[var(--mx-red-soft)]/15 blur-2xl"
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/85">
                    Liga · Puntualidad
                  </p>
                  <h2 id={titleId} className="mt-1 text-xl font-bold tracking-tight">
                    ¿Cómo se ganan puntos?
                  </h2>
                  <p className="mt-2 text-sm text-white/80">
                    Suma puntos pagando a tiempo en tus tandas y cuida tu racha.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/20"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <ul className="space-y-3">
                <li>
                  <div className="flex gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--mx-green)_22%,transparent)] bg-[color-mix(in_srgb,var(--mx-green)_8%,var(--mx-cream))] p-3">
                    {ruleIcon("gain")}
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--mx-ink)]">
                        Pagar a tiempo
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--mx-brown)]">
                        Dentro del periodo sin retraso.
                      </p>
                      <p className="mt-2 inline-block rounded-lg bg-[var(--mx-green)] px-2.5 py-1 text-sm font-bold text-white tabular-nums">
                        +{POINTS_ON_TIME} pts
                      </p>
                    </div>
                  </div>
                </li>
                <li>
                  <div className="flex gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--mx-red-soft)_25%,transparent)] bg-[color-mix(in_srgb,var(--mx-red-soft)_10%,var(--mx-cream))] p-3">
                    {ruleIcon("bonus")}
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--mx-ink)]">
                        Pagar antes del vencimiento
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--mx-brown)]">
                        Anticipa tu aportación respecto a la fecha límite.
                      </p>
                      <p className="mt-2 inline-block rounded-lg bg-[var(--mx-red-soft)] px-2.5 py-1 text-sm font-bold text-[var(--mx-ink)] tabular-nums">
                        +{POINTS_EARLY_BONUS} pts extra
                      </p>
                    </div>
                  </div>
                </li>
                <li>
                  <div className="flex gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--mx-red-soft)_28%,transparent)] bg-gradient-to-br from-[color-mix(in_srgb,var(--mx-red-soft)_12%,var(--mx-cream))] to-[var(--mx-cream-warm)] p-3">
                    {ruleIcon("bonus")}
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--mx-ink)]">
                        Racha de 4 semanas
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--mx-brown)]">
                        Pagos puntuales seguidos en tus tandas.
                      </p>
                      <p className="mt-2 inline-block rounded-lg bg-gradient-to-r from-[var(--mx-red-soft)] to-[var(--mx-red)] px-2.5 py-1 text-sm font-bold text-white tabular-nums shadow-sm">
                        +{POINTS_STREAK_4W_BONUS} pts bono
                      </p>
                    </div>
                  </div>
                </li>
                <li>
                  <div className="flex gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--mx-red)_22%,transparent)] bg-[color-mix(in_srgb,var(--mx-red)_8%,var(--mx-cream))] p-3">
                    {ruleIcon("loss")}
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--mx-ink)]">Retraso</p>
                      <p className="mt-0.5 text-sm text-[var(--mx-brown)]">
                        Primer incumplimiento grave en el periodo.
                      </p>
                      <p className="mt-2 inline-block rounded-lg bg-[var(--mx-red)] px-2.5 py-1 text-sm font-bold text-white tabular-nums">
                        −{POINTS_LATE_PENALTY} pts
                      </p>
                    </div>
                  </div>
                </li>
                <li>
                  <div className="flex gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--mx-red)_30%,transparent)] bg-[color-mix(in_srgb,var(--mx-red)_10%,var(--mx-cream))] p-3">
                    {ruleIcon("loss")}
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--mx-ink)]">Expulsión</p>
                      <p className="mt-0.5 text-sm text-[var(--mx-brown)]">
                        Por abandono o reglas de la tanda.
                      </p>
                      <p className="mt-2 inline-block rounded-lg bg-[color-mix(in_srgb,var(--mx-red)_85%,black)] px-2.5 py-1 text-sm font-bold text-white tabular-nums">
                        −{POINTS_EXPULSION} pts
                      </p>
                    </div>
                  </div>
                </li>
              </ul>

              <p className="mt-5 rounded-xl border border-[var(--mx-cream-warm)] bg-[color-mix(in_srgb,var(--mx-cream)_92%,white)] px-3 py-2.5 text-center text-xs text-[var(--mx-fg-muted)]">
                Los puntos se reflejan en tu posición en la liga y pueden
                influir en tu nivel de confianza.
              </p>
            </div>

            <div className="shrink-0 border-t border-[var(--mx-cream-warm)] bg-[color-mix(in_srgb,var(--mx-cream)_92%,white)]/80 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-[var(--mx-bg)] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--mx-bg-soft)]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
