"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type TandaRow = {
  id: string;
  nombre: string;
  montoAportacion: number;
  frecuencia: string;
  numParticipantes: number;
  estado: string;
  periodoActual: number;
  miTurno: number;
  montoPremio: number;
  recaudado?: number;
  participantesInscritos?: number;
};

function freqLabel(f: string): string {
  if (f === "quincenal") return "quincena";
  if (f === "mensual") return "mes";
  return "semana";
}

function isTuTurnoRecepcion(t: TandaRow): boolean {
  return (
    t.estado === "activa" &&
    t.periodoActual > 0 &&
    t.miTurno === t.periodoActual
  );
}

export function TandaPreviewList({ userId }: { userId: string | null }) {
  const [items, setItems] = useState<TandaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch(`/api/tandas?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setErr(data.error);
          setItems([]);
          return;
        }
        setItems(data.tandas ?? []);
      })
      .catch(() => {
        if (!cancelled) setErr("No se pudieron cargar las tandas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) {
    return (
      <p className="mx-card rounded-xl border-dashed px-4 py-6 text-center text-sm text-[var(--mx-brown)]">
        Crea o inicia sesión en{" "}
        <Link href="/perfil" className="font-medium text-[var(--mx-green)] underline-offset-2 hover:underline">
          Perfil
        </Link>{" "}
        (correo y contraseña) para ver tus tandas activas.
      </p>
    );
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--mx-fg-muted)]">Cargando tandas…</p>
    );
  }

  if (err) {
    return <p className="text-sm text-[var(--mx-red)]">{err}</p>;
  }

  const activas = items.filter((t) => t.estado === "activa" || t.estado === "pendiente");

  if (activas.length === 0) {
    return (
      <p className="mx-card rounded-xl px-4 py-5 text-sm text-[var(--mx-brown)]">
        No tienes tandas pendientes o activas.{" "}
        <Link href="/tandas" className="font-medium text-[var(--mx-green)] underline-offset-2 hover:underline">
          Crear o unirse
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {activas.slice(0, 4).map((t) => {
        const tuTurno = isTuTurnoRecepcion(t);
        return (
          <li key={t.id}>
            <Link
              href={`/tandas/${t.id}`}
              className="mx-card-solid block rounded-2xl p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--mx-ink)]">{t.nombre}</p>
                  <p className="mt-1 text-sm text-[var(--mx-brown)]">
                    ${t.montoAportacion} / {freqLabel(t.frecuencia)} ·{" "}
                    {t.numParticipantes} personas
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {tuTurno ? (
                    <span className="mx-chip-ok px-2.5 py-0.5">¡Tu turno!</span>
                  ) : (
                    <span className="mx-chip-warn px-2.5 py-0.5">
                      Turno: {t.miTurno}
                    </span>
                  )}
                  <span className="text-xs capitalize text-[var(--mx-fg-muted)]">
                    {t.estado}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
