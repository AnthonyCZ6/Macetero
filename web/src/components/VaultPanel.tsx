"use client";

import { useWallet } from "@/hooks/useWallet";

export function VaultPanel() {
  const { contractId, connected } = useWallet();

  if (!connected || !contractId) return null;

  const explorerUrl = `https://stellar.expert/explorer/testnet/contract/${contractId}`;

  return (
    <div className="mx-card-solid w-full max-w-md space-y-4 p-6">
      <h2 className="text-lg font-bold text-[var(--mx-ink)]">Vault Contract</h2>
      <p className="text-sm text-[var(--mx-fg-muted)]">
        Your smart account is a Soroban contract secured by passkeys.
      </p>

      <div className="space-y-2">
        <div>
          <span className="text-xs font-medium uppercase text-[var(--mx-brown-light)]">
            Contract ID
          </span>
          <p className="break-all font-mono text-sm text-[var(--mx-brown)]">
            {contractId}
          </p>
        </div>

        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-[var(--mx-green)] hover:text-[var(--mx-green-hover)] hover:underline"
        >
          View on Stellar Expert →
        </a>
      </div>

      <div className="mx-highlight rounded-lg p-4 text-sm text-[var(--mx-brown)]">
        Context rules, policies, and multi-signer management will be available
        here in a future update.
      </div>
    </div>
  );
}
