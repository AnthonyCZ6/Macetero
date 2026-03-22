"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useBackendUser } from "@/hooks/useBackendUser";
import type { TandaRow } from "@/components/TandaPreviewList";
import { levelDisplayName, maxTandasLabel } from "@/lib/tanda-limits";

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function freqSuffix(f: string): string {
  if (f === "quincenal") return "quincena";
  if (f === "mensual") return "mes";
  return "semana";
}

function applyCupoFromProfilePayload(
  d: {
    level?: string;
    activeTandasCount?: number;
    maxSimultaneousTandas?: number | null;
  },
  setCupo: React.Dispatch<
    React.SetStateAction<{
      level: string;
      active: number;
      max: number | null;
    } | null>
  >
) {
  setCupo({
    level: d.level ?? "BASICO",
    active: d.activeTandasCount ?? 0,
    max: d.maxSimultaneousTandas ?? null,
  });
}

function TandaCard({ t }: { t: TandaRow }) {
  const isCompleta = t.estado === "completada";
  const isActiva = t.estado === "activa";
  const isPendiente = t.estado === "pendiente";
  const inscritos = t.participantesInscritos ?? 0;
  const recaudado = t.recaudado ?? 0;

  let progressPct = 0;
  if (isPendiente && t.numParticipantes > 0) {
    progressPct = Math.min(100, (inscritos / t.numParticipantes) * 100);
  } else if (isActiva && t.numParticipantes > 0) {
    progressPct = Math.min(
      100,
      (t.periodoActual / t.numParticipantes) * 100
    );
  } else if (isCompleta) {
    progressPct = 100;
  }

  return (
    <Link
      href={`/tandas/${t.id}`}
      className="mx-card-solid block rounded-2xl p-4 shadow-md transition hover:border-[var(--mx-green)]/35 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-[var(--mx-ink)]">{t.nombre}</h3>
        {isCompleta ? (
          <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--mx-green)_22%,var(--mx-cream))] px-2.5 py-0.5 text-xs font-semibold text-[var(--mx-ink)]">
            ✓ Completa
          </span>
        ) : isPendiente ? (
          <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--mx-red-soft)_22%,var(--mx-cream))] px-2.5 py-0.5 text-xs font-semibold text-[var(--mx-brown)]">
            En formación
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--mx-green)_22%,var(--mx-cream))] px-2.5 py-0.5 text-xs font-semibold text-[var(--mx-ink)]">
            Turno: {t.miTurno}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-[var(--mx-fg-muted)]">
        {t.numParticipantes} personas · {mxn.format(t.montoAportacion)}/
        {freqSuffix(t.frecuencia)}
      </p>

      {!isCompleta && (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--mx-cream-warm)_80%,white)]">
            <div
              className="h-full rounded-full bg-[var(--mx-green)] transition-[width]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-[var(--mx-fg-muted)]">
            {isActiva ? (
              <span>
                Semana {t.periodoActual} de {t.numParticipantes}
              </span>
            ) : (
              <span>
                {inscritos}/{t.numParticipantes} personas unidas
              </span>
            )}
            {!isPendiente && (
              <span className="font-medium text-[var(--mx-green)]">
                {mxn.format(recaudado)} recaudado
              </span>
            )}
            {isPendiente && (
              <span className="text-[var(--mx-brown-light)]">—</span>
            )}
          </div>
        </>
      )}
      {isCompleta && (
        <p className="mt-3 text-sm font-semibold text-[var(--mx-green)]">
          {recaudado > 0
            ? `${mxn.format(recaudado)} recaudado en total`
            : `${mxn.format(t.montoPremio)} por vuelta (sin pagos registrados)`}
        </p>
      )}
    </Link>
  );
}

export default function TandasPage() {
  const router = useRouter();
  const { userId, hydrated } = useBackendUser();
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("200");
  const [freq, setFreq] = useState("semanal");
  const [num, setNum] = useState("8");
  const [fecha, setFecha] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cupo, setCupo] = useState<{
    level: string;
    active: number;
    max: number | null;
  } | null>(null);
  const [lista, setLista] = useState<TandaRow[]>([]);
  const [listaLoading, setListaLoading] = useState(false);
  const [showAcciones, setShowAcciones] = useState(false);

  function refreshLista() {
    if (!userId) {
      setLista([]);
      return;
    }
    setListaLoading(true);
    fetch(`/api/tandas?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setLista(data.tandas ?? []);
      })
      .catch(() => setLista([]))
      .finally(() => setListaLoading(false));
  }

  useEffect(() => {
    if (!userId) {
      setCupo(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/user/profile?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || d.error) return;
        applyCupoFromProfilePayload(d, setCupo);
      })
      .catch(() => {
        if (!cancelled) setCupo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    refreshLista();
  }, [userId]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!userId) {
      setErr("Inicia sesión o crea tu cuenta en Perfil.");
      return;
    }
    const res = await fetch("/api/tandas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        nombre,
        monto_aportacion: parseFloat(monto),
        frecuencia: freq,
        num_participantes: parseInt(num, 10),
        fecha_inicio: fecha,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Error al crear");
      return;
    }
    setMsg(
      `Tanda creada. Código: ${data.codigoInvitacion}. Turno asignado: ${data.turnoAsignado}. Abriendo detalle…`
    );
    refreshLista();
    if (data.tandaId) {
      router.push(`/tandas/${data.tandaId}`);
    }
    fetch(`/api/user/profile?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        applyCupoFromProfilePayload(d, setCupo);
      })
      .catch(() => {});
  }

  async function unir(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!userId) {
      setErr("Inicia sesión o crea tu cuenta en Perfil.");
      return;
    }
    const res = await fetch("/api/tandas/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, codigo: codigo.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Error al unirse");
      return;
    }
    setMsg(
      `Te uniste. Turno ${data.turnoAsignado} de ${data.totalParticipantes}. Estado: ${data.estado}.`
    );
    refreshLista();
    fetch(`/api/user/profile?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        applyCupoFromProfilePayload(d, setCupo);
      })
      .catch(() => {});
  }

  if (!hydrated) {
    return (
      <p className="py-12 text-center text-[var(--mx-fg-muted)]">Cargando…</p>
    );
  }

  const activas = lista.filter(
    (t) => t.estado === "pendiente" || t.estado === "activa"
  );
  const completadas = lista.filter((t) => t.estado === "completada");

  return (
    <div className="pb-16">
      {/* Cabecera estilo app */}
      <div className="-mx-4 -mt-2 mb-0 rounded-b-3xl bg-[var(--mx-bg)] px-4 pb-6 pt-2 text-white shadow-lg sm:-mx-0 sm:rounded-3xl">
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20"
            aria-label="Volver al inicio"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Mis Tandas</h1>
        </div>
        <p className="mt-3 text-sm text-white/80">
          Círculos de ahorro donde participas.{" "}
          <Link href="/perfil" className="font-medium text-[var(--mx-cream-warm)] underline">
            Cuenta
          </Link>
        </p>
      </div>

      <div className="mt-4 rounded-t-3xl bg-[color-mix(in_srgb,var(--mx-cream)_88%,white)] px-1 pb-8 pt-2 sm:px-0">
        <button
          type="button"
          onClick={() => {
            setShowAcciones(true);
            requestAnimationFrame(() =>
              document
                .getElementById("acciones")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            );
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--mx-green)] py-4 text-base font-semibold text-white shadow-lg shadow-[var(--mx-bg)]/25 transition hover:bg-[var(--mx-green-hover)] hover:shadow-xl"
        >
          <span className="text-xl" aria-hidden>
            ➕
          </span>
          Nueva tanda o unirse
        </button>

        {userId && cupo && (
          <p
            className="mx-card mx-auto mt-4 max-w-lg px-4 py-2.5 text-center text-xs shadow-sm"
            role="status"
          >
            Nivel <strong>{levelDisplayName(cupo.level)}</strong>
            {cupo.max === null
              ? ` · ${cupo.active} tandas activas/pendientes`
              : ` · cupo ${cupo.active}/${cupo.max} (${maxTandasLabel(cupo.level)})`}
          </p>
        )}

        {!userId && (
          <p className="mx-auto mt-4 max-w-lg rounded-xl border border-[color-mix(in_srgb,var(--mx-red-soft)_35%,transparent)] bg-[color-mix(in_srgb,var(--mx-red-soft)_12%,var(--mx-cream))] px-4 py-3 text-center text-sm text-[var(--mx-ink)]">
            Inicia sesión en <strong>Perfil</strong> para ver tus tandas y crear
            nuevas.
          </p>
        )}

        {userId && (
          <>
            {listaLoading && (
              <p className="mt-8 text-center text-sm text-[var(--mx-fg-muted)]">
                Cargando tus tandas…
              </p>
            )}

            {!listaLoading && activas.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-lg font-bold text-[var(--mx-ink)]">
                  Activas
                </h2>
                <ul className="space-y-4">
                  {activas.map((t) => (
                    <li key={t.id}>
                      <TandaCard t={t} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!listaLoading && completadas.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-3 text-lg font-bold text-[var(--mx-ink)]">
                  Completadas
                </h2>
                <ul className="space-y-4">
                  {completadas.map((t) => (
                    <li key={t.id}>
                      <TandaCard t={t} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!listaLoading && lista.length === 0 && (
              <p className="mt-10 rounded-2xl border border-dashed border-[var(--mx-brown-light)]/40 bg-white/90 px-4 py-10 text-center text-[var(--mx-brown)]">
                Aún no estás en ninguna tanda. Usa el botón verde para crear una o
                unirte con código.
              </p>
            )}
          </>
        )}

        {/* Ayuda rápida */}
        <aside className="mx-highlight mx-auto mt-10 max-w-lg rounded-2xl p-4 text-sm shadow-sm">
          <h3 className="font-semibold text-[var(--mx-ink)]">Código de invitación</h3>
          <p className="mt-2 text-[var(--mx-brown)]">
            El organizador comparte un código tipo{" "}
            <code className="rounded bg-white/90 px-1 font-mono text-xs text-[var(--mx-ink)]">
              TANDA-2026-AB7K
            </code>
            . Pégalo abajo para unirte al mismo grupo.
          </p>
          <p className="mt-2">
            <Link href="/liga" className="font-medium text-[var(--mx-green)] underline hover:text-[var(--mx-green-hover)]">
              Liga y límites por nivel
            </Link>
          </p>
        </aside>

        {/* Formularios (plegable) */}
        <div id="acciones" className="mx-auto mt-8 max-w-lg scroll-mt-24">
          <button
            type="button"
            onClick={() => setShowAcciones((v) => !v)}
            className="mb-3 w-full text-center text-sm font-medium text-[var(--mx-brown)] underline-offset-2 hover:underline"
          >
            {showAcciones
              ? "Ocultar crear / unirse"
              : "Mostrar formulario crear o unirse"}
          </button>

          {showAcciones && (
            <div className="space-y-6">
              <section className="mx-card-solid rounded-2xl p-5 shadow-md">
                <h2 className="text-lg font-semibold text-[var(--mx-ink)]">
                  Nueva tanda
                </h2>
                <form onSubmit={crear} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-sm text-[var(--mx-brown)]">Nombre</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-[color-mix(in_srgb,var(--mx-brown-light)_35%,transparent)] bg-white px-3 py-2.5 text-[var(--mx-ink)] focus:border-[var(--mx-green)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-green)]/20"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      required
                      placeholder="Tanda del trabajo"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-[var(--mx-brown)]">
                      Monto por periodo
                    </span>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      className="mt-1 w-full rounded-xl border border-[color-mix(in_srgb,var(--mx-brown-light)_35%,transparent)] bg-white px-3 py-2.5 text-[var(--mx-ink)] focus:border-[var(--mx-green)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-green)]/20"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-[var(--mx-brown)]">Frecuencia</span>
                    <select
                      className="mt-1 w-full rounded-xl border border-[color-mix(in_srgb,var(--mx-brown-light)_35%,transparent)] bg-white px-3 py-2.5 text-[var(--mx-ink)] focus:border-[var(--mx-green)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-green)]/20"
                      value={freq}
                      onChange={(e) => setFreq(e.target.value)}
                    >
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-[var(--mx-brown)]">
                      Participantes
                    </span>
                    <input
                      type="number"
                      min={2}
                      className="mt-1 w-full rounded-xl border border-[color-mix(in_srgb,var(--mx-brown-light)_35%,transparent)] bg-white px-3 py-2.5 text-[var(--mx-ink)] focus:border-[var(--mx-green)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-green)]/20"
                      value={num}
                      onChange={(e) => setNum(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-[var(--mx-brown)]">Inicio</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-[color-mix(in_srgb,var(--mx-brown-light)_35%,transparent)] bg-white px-3 py-2.5 text-[var(--mx-ink)] focus:border-[var(--mx-green)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-green)]/20"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-[var(--mx-green)] py-3 font-semibold text-white hover:bg-[var(--mx-green-hover)]"
                    >
                      Crear tanda
                    </button>
                  </div>
                </form>
              </section>

              <section className="mx-card-solid rounded-2xl p-5 shadow-md">
                <h2 className="text-lg font-semibold text-[var(--mx-ink)]">
                  Unirme con código
                </h2>
                <p className="mt-1 text-sm text-[var(--mx-fg-muted)]">
                  Código exacto del organizador (mayúsculas y guiones).
                </p>
                <form onSubmit={unir} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-[color-mix(in_srgb,var(--mx-brown-light)_35%,transparent)] bg-white px-3 py-2.5 text-[var(--mx-ink)] focus:border-[var(--mx-green)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-green)]/20 font-mono text-sm"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="TANDA-2026-XXXX"
                    required
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[var(--mx-bg)] px-6 py-2.5 font-semibold text-white hover:bg-[var(--mx-bg-soft)]"
                  >
                    Unirse
                  </button>
                </form>
              </section>
            </div>
          )}
        </div>

        {err && (
          <p className="mt-4 text-center text-sm text-red-600" role="alert">
            {err}
          </p>
        )}
        {msg && (
          <p className="mx-highlight mt-4 rounded-xl px-4 py-3 text-center text-sm">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
