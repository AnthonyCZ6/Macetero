"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaceteroLogo } from "@/components/MaceteroLogo";

const STORAGE_KEY = "macetero_onboarding_done";

const slides = [
  {
    icon: "🤝",
    title: "Tandas sin trampa",
    body: "Organiza o únete a una tanda digital. Tu dinero protegido, tus pagos con registro claro.",
  },
  {
    icon: "💰",
    title: "Ahorra fácil",
    body: "Guarda y retira cuando quieras. Integración con rampa y billetera en Stellar (testnet).",
  },
  {
    icon: "📈",
    title: "Accede a crédito",
    body: "Mientras cumples, tu nivel sube en la liga y mejora tu confianza para más oportunidades.",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    router.push("/");
  }

  function next() {
    if (step < slides.length - 1) {
      setStep((s) => s + 1);
    } else {
      router.push("/registro");
    }
  }

  const s = slides[step];

  return (
    <div className="mx-screen-onboarding relative flex min-h-dvh w-full flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mx-onboarding-glow"
        aria-hidden
      />
      <header className="relative z-10 flex w-full shrink-0 items-center justify-between gap-4 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
        <Link
          href="/"
          className="block shrink-0 text-white/90 transition hover:text-white"
          aria-label="Inicio"
        >
          <MaceteroLogo variant="full" tone="light" className="h-7 w-auto min-w-[8rem] sm:h-8 sm:min-w-[9rem]" />
        </Link>
        <Link
          href="/entrar"
          className="rounded-full px-3 py-1.5 text-sm font-medium text-white/80 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white"
        >
          Entrar
        </Link>
      </header>

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-8 pt-4 sm:px-10 lg:max-w-4xl lg:px-16">
        <p className="text-5xl drop-shadow-sm sm:text-6xl md:text-7xl" aria-hidden>
          {s.icon}
        </p>
        <h1 className="mt-6 max-w-2xl text-center text-2xl font-bold tracking-tight sm:mt-8 sm:text-3xl lg:text-4xl">
          {s.title}
        </h1>
        <p className="mt-3 max-w-2xl text-center text-sm leading-relaxed text-white/75 sm:mt-4 sm:text-base lg:text-lg">
          {s.body}
        </p>
      </div>

      <div className="relative flex justify-center gap-2 pb-4">
        {slides.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === step
                ? "w-8 bg-[var(--mx-green-muted)]"
                : "w-2 bg-white/25"
            }`}
            aria-hidden
          />
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-md space-y-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:px-8 lg:max-w-xl">
        <button
          type="button"
          onClick={next}
          className="w-full rounded-2xl bg-[var(--mx-green)] py-3.5 text-base font-bold text-white shadow-lg shadow-black/25 transition hover:bg-[var(--mx-green-hover)] active:scale-[0.99] sm:py-4"
        >
          {step < slides.length - 1 ? "Siguiente →" : "Crear cuenta"}
        </button>
        <button
          type="button"
          onClick={finish}
          className="w-full py-2 text-center text-sm text-white/55 transition hover:text-white/90"
        >
          Omitir
        </button>
        <p className="text-center text-xs text-white/45 sm:text-sm">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/entrar"
            className="font-medium text-[var(--mx-red-soft)] underline decoration-[var(--mx-red-soft)]/50 underline-offset-2 transition hover:text-[var(--mx-cream-warm)]"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
