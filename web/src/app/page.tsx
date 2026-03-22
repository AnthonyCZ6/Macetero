"use client";

import { Dashboard } from "@/components/Dashboard";
import { HomeLanding } from "@/components/HomeLanding";
import { useWallet } from "@/hooks/useWallet";

export default function Home() {
  const { connected, loading, error } = useWallet();

  if (loading && !connected) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--mx-fg-muted)]">
        Cargando sesión…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="mx-error-box rounded-xl px-4 py-3 text-sm">
          {error}
        </p>
      )}
      {!connected ? <HomeLanding /> : <Dashboard />}
    </div>
  );
}
