"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBackendUser } from "@/hooks/useBackendUser";

export default function EntrarPage() {
  const router = useRouter();
  const { setUserId, setDisplayName, setPhone, setEmail } = useBackendUser();
  const [email, setEmailField] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo iniciar sesión");
        return;
      }
      setUserId(data.userId);
      setDisplayName(data.name || null);
      if (data.email) setEmail(data.email);
      if (data.phone) setPhone(data.phone);
      else setPhone(null);
      router.push("/perfil");
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-[var(--mx-cream-warm)] bg-white px-4 py-3 text-[var(--mx-ink)] shadow-sm placeholder:text-[var(--mx-fg-muted)] focus:border-[var(--mx-green)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-green)]/20 sm:py-3.5";

  return (
    <div className="mx-auth-page w-full flex-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="relative mx-header-auth w-full overflow-hidden rounded-b-3xl px-4 py-4 shadow-md sm:px-8 lg:px-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-30 mx-auth-header-glow"
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-4xl items-center gap-3">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20"
            aria-label="Volver al inicio"
          >
            ←
          </Link>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            Iniciar sesión
          </h1>
        </div>
      </div>

      <div className="relative -mt-2 w-full flex-1 rounded-t-3xl border border-[var(--mx-cream-warm)]/80 bg-[var(--mx-cream)] px-4 pb-10 pt-10 shadow-[0_-4px_24px_rgba(42,33,28,0.06)] sm:px-8 sm:pt-12 lg:px-12">
        <div className="mx-auto w-full max-w-xl lg:max-w-2xl">
          <p className="text-center text-4xl sm:text-5xl" aria-hidden>
            🔐
          </p>
          <h2 className="mt-3 text-center text-xl font-bold text-[var(--mx-ink)] sm:text-2xl">
            Bienvenido de vuelta
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-[var(--mx-brown)] sm:text-base">
            Usa el <strong className="text-[var(--mx-ink)]">mismo correo</strong>{" "}
            con el que te registraste y tu{" "}
            <strong className="text-[var(--mx-ink)]">contraseña</strong>.
          </p>

          <form onSubmit={onSubmit} className="mx-auto mt-8 w-full space-y-5">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mx-brown-light)]">
                Correo electrónico
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                className={fieldClass}
                value={email}
                onChange={(e) => setEmailField(e.target.value)}
                placeholder="tu@correo.com"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mx-brown-light)]">
                Contraseña
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                className={fieldClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            {error && (
              <p className="mx-error-box rounded-xl px-4 py-3 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[var(--mx-green)] py-3.5 text-base font-bold text-white shadow-lg shadow-[var(--mx-ink)]/10 transition hover:bg-[var(--mx-green-hover)] active:scale-[0.99] disabled:opacity-60 sm:py-4"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[var(--mx-brown)]">
            ¿No tienes cuenta?{" "}
            <Link
              href="/registro"
              className="font-semibold text-[var(--mx-green)] hover:text-[var(--mx-green-hover)] hover:underline"
            >
              Crear cuenta
            </Link>
          </p>
          <p className="mt-4 text-center text-xs text-[var(--mx-fg-muted)] sm:text-sm">
            ¿Primera vez?{" "}
            <Link
              href="/onboarding"
              className="font-medium text-[var(--mx-red-soft)] underline decoration-[var(--mx-red-soft)]/40 underline-offset-2 hover:text-[var(--mx-red)]"
            >
              Ver introducción
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
