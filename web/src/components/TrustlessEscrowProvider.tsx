"use client";

import type { ReactNode } from "react";
import {
  TrustlessWorkConfig,
  development,
  mainNet,
} from "@trustless-work/escrow";

/**
 * Proveedor del SDK @trustless-work/escrow (hooks: useInitializeEscrow, useSendTransaction, …).
 * Requiere `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY` (mismo valor que TRUSTLESS_WORK_API_KEY en servidor).
 * Opcional: `NEXT_PUBLIC_TRUSTLESS_WORK_NETWORK` = mainnet | cualquier otro valor → development.
 */
export function TrustlessEscrowProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY?.trim() ?? "";
  const baseURL =
    process.env.NEXT_PUBLIC_TRUSTLESS_WORK_NETWORK?.trim() === "mainnet"
      ? mainNet
      : development;

  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <TrustlessWorkConfig baseURL={baseURL} apiKey={apiKey}>
      {children}
    </TrustlessWorkConfig>
  );
}
