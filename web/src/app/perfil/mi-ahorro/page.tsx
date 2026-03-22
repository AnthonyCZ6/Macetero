"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useBackendUser } from "@/hooks/useBackendUser";
import { MiAhorroSection } from "@/components/MiAhorroSection";

export default function MiAhorroPage() {
  const router = useRouter();
  const { userId, hydrated } = useBackendUser();

  useEffect(() => {
    if (hydrated && !userId) {
      router.replace("/entrar");
    }
  }, [hydrated, userId, router]);

  if (!hydrated) {
    return (
      <p className="py-12 text-center text-[var(--mx-fg-muted)]">Cargando…</p>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="mx-auto max-w-md pb-12">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/perfil"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--mx-brown)_18%,transparent)] bg-white text-lg font-medium text-[var(--mx-ink)] shadow-sm transition hover:border-[var(--mx-green)]/35"
          aria-label="Volver a perfil"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--mx-ink)]">
            Mi ahorro
          </h1>
          <p className="text-xs text-[var(--mx-fg-muted)]">
            Saldo en MXN y movimientos
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-[color-mix(in_srgb,var(--mx-cream)_88%,white)] p-3 shadow-inner ring-1 ring-[color-mix(in_srgb,var(--mx-brown)_8%,transparent)] sm:p-4">
        <MiAhorroSection userId={userId} />
      </div>
    </div>
  );
}
