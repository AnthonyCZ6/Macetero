"use client";

import { useCallback, useState, type ReactNode } from "react";
import { TandaEscrowContractModal } from "@/components/TandaEscrowContractModal";
import type { EscrowDeployPreview } from "@/types/tanda-escrow-preview";

type Props = {
  tandaId: string;
  userId: string;
  /** Periodo del contrato a mostrar (debe coincidir con un escrow o con el periodo actual). */
  periodo: number;
  className?: string;
  children?: ReactNode;
};

/**
 * Abre el mismo modal de contrato en solo lectura (después de firmar o para revisar términos).
 */
export function EscrowContractViewButton({
  tandaId,
  userId,
  periodo,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<EscrowDeployPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAndOpen = useCallback(async () => {
    setError(null);
    setPreview(null);
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tandas/${encodeURIComponent(tandaId)}/escrow-contract-view?userId=${encodeURIComponent(userId)}&periodo=${encodeURIComponent(String(periodo))}`
      );
      const j = (await res.json()) as EscrowDeployPreview & { error?: string };
      if (!res.ok) throw new Error(j.error ?? "No se pudo cargar el contrato");
      setPreview(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [tandaId, userId, periodo]);

  const close = useCallback(() => {
    setOpen(false);
    setPreview(null);
    setError(null);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => void loadAndOpen()}
        className={
          className ??
          "rounded-xl border border-[var(--mx-brown)]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--mx-ink)] hover:bg-[color-mix(in_srgb,var(--mx-cream)_88%,white)]"
        }
      >
        {children ?? "Ver contrato"}
      </button>

      <TandaEscrowContractModal
        mode="view"
        open={open}
        preview={preview}
        loadingPreview={loading}
        deploying={false}
        error={error}
        onClose={close}
        onConfirmDeploy={() => {}}
      />
    </>
  );
}
