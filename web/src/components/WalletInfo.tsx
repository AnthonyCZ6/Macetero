"use client";

import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";

export function WalletInfo() {
  const { contractId, balance, disconnect, refreshBalance } = useWallet();

  if (!contractId) return null;

  const short = contractId.slice(0, 6) + "…" + contractId.slice(-6);

  return (
    <div className="mx-card-solid w-full max-w-md space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--mx-ink)]">Your Wallet</h2>
        <button
          onClick={disconnect}
          className="cursor-pointer text-sm text-[var(--mx-red)] hover:underline"
        >
          Disconnect
        </button>
      </div>

      <p
        className="font-mono text-sm break-all text-[var(--mx-fg-muted)]"
        title={contractId}
      >
        {short}
      </p>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-[var(--mx-ink)]">
          {balance ?? "—"}
        </span>
        <span className="text-[var(--mx-fg-muted)]">XLM</span>
        <button
          onClick={refreshBalance}
          className="ml-auto cursor-pointer text-xs font-medium text-[var(--mx-green)] underline-offset-2 hover:underline"
        >
          Refresh
        </button>
      </div>

      <nav className="grid grid-cols-3 gap-3 pt-2">
        <Link
          href="/receive"
          className="rounded-lg bg-[color-mix(in_srgb,var(--mx-cream)_40%,var(--mx-cream-warm))] py-2 text-center text-sm font-medium text-[var(--mx-brown)] transition-colors hover:bg-[color-mix(in_srgb,var(--mx-green)_15%,var(--mx-cream))] hover:text-[var(--mx-ink)]"
        >
          Receive
        </Link>
        <Link
          href="/send"
          className="rounded-lg bg-[color-mix(in_srgb,var(--mx-cream)_40%,var(--mx-cream-warm))] py-2 text-center text-sm font-medium text-[var(--mx-brown)] transition-colors hover:bg-[color-mix(in_srgb,var(--mx-green)_15%,var(--mx-cream))] hover:text-[var(--mx-ink)]"
        >
          Send
        </Link>
        <Link
          href="/vault"
          className="rounded-lg bg-[color-mix(in_srgb,var(--mx-cream)_40%,var(--mx-cream-warm))] py-2 text-center text-sm font-medium text-[var(--mx-brown)] transition-colors hover:bg-[color-mix(in_srgb,var(--mx-green)_15%,var(--mx-cream))] hover:text-[var(--mx-ink)]"
        >
          Vault
        </Link>
      </nav>
    </div>
  );
}
