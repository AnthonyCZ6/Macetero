"use client";

import { useCallback, useState } from "react";
import { EscrowSignModal } from "@/components/EscrowSignModal";
import { TandaEscrowContractModal } from "@/components/TandaEscrowContractModal";
import type { EscrowDeployPreview } from "@/types/tanda-escrow-preview";

type Props = {
  tandaId: string;
  onDeployed: () => void;
};

type DeployResponse =
  | { status: "deployed"; contractId: string; txHash: string }
  | { status: "pending_index"; engagementId: string; txHash: string };

const REINTENTO_REGISTRO_MS = 4000;

/**
 * Botón + modal de contrato + confirmación de firma. El servidor arma los
 * términos con los datos de la tanda y firma con la wallet del organizador.
 */
export function EscrowOrganizerDeploySection({ tandaId, onDeployed }: Props) {
  const [contractOpen, setContractOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [preview, setPreview] = useState<EscrowDeployPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Deploy enviado pero el indexador aún no lo registraba. */
  const [pendiente, setPendiente] = useState<{ engagementId: string; txHash: string } | null>(null);

  const base = `/api/tandas/${encodeURIComponent(tandaId)}`;

  const openPreview = useCallback(async () => {
    setError(null);
    setPreview(null);
    setContractOpen(true);
    setLoadingPreview(true);
    try {
      const res = await fetch(`${base}/escrow-preview`);
      const j = (await res.json()) as EscrowDeployPreview & { error?: string };
      if (!res.ok || j.error) {
        throw new Error(j.error ?? "No se pudo cargar la vista previa");
      }
      setPreview(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoadingPreview(false);
    }
  }, [base]);

  const closeContract = useCallback(() => {
    if (deploying) return;
    setContractOpen(false);
    setPreview(null);
    setError(null);
  }, [deploying]);

  const registrar = useCallback(
    async (p: { engagementId: string; txHash: string }) => {
      const fin = await fetch(`${base}/escrow-finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const finBody = (await fin.json()) as { error?: string };
      if (!fin.ok) {
        throw new Error(
          finBody.error ??
            "Contrato desplegado pero aún no se pudo registrar. Reintenta en unos segundos."
        );
      }
    },
    [base]
  );

  const terminar = useCallback(() => {
    setPendiente(null);
    setContractOpen(false);
    setPreview(null);
    onDeployed();
  }, [onDeployed]);

  const runDeploy = useCallback(async () => {
    setSignOpen(false);
    setDeploying(true);
    setError(null);
    try {
      const res = await fetch(`${base}/escrow-deploy`, { method: "POST" });
      const body = (await res.json()) as DeployResponse & { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Error al desplegar el contrato");
      }
      if (body.status === "pending_index") {
        const p = { engagementId: body.engagementId, txHash: body.txHash };
        setPendiente(p);
        await new Promise((r) => setTimeout(r, REINTENTO_REGISTRO_MS));
        await registrar(p);
      }
      terminar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al desplegar");
    } finally {
      setDeploying(false);
    }
  }, [base, registrar, terminar]);

  const reintentarRegistro = useCallback(async () => {
    if (!pendiente) return;
    setDeploying(true);
    setError(null);
    try {
      await registrar(pendiente);
      terminar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar");
    } finally {
      setDeploying(false);
    }
  }, [pendiente, registrar, terminar]);

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
        {pendiente && !contractOpen && (
          <button
            type="button"
            disabled={deploying}
            onClick={() => void reintentarRegistro()}
            className="mt-2 rounded-lg border border-[var(--mx-green)]/40 px-3 py-1.5 text-xs font-semibold text-[var(--mx-ink)] disabled:opacity-60"
          >
            Registrar contrato desplegado
          </button>
        )}
      </div>

      <TandaEscrowContractModal
        mode="sign"
        open={contractOpen}
        preview={preview}
        loadingPreview={loadingPreview}
        deploying={deploying}
        error={error}
        onClose={closeContract}
        onConfirmDeploy={() => {
          if (pendiente) void reintentarRegistro();
          else setSignOpen(true);
        }}
      />

      <EscrowSignModal
        open={signOpen}
        onConfirm={() => void runDeploy()}
        onCancel={() => setSignOpen(false)}
      />
    </>
  );
}
