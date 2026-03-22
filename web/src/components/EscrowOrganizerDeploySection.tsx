"use client";

import { useCallback, useState } from "react";
import { EscrowSignModal } from "@/components/EscrowSignModal";
import { TandaEscrowContractModal } from "@/components/TandaEscrowContractModal";
import { useInitializeEscrowDeploy } from "@/hooks/useInitializeEscrowDeploy";
import type { SendSignedTxResult } from "@/hooks/useInitializeEscrowDeploy";
import type { EscrowDeployPreview } from "@/types/tanda-escrow-preview";

type Props = {
  tandaId: string;
  userId: string;
  onDeployed: () => void;
};

/**
 * Botón + modal de contrato + flujo Trustless (firmar con wallet del organizador).
 * Solo montar cuando el servidor indique que puede desplegarse (evita hooks sin provider).
 */
export function EscrowOrganizerDeploySection({
  tandaId,
  userId,
  onDeployed,
}: Props) {
  const {
    deploySingleReleaseWithUserModal,
    signModalOpen,
    confirmSignModal,
    cancelSignModal,
  } = useInitializeEscrowDeploy();

  const [contractOpen, setContractOpen] = useState(false);
  const [preview, setPreview] = useState<EscrowDeployPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPreview = useCallback(async () => {
    setError(null);
    setPreview(null);
    setContractOpen(true);
    setLoadingPreview(true);
    try {
      const res = await fetch(
        `/api/tandas/${encodeURIComponent(tandaId)}/escrow-preview?userId=${encodeURIComponent(userId)}`
      );
      const j = (await res.json()) as EscrowDeployPreview & { error?: string };
      if (!res.ok) {
        throw new Error(j.error ?? "No se pudo cargar la vista previa");
      }
      if ("error" in j && j.error) throw new Error(j.error);
      setPreview(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoadingPreview(false);
    }
  }, [tandaId, userId]);

  const closeContract = useCallback(() => {
    if (deploying) return;
    setContractOpen(false);
    setPreview(null);
    setError(null);
  }, [deploying]);

  const runDeploy = useCallback(async () => {
    if (!preview) return;
    setDeploying(true);
    setError(null);
    const engagementId = `tanda-${tandaId.slice(0, 8)}-p${preview.periodo}-${Date.now()}`;
    try {
      const result: SendSignedTxResult = await deploySingleReleaseWithUserModal({
        userId,
        engagementId,
        title: preview.title,
        description: preview.description,
        amount: preview.amount,
        platformFee: preview.platformFee,
        receiver: preview.receiver,
        milestones: preview.milestones.map((m) => ({
          description: m.description,
        })),
      });

      const txHash = result.hash;
      const fin = await fetch(
        `/api/tandas/${encodeURIComponent(tandaId)}/escrow-finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            engagementId,
            txHash,
          }),
        }
      );
      const finBody = (await fin.json()) as { error?: string };
      if (!fin.ok) {
        throw new Error(
          finBody.error ??
            "Contrato desplegado pero no se pudo guardar en Macetero. Reintenta registrar o revisa el indexador."
        );
      }

      setContractOpen(false);
      setPreview(null);
      onDeployed();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al desplegar";
      setError(msg);
    } finally {
      setDeploying(false);
    }
  }, [
    deploySingleReleaseWithUserModal,
    onDeployed,
    preview,
    tandaId,
    userId,
  ]);

  return (
    <>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => void openPreview()}
          className="rounded-xl bg-[var(--mx-green)] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--mx-green-hover)]"
        >
          Ver contrato y firmar
        </button>
        <p className="mt-2 text-[11px] text-[var(--mx-fg-muted)]">
          Solo el organizador. Se abre el texto del contrato; luego firmas con tu
          cuenta Stellar (misma que en Perfil).
        </p>
      </div>

      <TandaEscrowContractModal
        mode="sign"
        open={contractOpen}
        preview={preview}
        loadingPreview={loadingPreview}
        deploying={deploying}
        error={error}
        onClose={closeContract}
        onConfirmDeploy={() => void runDeploy()}
      />

      <EscrowSignModal
        open={signModalOpen}
        onConfirm={confirmSignModal}
        onCancel={cancelSignModal}
      />
    </>
  );
}
