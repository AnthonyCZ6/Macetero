"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBackendUser } from "@/hooks/useBackendUser";
import { levelDisplayName, maxTandasLabel } from "@/lib/tanda-limits";
import { MaceteroLogo } from "@/components/MaceteroLogo";
import { ActaApiKeySection } from "@/components/ActaApiKeySection";
import type { ReactNode } from "react";

function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function MenuRow({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--mx-brown)_14%,transparent)] bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-[var(--mx-green)]/30 hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--mx-red-soft)_18%,var(--mx-cream))] text-lg shadow-inner">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--mx-ink)]">{title}</p>
        <p className="text-xs text-[var(--mx-fg-muted)]">{subtitle}</p>
      </div>
      <span className="shrink-0 text-[var(--mx-cream-warm)]" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export default function PerfilPage() {
  const {
    userId,
    displayName,
    phone,
    email,
    setEmail,
    clearSession,
    hydrated,
  } = useBackendUser();

  const [profile, setProfile] = useState<{
    level: string;
    score: number;
    streak: number;
    activeTandas: number;
    maxTandas: number | null;
    ligaRank: number;
    deudaActual: number;
    punctualityPercent: number;
  } | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/user/profile?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || d.error) return;
        setProfile({
          level: d.level ?? "BASICO",
          score: d.score ?? 0,
          streak: d.streak ?? 0,
          activeTandas: d.activeTandasCount ?? 0,
          maxTandas: d.maxSimultaneousTandas ?? null,
          ligaRank: d.ligaRank ?? 1,
          deudaActual: d.deudaActual ?? 0,
          punctualityPercent: d.punctualityPercent ?? 0,
        });
        if (d.email && typeof d.email === "string") {
          setEmail(d.email);
        }
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, setEmail]);

  if (!hydrated) {
    return (
      <p className="py-12 text-center text-[var(--mx-fg-muted)]">Cargando…</p>
    );
  }

  if (userId) {
    const initials = initialsFromName(displayName || email || phone);
    const contactDisplay =
      email?.trim() || phone?.trim() || "—";

    return (
      <div className="pb-16">
        <div className="relative -mx-4 -mt-2 overflow-hidden rounded-b-[2rem] bg-[var(--mx-bg)] px-4 pb-28 pt-8 text-center text-white shadow-lg sm:-mx-0 sm:rounded-3xl">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 to-transparent"
            aria-hidden
          />
          <div className="relative mx-auto flex max-w-md flex-col items-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[var(--mx-green)] to-[var(--mx-green-hover)] text-2xl font-bold text-white shadow-lg ring-4 ring-white/10">
              {initials}
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">
              {displayName || "Participante"}
            </h1>
            <p className="mt-1 text-sm text-white/80">{contactDisplay}</p>
            {profile && (
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--mx-green)_35%,transparent)] px-4 py-1.5 text-sm font-medium text-white ring-1 ring-white/15">
                <span aria-hidden>⭐</span>
                {levelDisplayName(profile.level)}
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 -mt-16 mx-auto max-w-md px-2">
          {profile && (
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/95 p-2 shadow-xl ring-1 ring-[var(--mx-cream-warm)] backdrop-blur">
              <div className="rounded-xl bg-white px-2 py-4 text-center shadow-sm">
                <p className="text-2xl font-bold tabular-nums text-[var(--mx-ink)]">
                  {profile.activeTandas}
                </p>
                <p className="mt-1 text-[10px] font-medium leading-tight text-[var(--mx-fg-muted)] sm:text-xs">
                  Tandas activas
                </p>
              </div>
              <div className="rounded-xl bg-white px-2 py-4 text-center shadow-sm">
                <p className="text-2xl font-bold tabular-nums text-[var(--mx-green)]">
                  {profile.punctualityPercent}%
                </p>
                <p className="mt-1 text-[10px] font-medium leading-tight text-[var(--mx-fg-muted)] sm:text-xs">
                  Puntualidad
                </p>
              </div>
              <div className="rounded-xl bg-white px-2 py-4 text-center shadow-sm">
                <p className="text-xl font-bold tabular-nums text-[var(--mx-ink)]">
                  {profile.deudaActual > 0
                    ? mxn.format(profile.deudaActual)
                    : mxn.format(0)}
                </p>
                <p className="mt-1 text-[10px] font-medium leading-tight text-[var(--mx-fg-muted)] sm:text-xs">
                  Deuda actual
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2 rounded-3xl bg-[color-mix(in_srgb,var(--mx-cream)_85%,white)] p-2 pb-8">
            <MenuRow
              href="/perfil/mi-ahorro"
              icon={<span aria-hidden>💰</span>}
              title="Mi ahorro"
              subtitle="Saldo, movimientos y referencia XLM"
            />
            <ActaApiKeySection userId={userId} />
            <MenuRow
              href="/liga"
              icon={<span aria-hidden>🏆</span>}
              title={
                <span className="inline-flex items-center gap-2">
                  Liga
                  <MaceteroLogo variant="mark" tone="dark" className="h-5 w-auto max-w-[4.5rem] shrink-0" />
                </span>
              }
              subtitle={
                profile
                  ? `#${profile.ligaRank} en la tabla · 🔥 ${profile.streak} semanas`
                  : "Ranking y puntos"
              }
            />
            <div className="flex w-full cursor-not-allowed items-center gap-3 rounded-2xl border border-dashed border-[var(--mx-cream-warm)] bg-white/80 px-4 py-3.5 opacity-90">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--mx-red-soft)_15%,var(--mx-cream))] text-lg">
                🔔
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--mx-ink)]">Notificaciones</p>
                <p className="text-xs text-[var(--mx-fg-muted)]">Próximamente en la web</p>
              </div>
              <span className="text-[var(--mx-cream-warm)]">›</span>
            </div>
            <div className="flex w-full cursor-not-allowed items-center gap-3 rounded-2xl border border-dashed border-[var(--mx-cream-warm)] bg-white/80 px-4 py-3.5 opacity-90">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--mx-red-soft)_15%,var(--mx-cream))] text-lg">
                🔒
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--mx-ink)]">Seguridad</p>
                <p className="text-xs text-[var(--mx-fg-muted)]">Contraseña y verificación</p>
              </div>
              <span className="text-[var(--mx-cream-warm)]">›</span>
            </div>
            <MenuRow
              href="/tandas"
              icon={<span aria-hidden>📚</span>}
              title="Educación financiera"
              subtitle="Tandas y buenas prácticas"
            />
            <MenuRow
              href="/"
              icon={<span aria-hidden>💻</span>}
              title="Tecnología"
              subtitle="Cómo funciona la app y la billetera"
            />

            <button
              type="button"
              onClick={() => {
                clearSession();
                setProfile(null);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--mx-red)_25%,transparent)] bg-white px-4 py-3.5 text-left shadow-sm transition hover:bg-[color-mix(in_srgb,var(--mx-red)_6%,white)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--mx-red)_12%,var(--mx-cream))] text-lg">
                🚪
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--mx-red)]">Cerrar sesión</p>
                <p className="text-xs text-[var(--mx-fg-muted)]">Hasta pronto</p>
              </div>
              <span className="text-[var(--mx-cream-warm)]">›</span>
            </button>
          </div>

          {profile && (
            <p className="mx-auto mt-6 max-w-sm px-2 text-center text-xs text-[var(--mx-fg-muted)]">
              Cupo tandas:{" "}
              {profile.maxTandas === null
                ? `${profile.activeTandas} activas (sin tope)`
                : `${profile.activeTandas}/${profile.maxTandas} (${maxTandasLabel(profile.level)})`}
              . ID:{" "}
              <span className="font-mono text-[10px] text-[var(--mx-brown-light)] break-all">
                {userId}
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-3xl bg-[color-mix(in_srgb,var(--mx-cream)_90%,white)] px-2 py-6 sm:px-0">
      <div className="rounded-3xl bg-[var(--mx-bg)] px-6 py-10 text-center text-white shadow-lg">
        <div className="flex justify-center">
          <MaceteroLogo variant="full" tone="light" className="h-10 w-auto max-w-[min(100%,14rem)]" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Tu cuenta</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-white/80">
          Entra con el <strong>correo</strong> con el que te registraste y tu{" "}
          <strong>contraseña</strong>.
        </p>
      </div>

      <div className="flex flex-col gap-3 px-2">
        <Link
          href="/entrar"
          className="rounded-2xl bg-[var(--mx-green)] py-4 text-center text-base font-bold text-white shadow-md transition hover:bg-[var(--mx-green-hover)]"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/registro"
          className="rounded-2xl border-2 border-[var(--mx-bg)] bg-white py-4 text-center text-base font-bold text-[var(--mx-bg)] transition hover:bg-[color-mix(in_srgb,var(--mx-cream)_50%,white)]"
        >
          Crear cuenta
        </Link>
        <Link
          href="/onboarding"
          className="py-3 text-center text-sm text-[var(--mx-brown)] underline-offset-2 hover:underline"
        >
          Ver introducción (3 pasos)
        </Link>
      </div>
    </div>
  );
}
