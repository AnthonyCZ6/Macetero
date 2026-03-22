"use client";

import Link from "next/link";
import { SendForm } from "@/components/SendForm";
import { useWallet } from "@/hooks/useWallet";

export default function SendPage() {
  const { connected } = useWallet();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold text-[var(--mx-ink)]">Retirar dinero</h1>
      <p className="mb-6 max-w-md text-center text-sm text-[var(--mx-brown)]">
        Los retiros a pesos mexicanos se procesan con{" "}
        <span className="font-medium text-[var(--mx-ink)]">Etherfuse</span>.
      </p>
      {connected ? (
        <SendForm />
      ) : (
        <p className="text-[var(--mx-fg-muted)]">
          Conecta tu passkey en Inicio para continuar.
        </p>
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
