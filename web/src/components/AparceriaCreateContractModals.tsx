"use client";

import { honorificForSpanishName } from "@/lib/honorific-es";

export type AparceriaCreateStep = "sign" | "signed";

type Props = {
  step: AparceriaCreateStep | null;
  tandaNombre: string;
  organizerDisplayName: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirmSign: () => void;
  onGoToTanda: () => void;
};

/**
 * Flujo en dos pasos al crear tanda: firmar → confirmación → el padre ejecuta POST y redirección.
 */
export function AparceriaCreateContractModals({
  step,
  tandaNombre,
  organizerDisplayName,
  submitting = false,
  onClose,
  onConfirmSign,
  onGoToTanda,
}: Props) {
  if (!step) return null;

  const trato = honorificForSpanishName(organizerDisplayName);
  const nombreLimpio =
    organizerDisplayName.trim() || "la persona que organiza la tanda";

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aparceria-create-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[color-mix(in_srgb,var(--mx-brown)_18%,transparent)] bg-[color-mix(in_srgb,var(--mx-cream)_95%,white)] p-6 shadow-xl">
        {step === "sign" ? (
          <>
            <h2
              id="aparceria-create-title"
              className="text-lg font-bold text-[var(--mx-ink)]"
            >
              Firmar contrato
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--mx-brown)]">
              Vas a crear la tanda{" "}
              <strong className="text-[var(--mx-ink)]">{tandaNombre.trim() || "sin nombre"}</strong> con un{" "}
              <strong className="text-[var(--mx-ink)]">compromiso de mano común</strong>, junto con{" "}
              <strong className="text-[var(--mx-ink)]">{trato}</strong>{" "}
              <span className="font-semibold text-[var(--mx-ink)]">{nombreLimpio}</span>, quien convoca el grupo.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--mx-brown)]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--mx-ink)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirmSign}
                className="rounded-xl bg-[var(--mx-green)] px-4 py-2.5 text-center text-sm font-bold leading-snug text-white hover:bg-[var(--mx-green-hover)]"
              >
                Firmar contrato
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              id="aparceria-create-title"
              className="text-lg font-bold text-[var(--mx-ink)]"
            >
              Contrato firmado
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--mx-brown)]">
              Listo: registraste el acuerdo de aparcería para{" "}
              <strong className="text-[var(--mx-ink)]">{tandaNombre.trim() || "tu tanda"}</strong>. A continuación
              creamos la tanda y te llevamos al detalle.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={onGoToTanda}
                className="rounded-xl bg-[var(--mx-green)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--mx-green-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creando tanda…" : "Ir a la tanda"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
