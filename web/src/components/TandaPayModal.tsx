"use client";

type Props = {
  open: boolean;
  periodo: number;
  montoTotal: number;
  cargoRetraso: number;
  visualOnly: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Confirmación visual del pago de aportación (sin detalles de red si es modo demo).
 */
export function TandaPayModal({
  open,
  periodo,
  montoTotal,
  cargoRetraso,
  visualOnly,
  loading,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tanda-pay-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[color-mix(in_srgb,var(--mx-brown)_18%,transparent)] bg-[color-mix(in_srgb,var(--mx-cream)_95%,white)] p-6 shadow-xl">
        <h2
          id="tanda-pay-title"
          className="text-lg font-bold text-[var(--mx-ink)]"
        >
          Confirmar aportación
        </h2>
        {visualOnly && (
          <p className="mt-2 rounded-lg bg-[color-mix(in_srgb,var(--mx-green)_12%,white)] px-3 py-2 text-xs text-[var(--mx-brown)]">
            Modo demostración: el importe se registra en Macetero sin enviar
            transacción a Stellar ni al contrato escrow.
          </p>
        )}
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--mx-fg-muted)]">Periodo</dt>
            <dd className="font-semibold text-[var(--mx-ink)]">{periodo}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--mx-fg-muted)]">Aportación</dt>
            <dd className="font-semibold text-[var(--mx-green)]">
              ${montoTotal.toFixed(2)}
            </dd>
          </div>
          {cargoRetraso > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--mx-fg-muted)]">Cargo por retraso</dt>
              <dd className="font-semibold text-[var(--mx-red-soft)]">
                ${cargoRetraso.toFixed(2)}
              </dd>
            </div>
          )}
          <div className="mt-3 border-t border-[var(--mx-cream-warm)] pt-3">
            <div className="flex justify-between gap-4 text-base">
              <dt className="font-semibold text-[var(--mx-ink)]">Total</dt>
              <dd className="font-bold text-[var(--mx-ink)]">
                ${(montoTotal + cargoRetraso).toFixed(2)}
              </dd>
            </div>
          </div>
        </dl>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-[var(--mx-brown)]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--mx-ink)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-[var(--mx-green)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--mx-green-hover)] disabled:opacity-50"
          >
            {loading ? "Registrando…" : "Confirmar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
