"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MaceteroLogo } from "@/components/MaceteroLogo";

const nav = [
  { href: "/", label: "Inicio" },
  { href: "/tandas", label: "Tandas" },
  { href: "/liga", label: "Liga" },
  { href: "/perfil", label: "Perfil" },
] as const;

/** Rutas de bienvenida / auth: pantalla completa en web, sin caja max-w-5xl */
const ENTRY_FLOW = /^\/(onboarding|registro|entrar)(\/|$)/;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const entryFlow = ENTRY_FLOW.test(pathname);

  return (
    <div
      className={`flex min-h-dvh flex-col ${
        entryFlow ? "" : "bg-[var(--mx-cream)] text-[var(--mx-ink)]"
      }`}
    >
      {!entryFlow && (
        <header className="sticky top-0 z-40 border-b border-[var(--mx-brown)]/25 bg-[var(--mx-bg)] text-white shadow-sm">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
            <Link
              href="/"
              className="block shrink-0 text-white transition hover:opacity-90"
              aria-label="Inicio"
            >
              <MaceteroLogo
                variant="full"
                tone="light"
                className="h-10 w-auto max-h-[2.75rem] sm:h-11 sm:max-h-[3rem]"
                priority
              />
            </Link>
            <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
              {nav.map(({ href, label }) => {
                const active =
                  href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--mx-green)]/90 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
      )}
      <div
        className={
          entryFlow
            ? "flex min-h-0 w-full flex-1 flex-col"
            : "mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8 lg:px-6"
        }
      >
        {children}
      </div>
    </div>
  );
}
