"use client";

import type { EscrowDeployPreview } from "@/types/tanda-escrow-preview";

type Props = {
  /** `sign`: paso previo a firmar. `view`: solo lectura (p. ej. ya desplegado). */
  mode?: "sign" | "view";
  open: boolean;
  preview: EscrowDeployPreview | null;
  loadingPreview: boolean;
  deploying: boolean;
  error: string | null;
  onClose: () => void;
  onConfirmDeploy: () => void;
};

/**
 * Modal de lectura del contrato escrow (antes del paso de firma con EscrowSignModal).
 */
export function TandaEscrowContractModal({
  mode = "sign",
  open,
  preview,
  loadingPreview,
  deploying,
  error,
  onClose,
  onConfirmDeploy,
}: Props) {
  if (!open) return null;

  const isView = mode === "view";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tanda-escrow-contract-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[color-mix(in_srgb,var(--mx-brown)_18%,transparent)] bg-[color-mix(in_srgb,var(--mx-cream)_95%,white)] p-6 shadow-xl">
        <h2
          id="tanda-escrow-contract-title"
          className="text-lg font-bold text-[var(--mx-ink)]"
        >
          {isView ? "Contrato escrow" : "Contrato escrow (Trustless)"}
        </h2>
        <p className="mt-2 text-sm text-[var(--mx-fg-muted)]">
          {isView
            ? "Términos del acuerdo para este periodo. Si ya fue firmado y desplegado, también verás la referencia en cadena."
            : "Revisa los términos del despliegue en Stellar. Al continuar se te pedirá firmar la transacción con tu wallet registrada en Macetero."}
        </p>

        {loadingPreview && (
          <p className="mt-6 text-sm text-[var(--mx-brown)]">Cargando datos…</p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {preview && !loadingPreview && (
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-[var(--mx-ink)]">Título</dt>
              <dd className="mt-0.5 text-[var(--mx-brown)]">{preview.title}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--mx-ink)]">Descripción</dt>
              <dd className="mt-0.5 text-[var(--mx-brown)]">{preview.description}</dd>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <dt className="font-semibold text-[var(--mx-ink)]">Monto total</dt>
                <dd className="mt-0.5 text-[var(--mx-green)]">
                  ${preview.amount.toFixed(2)} USDC
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--mx-ink)]">Comisión plataforma</dt>
                <dd className="mt-0.5 text-[var(--mx-brown)]">
                  ${preview.platformFee.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--mx-ink)]">Periodo</dt>
                <dd className="mt-0.5 text-[var(--mx-brown)]">{preview.periodo}</dd>
              </div>
            </div>
            <div>
              <dt className="font-semibold text-[var(--mx-ink)]">
                Receptor del premio (turno actual)
              </dt>
              <dd className="mt-0.5 text-[var(--mx-brown)]">
                {preview.receiverDisplayName}
              </dd>
              <dd className="mt-1 break-all font-mono text-xs text-[var(--mx-fg-muted)]">
                {preview.receiver}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--mx-ink)]">
                Hitos ({preview.milestones.length})
              </dt>
              <dd className="mt-2 space-y-2">
                {preview.milestones.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--mx-cream-warm)] bg-white/80 px-3 py-2 text-xs"
                  >
                    <p className="font-medium text-[var(--mx-ink)]">{m.title}</p>
                    <p className="mt-0.5 text-[var(--mx-fg-muted)]">{m.description}</p>
                  </div>
                ))}
              </dd>
            </div>
            <div className="rounded-lg bg-[color-mix(in_srgb,var(--mx-green)_10%,white)] px-3 py-2 text-xs text-[var(--mx-fg-muted)]">
              Aportación por persona: ${preview.montoAportacion.toFixed(2)} ·
              Participantes: {preview.numParticipantes}
            </div>
            {(preview.contractId || preview.engagementId) && (
              <div className="rounded-lg border border-[var(--mx-green)]/30 bg-white/90 px-3 py-2 text-[11px] text-[var(--mx-fg-muted)]">
                {preview.contractId && (
                  <p className="break-all font-mono text-[var(--mx-ink)]">
                    <span className="font-sans font-semibold text-[var(--mx-brown)]">
                      Contrato:{" "}
                    </span>
                    {preview.contractId}
                  </p>
                )}
                {preview.engagementId && (
                  <p className="mt-1 break-all font-mono">
                    <span className="font-sans font-semibold text-[var(--mx-brown)]">
                      Engagement:{" "}
                    </span>
                    {preview.engagementId}
                  </p>
                )}
              </div>
            )}
          </dl>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {isView ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[var(--mx-green)] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--mx-green-hover)]"
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={deploying}
                className="rounded-xl border border-[var(--mx-brown)]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--mx-ink)] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirmDeploy}
                disabled={
                  deploying || loadingPreview || !preview || Boolean(error)
                }
                className="rounded-xl bg-[var(--mx-green)] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--mx-green-hover)] disabled:opacity-50"
              >
                {deploying ? "Desplegando…" : "Continuar a firmar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
