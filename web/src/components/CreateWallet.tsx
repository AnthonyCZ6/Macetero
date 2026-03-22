"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";

export function CreateWallet() {
  const { createWallet, loading } = useWallet();
  const [email, setEmail] = useState("");

  async function handleCreate() {
    if (!email.trim()) return;
    await createWallet(email.trim());
  }

  return (
    <div className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        className="w-full rounded-lg border border-[color-mix(in_srgb,var(--mx-brown-light)_40%,transparent)] bg-white px-4 py-2 text-sm text-[var(--mx-ink)] placeholder:text-[var(--mx-fg-muted)] focus:border-[var(--mx-green)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-green)]/20"
      />
      <button
        onClick={handleCreate}
        disabled={loading || !email.trim()}
        className="w-full cursor-pointer rounded-xl bg-[var(--mx-green)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[var(--mx-green-hover)] disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create Wallet"}
      </button>
    </div>
  );
}
