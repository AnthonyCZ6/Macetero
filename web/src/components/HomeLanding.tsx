"use client";

import { CreateWallet } from "@/components/CreateWallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import Link from "next/link";

export function HomeLanding() {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-8 text-center">
      <h1 className="text-2xl font-bold text-[var(--mx-ink)] sm:text-3xl">
        Billetera con passkey
      </h1>
      <p className="text-[var(--mx-brown)]">
        Crea o conecta tu cuenta segura en Stellar (testnet). Para tandas y
        liga,{" "}
        <Link href="/registro" className="font-medium text-[var(--mx-green)] underline-offset-2 hover:underline">
          crea tu cuenta
        </Link>{" "}
        con correo y contraseña o{" "}
        <Link href="/entrar" className="font-medium text-[var(--mx-green)] underline-offset-2 hover:underline">
          inicia sesión
        </Link>
        . También puedes ver la{" "}
        <Link href="/onboarding" className="font-medium text-[var(--mx-red-soft)] underline-offset-2 hover:underline">
          introducción
        </Link>
        .
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/onboarding"
          className="rounded-xl bg-[var(--mx-bg)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--mx-bg-soft)]"
        >
          Ver intro
        </Link>
        <Link
          href="/entrar"
          className="rounded-xl bg-[var(--mx-green)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--mx-green-hover)]"
        >
          Entrar
        </Link>
      </div>
      <div className="mx-card space-y-3 p-5 pt-6">
        <CreateWallet />
        <ConnectWallet />
      </div>
    </div>
  );
}
