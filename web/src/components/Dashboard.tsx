"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBackendUser } from "@/hooks/useBackendUser";
import { TandaPreviewList } from "@/components/TandaPreviewList";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function Dashboard() {
  const { contractId, balance, refreshBalance, disconnect } = useWallet();
  const { displayName, userId, hydrated } = useBackendUser();
  const [profile, setProfile] = useState<{
    streak: number;
    score: number;
    level: string;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    fetch(`/api/user/profile?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setProfile({
          streak: d.streak ?? 0,
          score: d.score ?? 0,
          level: d.level ?? "BASICO",
        });
      })
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [userId]);

  const short = contractId
    ? `${contractId.slice(0, 6)}…${contractId.slice(-4)}`
    : "";

  const quickLink =
    "flex flex-col items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--mx-brown)_18%,transparent)] bg-white p-4 text-center shadow-sm transition hover:border-[var(--mx-green)]/40 hover:shadow";

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[var(--mx-brown)]">
          {greeting()}
          {displayName ? `, ${displayName}` : ""}{" "}
          <span aria-hidden>👋</span>
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--mx-ink)] sm:text-3xl">
          Tu saldo
        </h1>
        <div className="mx-card-solid mt-4 p-5">
          <p className="text-sm font-medium text-[var(--mx-fg-muted)]">
            Smart account (testnet)
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums text-[var(--mx-green)]">
              {balance ?? "—"}
            </span>
            <span className="text-lg text-[var(--mx-fg-muted)]">XLM</span>
            <button
              type="button"
              onClick={() => refreshBalance()}
              className="ml-auto text-sm font-medium text-[var(--mx-green)] underline-offset-2 hover:underline"
            >
              Actualizar
            </button>
          </div>
          <p className="mt-2 break-all font-mono text-xs text-[var(--mx-brown-light)]">
            {short}
          </p>
          <button
            type="button"
            onClick={() => disconnect()}
            className="mt-3 text-sm text-[var(--mx-red)] hover:underline"
          >
            Desconectar passkey
          </button>
        </div>
      </section>

      {hydrated && userId && (
        <section
          className="rounded-2xl border border-[color-mix(in_srgb,var(--mx-green)_25%,transparent)] bg-[var(--mx-bg)] px-4 py-4 text-white shadow-md sm:px-6"
          aria-label="Progreso en la liga"
        >
          {profileLoading || !profile ? (
            <p className="text-sm text-white/70">Cargando tu progreso…</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl" aria-hidden>
                🔥
              </span>
              <div>
                <p className="font-semibold">
                  {profile.streak > 0
                    ? `${profile.streak} semanas de racha`
                    : "Empieza tu racha pagando a tiempo"}
                </p>
                <p className="text-sm text-white/75">
                  Nivel {profile.level} · {profile.score} pts en la liga
                </p>
              </div>
              <Link
                href="/liga"
                className="ml-auto rounded-lg bg-[var(--mx-green)]/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--mx-green-hover)]"
              >
                Ver liga
              </Link>
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-[var(--mx-ink)]">Acciones rápidas</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/receive" className={quickLink}>
            <span className="text-2xl" aria-hidden>
              💰
            </span>
            <span className="mt-2 text-sm font-semibold text-[var(--mx-ink)]">
              Guardar
            </span>
            <span className="text-xs text-[var(--mx-fg-muted)]">Recibir / ingresar</span>
          </Link>
          <Link href="/send" className={quickLink}>
            <span className="text-2xl" aria-hidden>
              📤
            </span>
            <span className="mt-2 text-sm font-semibold text-[var(--mx-ink)]">
              Retirar
            </span>
            <span className="text-xs text-[var(--mx-fg-muted)]">Retiro vía Etherfuse</span>
          </Link>
          <Link href="/tandas" className={quickLink}>
            <span className="text-2xl" aria-hidden>
              👥
            </span>
            <span className="mt-2 text-sm font-semibold text-[var(--mx-ink)]">
              Tandas
            </span>
            <span className="text-xs text-[var(--mx-fg-muted)]">Crear o unirse</span>
          </Link>
          <Link href="/liga" className={quickLink}>
            <span className="text-2xl" aria-hidden>
              🏆
            </span>
            <span className="mt-2 text-sm font-semibold text-[var(--mx-ink)]">
              Liga
            </span>
            <span className="text-xs text-[var(--mx-fg-muted)]">Puntos y nivel</span>
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--mx-ink)]">
            Mis tandas activas
          </h2>
          <Link
            href="/tandas"
            className="text-sm font-medium text-[var(--mx-green)] hover:text-[var(--mx-green-hover)] hover:underline"
          >
            Ver todas
          </Link>
        </div>
        <div className="mt-3">
          <TandaPreviewList userId={userId} />
        </div>
      </section>

      <p className="text-center text-xs text-[var(--mx-brown-light)]">
        Los montos en MXN y rampa fiat se integran vía Etherfuse; la passkey es
        testnet Soroban.
      </p>
    </div>
  );
}
