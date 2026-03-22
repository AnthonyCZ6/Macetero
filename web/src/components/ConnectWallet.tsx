"use client";

import { useWallet } from "@/hooks/useWallet";

export function ConnectWallet() {
  const { connectWallet, loading } = useWallet();

  return (
    <button
      onClick={connectWallet}
      disabled={loading}
      className="w-full cursor-pointer rounded-xl border-2 border-[var(--mx-green)] px-6 py-3 font-semibold text-[var(--mx-green)] transition-colors hover:bg-[color-mix(in_srgb,var(--mx-green)_10%,var(--mx-cream))] disabled:opacity-50"
    >
      {loading ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
