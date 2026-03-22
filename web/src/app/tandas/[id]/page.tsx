"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EscrowContractViewButton } from "@/components/EscrowContractViewButton";
import { EscrowOrganizerDeploySection } from "@/components/EscrowOrganizerDeploySection";
import { useBackendUser } from "@/hooks/useBackendUser";

type Detail = {
  id: string;
  nombre: string;
  organizadorId?: string;
  organizador?: { id: string; name: string | null; phone: string | null };
  montoAportacion: number;
  frecuencia: string;
  numParticipantes: number;
  estado: string;
  periodoActual: number;
  codigoInvitacion: string;
  montoPremio: number;
  trustlessEscrowEnabled?: boolean;
  trustlessClientReady?: boolean;
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
  escrows?: Array<{
    periodo: number;
    contractId: string;
    engagementId: string;
    estado: string;
  }>;
};

function stellarExpertContractUrl(contractId: string): string {
  const base =
    process.env.NEXT_PUBLIC_STELLAR_EXPERT_CONTRACT_BASE?.replace(/\/$/, "") ??
    "https://stellar.expert/explorer/testnet/contract";
  return `${base}/${encodeURIComponent(contractId)}`;
}

export default function TandaDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { userId } = useBackendUser();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshTanda = useCallback(async () => {
    const refresh = await fetch(`/api/tandas/${id}`).then((r) => r.json());
    if (!refresh.error) setData(refresh);
  }, [id]);

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
    await refreshTanda();
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

  const escrows = data.escrows ?? [];
  const tieneEscrowPeriodoActual = escrows.some(
    (e) => e.periodo === data.periodoActual
  );
  const esMiembro = Boolean(
    userId &&
      (data.organizadorId === userId ||
        data.organizador?.id === userId ||
        data.participants.some((p) => p.userId === userId))
  );

  const puedeDesplegarEscrow =
    Boolean(userId) &&
    (data.organizadorId === userId || data.organizador?.id === userId) &&
    data.estado === "activa" &&
    data.trustlessEscrowEnabled === true &&
    data.trustlessClientReady === true &&
    !tieneEscrowPeriodoActual;

  const escrowDestacado =
    escrows.find((e) => e.periodo === data.periodoActual) ?? escrows[0];
  const otrosEscrows = escrowDestacado
    ? escrows.filter((e) => e.contractId !== escrowDestacado.contractId)
    : [];

  async function copyContract(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  }

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

      {puedeDesplegarEscrow && userId && (
        <section
          className="rounded-2xl border border-[color-mix(in_srgb,var(--mx-green)_22%,transparent)] bg-white/90 p-4 shadow-sm"
          aria-label="Desplegar contrato escrow"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--mx-ink)]">
            Contrato escrow (periodo actual)
          </h2>
          <p className="mt-1 text-xs text-[var(--mx-fg-muted)]">
            Aún no hay contrato en cadena para este periodo. Abre el modal,
            revisa los términos y luego podrás firmar con tu wallet de Perfil.
          </p>
          <EscrowOrganizerDeploySection
            tandaId={id}
            userId={userId}
            onDeployed={() => void refreshTanda()}
          />
        </section>
      )}

      {escrows.length > 0 && (
        <section
          className="rounded-2xl border border-[color-mix(in_srgb,var(--mx-green)_28%,transparent)] bg-[color-mix(in_srgb,var(--mx-green)_8%,white)] p-4 shadow-sm"
          aria-label="Contratos escrow en cadena"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--mx-ink)]">
            Escrow Trustless (contrato en Stellar)
          </h2>
          <p className="mt-1 text-xs text-[var(--mx-fg-muted)]">
            Cada periodo puede tener un contrato donde se acumulan las aportaciones
            antes del desembolso. Puedes verificarlo en el explorador.
          </p>
          {escrowDestacado && (
            <div className="mt-3 rounded-xl border border-[var(--mx-green)]/35 bg-white/90 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-[var(--mx-fg-muted)]">
                {escrowDestacado.periodo === data.periodoActual
                  ? `Periodo actual (${data.periodoActual})`
                  : `Contrato (periodo ${escrowDestacado.periodo})`}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-[var(--mx-ink)]">
                {escrowDestacado.contractId}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyContract(escrowDestacado.contractId)}
                  className="rounded-lg border border-[var(--mx-brown)]/20 bg-white px-2 py-1 text-xs font-medium text-[var(--mx-ink)]"
                >
                  {copiedId === escrowDestacado.contractId
                    ? "Copiado"
                    : "Copiar contrato"}
                </button>
                <a
                  href={stellarExpertContractUrl(escrowDestacado.contractId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[var(--mx-green)] px-2 py-1 text-xs font-semibold text-white hover:bg-[var(--mx-green-hover)]"
                >
                  Ver en explorador
                </a>
                {userId && esMiembro && data.trustlessEscrowEnabled && (
                  <EscrowContractViewButton
                    tandaId={id}
                    userId={userId}
                    periodo={escrowDestacado.periodo}
                    className="rounded-lg border border-[var(--mx-green)]/40 bg-[color-mix(in_srgb,var(--mx-green)_12%,white)] px-2 py-1 text-xs font-semibold text-[var(--mx-ink)] hover:bg-[color-mix(in_srgb,var(--mx-green)_18%,white)]"
                  >
                    Ver contrato (modal)
                  </EscrowContractViewButton>
                )}
              </div>
              <p className="mt-2 text-[10px] text-[var(--mx-fg-muted)]">
                Engagement:{" "}
                <span className="font-mono text-[var(--mx-brown-light)]">
                  {escrowDestacado.engagementId}
                </span>
                {" · "}
                Estado: {escrowDestacado.estado}
              </p>
            </div>
          )}
          {otrosEscrows.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-[var(--mx-green)]">
                Otros contratos ({otrosEscrows.length})
              </summary>
              <ul className="mt-2 space-y-2 text-xs">
                {otrosEscrows.map((e) => (
                    <li
                      key={`${e.periodo}-${e.contractId}`}
                      className="rounded-lg border border-[var(--mx-cream-warm)] bg-white/80 px-2 py-2"
                    >
                      <span className="font-medium">Periodo {e.periodo}</span>
                      <p className="break-all font-mono text-[11px] text-[var(--mx-ink)]">
                        {e.contractId}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyContract(e.contractId)}
                          className="text-[var(--mx-green)] underline-offset-2 hover:underline"
                        >
                          Copiar
                        </button>
                        <a
                          href={stellarExpertContractUrl(e.contractId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--mx-green)] underline-offset-2 hover:underline"
                        >
                          Explorador
                        </a>
                        {userId && esMiembro && data.trustlessEscrowEnabled && (
                          <EscrowContractViewButton
                            tandaId={id}
                            userId={userId}
                            periodo={e.periodo}
                            className="text-[11px] font-semibold text-[var(--mx-brown)] underline-offset-2 hover:underline"
                          >
                            Ver contrato
                          </EscrowContractViewButton>
                        )}
                      </div>
                    </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

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
