"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBackendUser } from "@/hooks/useBackendUser";
import { LigaPointsInfo } from "@/components/LigaPointsInfo";
import { LigaPremioLiderAhorro } from "@/components/liga/LigaPremioLiderAhorro";
import { LigaTorneoPromo } from "@/components/liga/LigaTorneoPromo";

type Entry = {
  userId: string;
  name: string;
  initials: string;
  score: number;
  streak: number;
  rank: number;
};

type MeInfo = {
  userId: string;
  name: string;
  initials: string;
  score: number;
  streak: number;
  rank: number;
  nextRank: number | null;
  nextRankScore: number | null;
  inLeaderboardList: boolean;
};

type AhorroEntry = {
  userId: string;
  name: string;
  initials: string;
  guardado: number;
  rank: number;
};

type AhorroMe = {
  userId: string;
  name: string;
  initials: string;
  guardado: number;
  rank: number;
  nextRank: number | null;
  nextGuardado: number | null;
  inLeaderboardList: boolean;
};

type TabId = "puntualidad" | "ahorro" | "torneos";

function medalForRank(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export default function LigaPage() {
  const { userId, displayName, hydrated } = useBackendUser();
  const [tab, setTab] = useState<TabId>("puntualidad");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [ahorroEntries, setAhorroEntries] = useState<AhorroEntry[]>([]);
  const [ahorroMe, setAhorroMe] = useState<AhorroMe | null>(null);
  const [ahorroLoading, setAhorroLoading] = useState(false);
  const [ahorroErr, setAhorroErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    const q = userId
      ? `?userId=${encodeURIComponent(userId)}`
      : "";
    fetch(`/api/liga/leaderboard${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setErr(d.error);
          return;
        }
        setEntries(d.entries ?? []);
        setMe(d.me ?? null);
      })
      .catch(() => setErr("No se pudo cargar el ranking."))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setAhorroEntries([]);
      setAhorroMe(null);
      return;
    }
    setAhorroLoading(true);
    setAhorroErr(null);
    fetch(`/api/liga/ahorro?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setAhorroErr(d.error);
          return;
        }
        setAhorroEntries(d.entries ?? []);
        setAhorroMe(d.me ?? null);
      })
      .catch(() => setAhorroErr("No se pudo cargar el ranking de ahorro."))
      .finally(() => setAhorroLoading(false));
  }, [userId]);

  const progressPct =
    me?.nextRankScore != null && me.nextRankScore > 0
      ? Math.min(100, Math.round((me.score / me.nextRankScore) * 100))
      : me?.rank === 1
        ? 100
        : 0;

  const ahorroProgressPct =
    ahorroMe?.nextGuardado != null &&
    ahorroMe.nextGuardado > 0 &&
    ahorroMe.guardado < ahorroMe.nextGuardado
      ? Math.min(
          100,
          Math.round((ahorroMe.guardado / ahorroMe.nextGuardado) * 100)
        )
      : ahorroMe?.rank === 1
        ? 100
        : 0;

  if (!hydrated) {
    return (
      <p className="text-center text-[var(--mx-fg-muted)]">Cargando…</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <div className="-mx-4 -mt-2 mb-6 rounded-b-3xl bg-[var(--mx-bg)] px-4 pb-6 pt-2 text-white shadow-lg sm:-mx-0 sm:rounded-3xl">
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20"
            aria-label="Volver al inicio"
          >
            ←
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              🏆
            </span>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Liga Macetero
            </h1>
          </div>
        </div>

        {!userId && (
          <p className="mt-6 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/85">
            Entra en{" "}
            <Link href="/perfil" className="font-semibold text-[var(--mx-cream-warm)] underline">
              Perfil
            </Link>{" "}
            para ver tu posición en la liga.
          </p>
        )}

        {userId && tab === "puntualidad" && me && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--mx-bg-soft)_92%,black)] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--mx-fg-muted)]">
              Tu posición · Puntualidad
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span className="text-5xl font-bold leading-none text-[var(--mx-red-soft)]">
                #{me.rank}
              </span>
              <div className="min-w-0 flex-1 pb-1">
                <p className="truncate text-lg font-semibold">
                  {displayName || me.name}
                </p>
                <p className="mt-1 text-sm text-white/80">
                  Racha:{" "}
                  <span className="text-orange-300" aria-hidden>
                    🔥
                  </span>{" "}
                  {me.streak} sem ·{" "}
                  <span className="font-medium text-[var(--mx-green-muted)]">
                    {me.score} pts
                  </span>
                </p>
              </div>
            </div>
            {me.rank === 1 ? (
              <p className="mt-4 text-sm font-medium text-white/75">
                ¡Vas en primer lugar en puntualidad!
              </p>
            ) : me.nextRankScore != null ? (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-[var(--mx-fg-muted)]">
                  <span>Progreso al #{me.nextRank ?? "—"}</span>
                  <span className="tabular-nums text-white/80">
                    {me.score}/{me.nextRankScore} pts
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--mx-bg)_75%,var(--mx-brown))]">
                  <div
                    className="h-full rounded-full bg-[var(--mx-red-soft)] transition-[width]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}

        {userId && tab === "ahorro" && ahorroMe && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--mx-bg-soft)_92%,black)] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--mx-fg-muted)]">
              Tu posición · Ahorro (on‑ramp MXN)
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span className="text-5xl font-bold leading-none text-[var(--mx-green-muted)]">
                #{ahorroMe.rank}
              </span>
              <div className="min-w-0 flex-1 pb-1">
                <p className="truncate text-lg font-semibold">
                  {displayName || ahorroMe.name}
                </p>
                <p className="mt-1 text-sm text-white/80">
                  Total acumulado vía depósitos:{" "}
                  <span className="font-semibold text-[var(--mx-green-muted)]">
                    {mxn.format(ahorroMe.guardado)}
                  </span>
                </p>
              </div>
            </div>
            {ahorroMe.rank === 1 && ahorroMe.guardado > 0 ? (
              <p className="mt-4 text-sm font-medium text-white/75">
                👑 Líder de la semana en ahorro
              </p>
            ) : ahorroMe.nextGuardado != null && ahorroMe.guardado < ahorroMe.nextGuardado ? (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-[var(--mx-fg-muted)]">
                  <span>Progreso al #{ahorroMe.nextRank ?? "—"}</span>
                  <span className="tabular-nums text-white/80">
                    {mxn.format(ahorroMe.guardado)} /{" "}
                    {mxn.format(ahorroMe.nextGuardado)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--mx-bg)_75%,var(--mx-brown))]">
                  <div
                    className="h-full rounded-full bg-[var(--mx-green-muted)] transition-[width]"
                    style={{ width: `${ahorroProgressPct}%` }}
                  />
                </div>
              </div>
            ) : ahorroMe.guardado === 0 ? (
              <p className="mt-4 text-sm text-white/80">
                Aún no registramos depósitos on‑ramp. Usa{" "}
                <Link href="/receive" className="font-medium text-[var(--mx-cream-warm)] underline">
                  Guardar
                </Link>{" "}
                para sumar.
              </p>
            ) : null}
          </div>
        )}

        {userId && tab === "torneos" && me && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--mx-bg-soft)_92%,black)] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--mx-fg-muted)]">
              Copa Macetero · Tu posición
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span className="text-5xl font-bold leading-none text-[var(--mx-cream-warm)]">
                #{me.rank}
              </span>
              <div className="min-w-0 flex-1 pb-1">
                <p className="truncate text-lg font-semibold">
                  {displayName || me.name}
                </p>
                <p className="mt-1 text-sm text-white/80">
                  Puntos de temporada:{" "}
                  <span className="font-medium text-[var(--mx-green-muted)]">{me.score} pts</span>
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/75">
              Mismo ranking que puntualidad; pronto habrá rondas con premios.
            </p>
          </div>
        )}
      </div>

      <div className="mb-6 flex rounded-2xl bg-[color-mix(in_srgb,var(--mx-cream-warm)_85%,var(--mx-cream))] p-1 ring-1 ring-[var(--mx-brown-light)]/30">
        {(
          [
            ["puntualidad", "Puntualidad"],
            ["ahorro", "Ahorro"],
            ["torneos", "Torneos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl py-2.5 text-center text-sm font-semibold transition-all ${
              tab === id
                ? "bg-white text-[var(--mx-ink)] shadow-md ring-2 ring-[var(--mx-bg)]"
                : "text-[var(--mx-brown)] hover:text-[var(--mx-ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl bg-gradient-to-b from-[color-mix(in_srgb,var(--mx-red-soft)_12%,var(--mx-cream))] via-[var(--mx-cream)] to-[var(--mx-cream-warm)] px-1 py-4 sm:px-4 sm:py-6">
        {tab === "puntualidad" && (
          <>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div>
                <p className="text-xs text-[var(--mx-fg-muted)]">
                  Ranking de tu comunidad · Esta semana · Nombres reales
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--mx-ink)]">
                  Ranking de puntualidad
                </h2>
                <p className="text-sm text-[var(--mx-fg-muted)]">
                  Semana actual · Orden por puntos
                </p>
              </div>
              <LigaPointsInfo />
            </div>

            {loading && (
              <p className="py-8 text-center text-[var(--mx-fg-muted)]">Cargando ranking…</p>
            )}
            {err && (
              <p className="mx-error-box rounded-xl px-4 py-3 text-sm">
                {err}
              </p>
            )}
            {!loading && !err && entries.length === 0 && (
              <p className="rounded-2xl border border-[var(--mx-cream-warm)] bg-white px-4 py-10 text-center text-[var(--mx-brown)]">
                Aún no hay participantes con puntos. Suma puntos pagando a tiempo en
                tus tandas.
              </p>
            )}

            {!loading && !err && entries.length > 0 && (
              <ul className="space-y-3">
                {entries.map((e) => {
                  const isMe = userId === e.userId;
                  return (
                    <li key={e.userId}>
                      <div
                        className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm transition-shadow ${
                          isMe
                            ? "border-[var(--mx-bg)] ring-2 ring-[var(--mx-green)]/25"
                            : "border-[var(--mx-cream-warm)]/80"
                        }`}
                      >
                        <div className="flex w-10 shrink-0 justify-center text-xl">
                          {medalForRank(e.rank) || (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--mx-cream-warm)_70%,white)] text-sm font-bold text-[var(--mx-fg-muted)]">
                              {e.rank}
                            </span>
                          )}
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--mx-brown)] to-[var(--mx-bg)] text-sm font-bold text-white">
                          {e.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-semibold text-[var(--mx-ink)]">
                              {e.name}
                            </span>
                            {isMe && (
                              <span className="rounded-full bg-[var(--mx-bg)] px-2 py-0.5 text-xs font-medium text-white">
                                Tú
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--mx-fg-muted)]">
                            {e.streak > 0 ? (
                              <>
                                <span aria-hidden>🔥</span> {e.streak} sem racha
                              </>
                            ) : (
                              "Sin racha aún"
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[var(--mx-green)] tabular-nums">
                            {e.score}
                          </p>
                          <p className="text-xs text-[var(--mx-brown-light)]">puntos</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {userId && me && !me.inLeaderboardList && entries.length > 0 && (
              <p className="mt-6 rounded-xl border border-[color-mix(in_srgb,var(--mx-red-soft)_35%,transparent)] bg-[color-mix(in_srgb,var(--mx-red-soft)_10%,var(--mx-cream))] px-4 py-3 text-sm text-[var(--mx-ink)]">
                Tu posición global es <strong>#{me.rank}</strong>. El listado muestra
                el top 50; sigue sumando puntos para aparecer aquí.
              </p>
            )}
          </>
        )}

        {tab === "ahorro" && (
          <>
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs text-[var(--mx-fg-muted)]">
                  Mayores ahorradores de tu zona · Semana actual · Nombres reales
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--mx-ink)]">
                  Ranking de ahorro
                </h2>
              </div>
              <p className="text-xs text-[var(--mx-brown-light)] sm:text-right">
                Saldo vía depósitos · Tu comunidad
              </p>
            </div>

            {ahorroLoading && (
              <p className="py-8 text-center text-[var(--mx-fg-muted)]">
                Cargando ranking de ahorro…
              </p>
            )}
            {ahorroErr && (
              <p className="mx-error-box rounded-xl px-4 py-3 text-sm">
                {ahorroErr}
              </p>
            )}

            {!ahorroLoading && !ahorroErr && ahorroEntries.length === 0 && (
              <div className="space-y-4">
                <p className="rounded-2xl border border-[var(--mx-cream-warm)] bg-white px-4 py-8 text-center text-[var(--mx-brown)]">
                  Aún no hay depósitos on‑ramp registrados. Cuando alguien guarde
                  vía Etherfuse, aparecerá aquí el monto acumulado en MXN.
                </p>
                <LigaPremioLiderAhorro />
              </div>
            )}

            {!ahorroLoading && !ahorroErr && ahorroEntries.length > 0 && (
              <>
                <ul className="space-y-3">
                  {ahorroEntries.map((e) => {
                    const isMe = userId === e.userId;
                    return (
                      <li key={e.userId}>
                        <div
                          className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm ${
                            isMe
                              ? "border-[var(--mx-bg)] ring-2 ring-[var(--mx-green)]/25"
                              : "border-[var(--mx-cream-warm)]/80"
                          }`}
                        >
                          <div className="flex w-10 shrink-0 justify-center text-xl">
                            {medalForRank(e.rank) || (
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--mx-cream-warm)_70%,white)] text-sm font-bold text-[var(--mx-fg-muted)]">
                                {e.rank}
                              </span>
                            )}
                          </div>
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                              isMe
                                ? "bg-gradient-to-br from-[var(--mx-bg-soft)] to-[var(--mx-bg)]"
                                : "bg-gradient-to-br from-[var(--mx-brown)] to-[var(--mx-bg)]"
                            }`}
                          >
                            {e.initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="font-semibold text-[var(--mx-ink)]">
                                {e.name}
                              </span>
                              {isMe && (
                                <span className="rounded-full bg-[var(--mx-bg)] px-2 py-0.5 text-xs font-medium text-white">
                                  Tú
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--mx-fg-muted)]">
                              {e.rank === 1 ? (
                                <>
                                  <span aria-hidden>👑</span> Líder de la semana
                                </>
                              ) : (
                                "Ahorrador activo"
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-[var(--mx-green)] tabular-nums">
                              {mxn.format(e.guardado)}
                            </p>
                            <p className="text-xs text-[var(--mx-brown-light)]">guardado</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-6">
                  <LigaPremioLiderAhorro />
                </div>
                {userId &&
                  ahorroMe &&
                  !ahorroMe.inLeaderboardList &&
                  ahorroEntries.length > 0 && (
                    <p className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--mx-red-soft)_35%,transparent)] bg-[color-mix(in_srgb,var(--mx-red-soft)_10%,var(--mx-cream))] px-4 py-3 text-sm text-[var(--mx-ink)]">
                      Tu posición global es <strong>#{ahorroMe.rank}</strong>. El
                      listado muestra quienes ya tienen depósitos; sigue guardando
                      para subir.
                    </p>
                  )}
              </>
            )}
          </>
        )}

        {tab === "torneos" && (
          <>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs text-[var(--mx-fg-muted)]">
                  Competencia por temporada · Tu colonia
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--mx-ink)]">
                  Tabla general del torneo
                </h2>
                <p className="text-sm text-[var(--mx-fg-muted)]">
                  Orden por puntos de liga (misma base que puntualidad)
                </p>
              </div>
            </div>
            <div className="mb-6">
              <LigaTorneoPromo />
            </div>

            {loading && (
              <p className="py-8 text-center text-[var(--mx-fg-muted)]">Cargando tabla…</p>
            )}
            {err && (
              <p className="mx-error-box rounded-xl px-4 py-3 text-sm">
                {err}
              </p>
            )}
            {!loading && !err && entries.length === 0 && (
              <p className="rounded-2xl border border-[var(--mx-cream-warm)] bg-white px-4 py-10 text-center text-[var(--mx-brown)]">
                Sin datos de puntos todavía.
              </p>
            )}
            {!loading && !err && entries.length > 0 && (
              <ul className="space-y-3">
                {entries.map((e) => {
                  const isMe = userId === e.userId;
                  return (
                    <li key={e.userId}>
                      <div
                        className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm ${
                          isMe
                            ? "border-[var(--mx-green)] ring-2 ring-[var(--mx-green)]/35"
                            : "border-[var(--mx-cream-warm)]/80"
                        }`}
                      >
                        <div className="flex w-10 shrink-0 justify-center text-xl">
                          {medalForRank(e.rank) || (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--mx-cream-warm)_70%,white)] text-sm font-bold text-[var(--mx-fg-muted)]">
                              {e.rank}
                            </span>
                          )}
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--mx-green)] to-[var(--mx-bg)] text-sm font-bold text-white">
                          {e.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-semibold text-[var(--mx-ink)]">
                              {e.name}
                            </span>
                            {isMe && (
                              <span className="rounded-full bg-[var(--mx-bg)] px-2 py-0.5 text-xs font-medium text-white">
                                Tú
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--mx-fg-muted)]">
                            {e.streak > 0
                              ? `${e.streak} sem en racha · temporada`
                              : "En busca de racha"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[var(--mx-green)] tabular-nums">
                            {e.score}
                          </p>
                          <p className="text-xs text-[var(--mx-brown-light)]">pts</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {userId && me && !me.inLeaderboardList && entries.length > 0 && (
              <p className="mx-highlight mt-6 rounded-xl px-4 py-3 text-sm">
                Tu posición en la temporada es <strong>#{me.rank}</strong>. El
                listado muestra el top 50.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
