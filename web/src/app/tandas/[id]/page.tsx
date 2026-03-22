"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useBackendUser } from "@/hooks/useBackendUser";

type Detail = {
  id: string;
  nombre: string;
  montoAportacion: number;
  frecuencia: string;
  numParticipantes: number;
  estado: string;
  periodoActual: number;
  codigoInvitacion: string;
  montoPremio: number;
  participants: Array<{
    userId: string;
    name: string;
    turno: number;
    estadoTurno: string;
    pagoActual: { estado: string; montoTotal: number } | null;
  }>;
  periodos: Array<{
    periodo: number;
    pagados: number;
    total: number;
    completo: boolean;
  }>;
};

export default function TandaDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { userId } = useBackendUser();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    fetch(`/api/tandas/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (c) return;
        if (d.error) setErr(d.error);
        else setData(d);
      })
      .catch(() => setErr("Error de red"));
    return () => {
      c = true;
    };
  }, [id]);

  async function pagar() {
    if (!userId) return;
    setPayMsg(null);
    const res = await fetch(`/api/tandas/${id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const j = await res.json();
    if (!res.ok) {
      setPayMsg(j.error || "Error");
      return;
    }
    setPayMsg(`Pago registrado. Tx: ${j.txHash?.slice(0, 16)}…`);
    const refresh = await fetch(`/api/tandas/${id}`).then((r) => r.json());
    if (!refresh.error) setData(refresh);
  }

  if (err || !data) {
    return (
      <div>
        <Link href="/tandas" className="text-sm font-medium text-[var(--mx-green)] hover:text-[var(--mx-green-hover)] hover:underline">
          ← Volver
        </Link>
        <p className="mt-4 text-red-600">{err || "Cargando…"}</p>
      </div>
    );
  }

  const miParticipacion = data.participants.find((p) => p.userId === userId);
  const puedoPagar =
    userId &&
    data.estado === "activa" &&
    miParticipacion?.pagoActual?.estado !== "pagado";

  return (
    <div className="space-y-6">
      <Link href="/tandas" className="text-sm font-medium text-[var(--mx-green)] hover:text-[var(--mx-green-hover)] hover:underline">
        ← Tandas
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-[var(--mx-ink)]">{data.nombre}</h1>
        <p className="mt-1 text-[var(--mx-brown)]">
          ${data.montoAportacion} · {data.frecuencia} · {data.numParticipantes}{" "}
          personas · <span className="capitalize">{data.estado}</span>
        </p>
        <p className="mt-2 text-sm text-[var(--mx-fg-muted)]">
          Código:{" "}
          <code className="rounded bg-[color-mix(in_srgb,var(--mx-cream-warm)_60%,white)] px-1 text-[var(--mx-ink)]">
            {data.codigoInvitacion}
          </code>{" "}
          · Premio por turno:{" "}
          <strong className="text-[var(--mx-green)]">${data.montoPremio}</strong>
        </p>
      </div>

      {!userId && data.estado === "activa" && (
        <p className="mx-highlight rounded-xl px-4 py-3 text-sm">
          Para pagar tu aportación,{" "}
          <Link href="/perfil" className="font-medium text-[var(--mx-green)] underline">
            inicia sesión en Perfil
          </Link>{" "}
          con el mismo correo con el que te uniste a la tanda.
        </p>
      )}
      {puedoPagar && (
        <button
          type="button"
          onClick={() => pagar()}
          className="rounded-xl bg-[var(--mx-green)] px-4 py-3 font-semibold text-white hover:bg-[var(--mx-green-hover)]"
        >
          Pagar aportación del periodo {data.periodoActual}
        </button>
      )}
      {payMsg && <p className="text-sm text-[var(--mx-brown)]">{payMsg}</p>}

      <section>
        <h2 className="font-semibold text-[var(--mx-ink)]">Participantes</h2>
        <ul className="mt-2 divide-y divide-[var(--mx-cream-warm)] rounded-xl border border-[var(--mx-cream-warm)] bg-white">
          {data.participants.map((p) => (
            <li
              key={p.userId}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <span>
                {p.name}{" "}
                {p.userId === userId && (
                  <span className="text-[var(--mx-green)]">(tú)</span>
                )}
              </span>
              <span className="text-[var(--mx-fg-muted)]">Turno {p.turno}</span>
              {p.pagoActual && (
                <span
                  className={
                    p.pagoActual.estado === "pagado"
                      ? "text-[var(--mx-green)]"
                      : "text-[var(--mx-red-soft)]"
                  }
                >
                  {p.pagoActual.estado}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-[var(--mx-ink)]">Periodos</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.periodos.map((p) => (
            <span
              key={p.periodo}
              className={`rounded-lg px-2 py-1 text-xs font-medium ${
                p.completo
                  ? "bg-[color-mix(in_srgb,var(--mx-green)_22%,var(--mx-cream))] text-[var(--mx-ink)]"
                  : "bg-[color-mix(in_srgb,var(--mx-cream-warm)_70%,white)] text-[var(--mx-brown)]"
              }`}
            >
              P{p.periodo}: {p.pagados}/{p.total}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
