"use client";

import { useEffect, useId, useState } from "react";
import { MaceteroLogo } from "@/components/MaceteroLogo";

/** Mensaje atractivo para la pestaña Torneos (competencia por puntos / temporada). */
export function LigaTorneoPromo() {
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
        className="group relative w-full overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--mx-green)_28%,transparent)] bg-gradient-to-br from-[color-mix(in_srgb,var(--mx-green)_12%,var(--mx-cream))] via-[var(--mx-cream)] to-[color-mix(in_srgb,var(--mx-red-soft)_10%,var(--mx-cream))] p-4 text-left shadow-md ring-1 ring-[var(--mx-cream-warm)] transition hover:shadow-lg"
      >
        <div
          className="pointer-events-none absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-[color-mix(in_srgb,var(--mx-red-soft)_25%,transparent)] blur-2xl"
          aria-hidden
        />
        <div className="relative flex gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--mx-green)] to-[var(--mx-bg)] text-2xl shadow-md">
            ⚔️
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-[var(--mx-ink)]">
              <span>Copa</span>
              <MaceteroLogo variant="mark" tone="dark" className="h-6 w-auto max-w-[5rem] shrink-0" />
              <span>· Temporada</span>
            </p>
            <p className="mt-1 text-sm leading-snug text-[var(--mx-brown)]">
              Compite por <strong className="text-[var(--mx-ink)]">puntos de liga</strong>{" "}
              cada semana. Próximamente: premios en{" "}
              <strong className="text-[var(--mx-ink)]">badges</strong> y sorteos entre el
              top 10.
            </p>
            <span className="mt-2 inline-flex items-center text-xs font-semibold text-[var(--mx-green)] underline decoration-[var(--mx-green)]/40 underline-offset-2 group-hover:text-[var(--mx-green-hover)]">
              Ver cómo funciona
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
            <div className="rounded-t-3xl bg-gradient-to-br from-[var(--mx-green)] via-[var(--mx-bg-soft)] to-[var(--mx-bg)] px-6 pb-10 pt-6 text-white sm:rounded-3xl">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-white/80">
                    Torneos
                  </p>
                  <h2
                    id={titleId}
                    className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold"
                  >
                    <span>Copa</span>
                    <MaceteroLogo variant="mark" tone="light" className="h-8 w-auto max-w-[6.5rem] shrink-0" />
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
              <p className="mt-4 text-sm leading-relaxed text-white/90">
                El ranking de <strong>torneos</strong> usa los mismos{" "}
                <strong>puntos de puntualidad</strong> que ves en la primera pestaña:
                pagar a tiempo, mantener racha y evitar penalizaciones te hace
                subir posiciones.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                Estamos preparando <strong>rondas con premios</strong> y tablas por
                colonia. Mientras tanto, usa este ranking como tu{" "}
                <strong>tabla general</strong> de la temporada.
              </p>
            </div>
            <div className="border-t border-[var(--mx-cream-warm)] bg-[color-mix(in_srgb,var(--mx-cream)_90%,white)] px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-[var(--mx-bg)] py-3 text-sm font-semibold text-white hover:bg-[var(--mx-bg-soft)]"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
