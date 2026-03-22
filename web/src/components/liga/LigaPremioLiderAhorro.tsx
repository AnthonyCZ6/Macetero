"use client";

import { useEffect, useId, useState } from "react";

/** Tarjeta + modal: premio del líder en Ahorro Plus (referencia diseño móvil). */
export function LigaPremioLiderAhorro() {
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
        className="group relative w-full overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--mx-green)_30%,transparent)] bg-gradient-to-br from-[color-mix(in_srgb,var(--mx-green)_14%,var(--mx-cream))] via-[var(--mx-cream)] to-[color-mix(in_srgb,var(--mx-cream-warm)_90%,white)] p-4 text-left shadow-md ring-1 ring-[var(--mx-cream-warm)] transition hover:shadow-lg"
      >
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[color-mix(in_srgb,var(--mx-green)_22%,transparent)] blur-2xl"
          aria-hidden
        />
        <div className="relative flex gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--mx-green)] to-[var(--mx-green-hover)] text-2xl shadow-md"
            aria-hidden
          >
            🏆
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[var(--mx-ink)]">Premio del líder semanal</p>
            <p className="mt-1 text-sm leading-snug text-[var(--mx-brown)]">
              El #1 de cada semana recibe{" "}
              <strong className="text-[var(--mx-ink)]">+1% extra en Ahorro Plus</strong>{" "}
              por 7 días automáticamente.
            </p>
            <span className="mt-2 inline-flex items-center text-xs font-semibold text-[var(--mx-green)] underline decoration-[var(--mx-green)]/40 underline-offset-2 group-hover:text-[var(--mx-green-hover)]">
              Toca para más detalle
            </span>
          </div>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--mx-bg)]/55 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-md rounded-t-3xl border border-white/30 bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="rounded-t-3xl bg-gradient-to-br from-[var(--mx-green)] via-[var(--mx-green-hover)] to-[var(--mx-bg)] px-6 pb-10 pt-6 text-white sm:rounded-3xl">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/85">
                    Beneficio semanal
                  </p>
                  <h2 id={titleId} className="mt-1 text-xl font-bold">
                    Premio del líder en ahorro
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl hover:bg-white/25"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/95">
                El participante en <strong>1.º lugar</strong> del ranking de ahorro
                de la semana activa un <strong>bonus del +1% anualizado</strong> en
                su saldo <strong>Ahorro Plus</strong> durante <strong>7 días</strong>
                . Se aplica de forma automática al cierre del domingo (zona horaria
                de México).
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/90">
                <li className="flex gap-2">
                  <span aria-hidden>✓</span>
                  Compatible con tus depósitos vía Etherfuse.
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>✓</span>
                  Sin trámites: si lideras el ranking, el premio se refleja solo.
                </li>
              </ul>
            </div>
            <div className="border-t border-[var(--mx-cream-warm)] bg-[color-mix(in_srgb,var(--mx-cream)_90%,white)] px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-[var(--mx-bg)] py-3 text-sm font-semibold text-white hover:bg-[var(--mx-bg-soft)]"
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
