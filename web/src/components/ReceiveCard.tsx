"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { useWallet } from "@/hooks/useWallet";

export function ReceiveCard() {
  const { contractId } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!contractId) return null;

  async function copy() {
    await navigator.clipboard.writeText(contractId!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-card-solid flex w-full max-w-md flex-col items-center space-y-6 p-6">
      <h2 className="text-lg font-bold text-[var(--mx-ink)]">Receive</h2>
      <p className="text-center text-sm text-[var(--mx-fg-muted)]">
        Send XLM or tokens to this address
      </p>

      <div className="rounded-xl bg-white p-4">
        <QRCode value={contractId} size={200} />
      </div>

      <button
        onClick={copy}
        className="w-full cursor-pointer break-all rounded-lg border border-[var(--mx-cream-warm)] bg-[color-mix(in_srgb,var(--mx-cream)_50%,white)] py-2 font-mono text-sm text-[var(--mx-ink)] transition-colors hover:border-[var(--mx-green)]/40 hover:bg-[color-mix(in_srgb,var(--mx-green)_8%,var(--mx-cream))]"
      >
        {copied ? "Copied!" : contractId}
      </button>
    </div>
  );
}
