"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBackendUser } from "@/hooks/useBackendUser";

export default function RegistroPage() {
  const router = useRouter();
  const { setUserId, setDisplayName, setEmail } = useBackendUser();
  const [name, setName] = useState("");
  const [email, setEmailField] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear la cuenta");
        return;
      }
      setUserId(data.userId);
      setDisplayName(name.trim() || null);
      if (data.email) setEmail(data.email);
      try {
        localStorage.setItem("macetero_onboarding_done", "1");
      } catch {
        /* ignore */
      }
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
            href="/entrar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20"
            aria-label="Volver"
          >
            ←
          </Link>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            Crear cuenta
          </h1>
        </div>
      </div>

      <div className="relative -mt-2 w-full flex-1 rounded-t-3xl border border-[var(--mx-cream-warm)]/80 bg-[var(--mx-cream)] px-4 pb-10 pt-8 shadow-[0_-4px_24px_rgba(42,33,28,0.06)] sm:px-8 sm:pt-10 lg:px-12">
        <div className="mx-auto w-full max-w-xl lg:max-w-2xl">
          <p className="text-center text-3xl sm:text-4xl" aria-hidden>
            👋
          </p>
          <h2 className="mt-2 text-center text-xl font-bold text-[var(--mx-ink)] sm:text-2xl">
            ¡Hola! ¿Cómo te llamas?
          </h2>

          <form onSubmit={onSubmit} className="mx-auto mt-8 w-full space-y-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mx-brown-light)]">
              Tu nombre
            </span>
            <input
              type="text"
              autoComplete="name"
              className={fieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Rosa Martínez"
            />
          </label>
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
              Contraseña (mín. 6 caracteres)
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mx-brown-light)]">
              Confirmar contraseña
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
              className={fieldClass}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </label>

          <div className="mx-info-box rounded-2xl p-4 text-sm text-[var(--mx-ink)]">
            <p className="font-semibold text-[var(--mx-green)]">
              <span aria-hidden>🔒</span> Tu dinero protegido
            </p>
            <p className="mt-1 text-[var(--mx-brown)]">
              No compartas tu contraseña. Nadie de nuestro equipo de soporte te la pedirá por
              teléfono o correo.
            </p>
          </div>

          {error && (
            <p className="mx-error-box rounded-xl px-4 py-3 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[var(--mx-green)] py-3.5 text-base font-bold text-white shadow-lg shadow-[var(--mx-ink)]/10 transition hover:bg-[var(--mx-green-hover)] active:scale-[0.99] disabled:opacity-60 sm:py-4"
          >
            {loading ? "Creando…" : "Crear mi cuenta ✓"}
          </button>
        </form>

          <p className="mt-8 text-center text-sm text-[var(--mx-brown)]">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/entrar"
              className="font-semibold text-[var(--mx-green)] hover:text-[var(--mx-green-hover)] hover:underline"
            >
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
