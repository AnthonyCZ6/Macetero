"use client";

import Link from "next/link";
import { ReceiveCard } from "@/components/ReceiveCard";
import { useWallet } from "@/hooks/useWallet";

export default function ReceivePage() {
  const { connected } = useWallet();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      {connected ? (
        <ReceiveCard />
      ) : (
        <p className="text-[var(--mx-fg-muted)]">Conecta tu billetera primero.</p>
      )}
      <Link
        href="/"
        className="mt-6 text-sm font-medium text-[var(--mx-green)] hover:text-[var(--mx-green-hover)] hover:underline"
      >
        ← Volver al inicio
      </Link>
    </main>
  );
}
