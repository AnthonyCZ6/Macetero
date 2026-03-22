"use client";

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Modal antes de firmar el despliegue del escrow (paso 4 del flujo Trustless).
 */
export function EscrowSignModal({
  open,
  title = "Firmar despliegue del escrow",
  message = "Se usará tu cuenta Stellar registrada en Macetero (la misma que al crear la tanda). Confirma para continuar.",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="escrow-sign-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[color-mix(in_srgb,var(--mx-brown)_18%,transparent)] bg-[color-mix(in_srgb,var(--mx-cream)_95%,white)] p-6 shadow-xl">
        <h2
          id="escrow-sign-title"
          className="text-lg font-bold text-[var(--mx-ink)]"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--mx-fg-muted)]">
          {message}
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-[var(--mx-fg-muted)]">
          <li>Datos del escrow preparados</li>
          <li>Endpoint ejecutado — transacción sin firmar recibida</li>
          <li>
            <strong className="text-[var(--mx-ink)]">Confirmar aquí</strong> para
            firmar con tu wallet
          </li>
          <li>Enviar transacción a la red</li>
        </ol>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[var(--mx-brown)]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--mx-ink)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-[var(--mx-green)] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--mx-green-hover)]"
          >
            Firmar y continuar
          </button>
        </div>
      </div>
    </div>
  );
}
