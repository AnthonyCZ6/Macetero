"use client";

import { useCallback, useRef, useState } from "react";
import { useInitializeEscrow } from "@trustless-work/escrow/hooks";
import type {
  EscrowType,
  InitializeMultiReleaseEscrowPayload,
  InitializeSingleReleaseEscrowPayload,
} from "@trustless-work/escrow/types";

export type SingleReleaseDeployInput = {
  engagementId: string;
  title: string;
  description: string;
  amount: number;
  platformFee?: number;
  receiver: string;
  milestones: Array<{ description: string }>;
};

type EscrowConfigResponse = {
  roles: InitializeSingleReleaseEscrowPayload["roles"];
  trustline: InitializeSingleReleaseEscrowPayload["trustline"];
  error?: string;
};

/**
 * Flujo Trustless Work (documentación):
 * 1) Preparar payload (signer, engagementId, title, description, roles, amount, platformFee, milestones, trustline)
 * 2) Ejecutar endpoint → deployEscrow
 * 3) Obtener unsigned TX
 * 4) Modal de confirmación → firmar (cuenta del usuario vía /api/trustless/sign-xdr-user)
 * 5) POST /api/trustless/send-signed-xdr (hash fiable para indexador + finalize)
 *
 * Requiere `<TrustlessEscrowProvider>` y `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY`.
 * El `signer` del payload es la cuenta G del usuario (misma que en registro), no el operador del servidor.
 */
export type SendSignedTxResult = { hash: string; status: string };

/** Envío del XDR firmado por el servidor (hash fiable para indexador). */
export async function relaySendSignedXdr(
  signedXdr: string
): Promise<SendSignedTxResult> {
  const relay = await fetch("/api/trustless/send-signed-xdr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedXdr }),
  });
  const relayBody = (await relay.json()) as {
    error?: string;
    hash?: string;
    status?: string;
  };
  if (!relay.ok || !relayBody.hash) {
    throw new Error(
      relayBody.error ?? "No se pudo enviar la transacción firmada"
    );
  }
  return {
    hash: relayBody.hash,
    status: relayBody.status ?? "SUCCESS",
  };
}

export function useInitializeEscrowDeploy() {
  const { deployEscrow } = useInitializeEscrow();

  const [signModalOpen, setSignModalOpen] = useState(false);
  const signResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const openSignModalAndWait = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      signResolverRef.current = resolve;
      setSignModalOpen(true);
    });
  }, []);

  const confirmSignModal = useCallback(() => {
    setSignModalOpen(false);
    signResolverRef.current?.(true);
    signResolverRef.current = null;
  }, []);

  const cancelSignModal = useCallback(() => {
    setSignModalOpen(false);
    signResolverRef.current?.(false);
    signResolverRef.current = null;
  }, []);

  /**
   * Despliegue single-release con modal antes de firmar.
   * `userId` se usa para obtener la G del usuario y para firmar en servidor con su clave descifrada.
   */
  const deploySingleReleaseWithUserModal = useCallback(
    async (
      input: SingleReleaseDeployInput & { userId: string }
    ): Promise<SendSignedTxResult> => {
      const { userId, ...rest } = input;

      const [cfgRes, walletRes] = await Promise.all([
        fetch("/api/trustless/escrow-config"),
        fetch(
          `/api/user/wallet-public?userId=${encodeURIComponent(userId)}`
        ),
      ]);

      const cfg = (await cfgRes.json()) as EscrowConfigResponse;
      if (!cfgRes.ok || cfg.error) {
        throw new Error(cfg.error ?? "No se pudo cargar escrow-config");
      }

      const w = (await walletRes.json()) as { error?: string; publicKey?: string };
      if (!walletRes.ok || !w.publicKey) {
        throw new Error(w.error ?? "No se pudo obtener la wallet del usuario");
      }

      const payload: InitializeSingleReleaseEscrowPayload = {
        signer: w.publicKey,
        engagementId: rest.engagementId,
        title: rest.title,
        description: rest.description,
        amount: rest.amount,
        platformFee: rest.platformFee ?? 0,
        roles: {
          ...cfg.roles,
          receiver: rest.receiver,
        },
        trustline: cfg.trustline,
        milestones: rest.milestones.map((m) => ({
          description: m.description,
        })),
      };

      const escrowRes = await deployEscrow(payload, "single-release");
      const unsignedTransaction = escrowRes?.unsignedTransaction;
      if (!unsignedTransaction) {
        throw new Error(
          "unsignedTransaction ausente en la respuesta de deployEscrow"
        );
      }

      const accepted = await openSignModalAndWait();
      if (!accepted) {
        throw new Error("Firma cancelada");
      }

      const signRes = await fetch("/api/trustless/sign-xdr-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          unsignedXdr: unsignedTransaction,
          signerPublicKey: w.publicKey,
        }),
      });
      const signedBody = (await signRes.json()) as {
        error?: string;
        signedXdr?: string;
      };
      if (!signRes.ok || !signedBody.signedXdr) {
        throw new Error(signedBody.error ?? "Fallo al firmar el XDR");
      }

      return relaySendSignedXdr(signedBody.signedXdr);
    },
    [deployEscrow, openSignModalAndWait]
  );

  /**
   * Variante sin modal: firma con operador del servidor (Postman / operador único).
   * @deprecated Preferir deploySingleReleaseWithUserModal para el flujo “organizador”.
   */
  const deploySingleReleaseAndSubmitOperator = useCallback(
    async (input: SingleReleaseDeployInput) => {
      const cfgRes = await fetch("/api/trustless/escrow-config");
      const cfg = (await cfgRes.json()) as EscrowConfigResponse & {
        signer?: string;
      };
      if (!cfgRes.ok || cfg.error) {
        throw new Error(cfg.error ?? "No se pudo cargar /api/trustless/escrow-config");
      }

      const opRes = await fetch("/api/trustless/operator-public");
      const op = (await opRes.json()) as { publicKey?: string; error?: string };
      const signer = op.publicKey;
      if (!opRes.ok || !signer) {
        throw new Error(op.error ?? "Operador no configurado");
      }

      const payload: InitializeSingleReleaseEscrowPayload = {
        signer,
        engagementId: input.engagementId,
        title: input.title,
        description: input.description,
        amount: input.amount,
        platformFee: input.platformFee ?? 0,
        roles: {
          ...cfg.roles,
          receiver: input.receiver,
        },
        trustline: cfg.trustline,
        milestones: input.milestones.map((m) => ({
          description: m.description,
        })),
      };

      const escrowRes = await deployEscrow(payload, "single-release");
      const unsignedTransaction = escrowRes?.unsignedTransaction;
      if (!unsignedTransaction) {
        throw new Error(
          "unsignedTransaction ausente en la respuesta de deployEscrow"
        );
      }

      const signRes = await fetch("/api/trustless/sign-xdr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unsignedXdr: unsignedTransaction }),
      });
      const signedBody = (await signRes.json()) as {
        error?: string;
        signedXdr?: string;
      };
      if (!signRes.ok || !signedBody.signedXdr) {
        throw new Error(signedBody.error ?? "Fallo al firmar el XDR");
      }

      return relaySendSignedXdr(signedBody.signedXdr);
    },
    [deployEscrow]
  );

  const deployAndSubmit = useCallback(
    async (
      payload:
        | InitializeSingleReleaseEscrowPayload
        | InitializeMultiReleaseEscrowPayload,
      type: EscrowType,
      options?: { useOperatorSign?: boolean }
    ) => {
      const escrowRes = await deployEscrow(payload, type);
      const unsignedTransaction = escrowRes?.unsignedTransaction;
      if (!unsignedTransaction) {
        throw new Error(
          "unsignedTransaction ausente en la respuesta de deployEscrow"
        );
      }

      if (options?.useOperatorSign) {
        const signRes = await fetch("/api/trustless/sign-xdr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unsignedXdr: unsignedTransaction }),
        });
        const signedBody = (await signRes.json()) as {
          error?: string;
          signedXdr?: string;
        };
        if (!signRes.ok || !signedBody.signedXdr) {
          throw new Error(signedBody.error ?? "Fallo al firmar el XDR");
        }
        return relaySendSignedXdr(signedBody.signedXdr);
      }

      throw new Error(
        "Para payload manual usa deploySingleReleaseWithUserModal o pasa useOperatorSign: true"
      );
    },
    [deployEscrow]
  );

  return {
    deployEscrow,
    /** Mismo envío que usa el flujo del modal (recomendado si firmas en servidor). */
    relaySendSignedXdr,
    /** Flujo recomendado: organizador con modal y firma con la cuenta G del usuario. */
    deploySingleReleaseWithUserModal,
    /** Operador único (sin modal), mismo criterio que antes con /api/trustless/sign-xdr. */
    deploySingleReleaseAndSubmitOperator,
    /** @deprecated Alias de deploySingleReleaseAndSubmitOperator */
    deploySingleReleaseAndSubmit: deploySingleReleaseAndSubmitOperator,
    deployAndSubmit,
    signModalOpen,
    confirmSignModal,
    cancelSignModal,
  };
}
