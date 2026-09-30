import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcDueDate, calcEndDate, PAGO_ESTADOS_ABIERTOS, PAGO_ESTADOS_SALDADOS } from "@/lib/tanda";
import { isTandaPayVisualOnly } from "@/lib/tanda-pay-visual";
import { releaseEscrowForPeriod } from "@/lib/tanda-escrow";

type Tx = Prisma.TransactionClient;

/**
 * Pasa una tanda llena a `activa`: fija el calendario, la fecha de cobro de
 * cada turno y crea todos los `Pago` (participantes × periodos). Si la fecha de
 * inicio ya pasó, el calendario arranca en `ahora` para que nadie empiece con
 * pagos vencidos.
 */
export async function activarTanda(tx: Tx, tandaId: string, ahora = new Date()) {
  const tanda = await tx.tanda.findUniqueOrThrow({
    where: { id: tandaId },
    include: { turnos: { orderBy: { numero_turno: "asc" } } },
  });
  const inicio = tanda.fecha_inicio < ahora ? ahora : tanda.fecha_inicio;
  const n = tanda.num_participantes;

  await tx.tanda.update({
    where: { id: tandaId },
    data: {
      estado: "activa",
      periodo_actual: 1,
      fecha_inicio: inicio,
      fecha_fin: calcEndDate(inicio, tanda.frecuencia, n),
    },
  });

  for (const turno of tanda.turnos) {
    await tx.turno.update({
      where: { id: turno.id },
      data: {
        fecha_cobro: calcDueDate(inicio, tanda.frecuencia, turno.numero_turno),
      },
    });
  }

  const pagos = [];
  for (let periodo = 1; periodo <= n; periodo++) {
    const fechaVencimiento = calcDueDate(inicio, tanda.frecuencia, periodo);
    for (const turno of tanda.turnos) {
      pagos.push({
        tanda_id: tandaId,
        pagador_id: turno.participante_id,
        periodo,
        monto_base: tanda.monto_aportacion,
        monto_total: tanda.monto_aportacion,
        fecha_vencimiento: fechaVencimiento,
        estado: "pendiente",
      });
    }
  }
  await tx.pago.createMany({ data: pagos });
}

/**
 * Siguiente periodo con receptor válido. Los periodos cuyo receptor fue
 * expulsado antes de cobrar se saltan (nadie aporta ni cobra en ellos).
 */
export function planearAvance(
  periodo: number,
  numParticipantes: number,
  periodosDeExpulsados: ReadonlySet<number>
): { siguiente: number | null; saltados: number[] } {
  const saltados: number[] = [];
  let siguiente = periodo + 1;
  while (siguiente <= numParticipantes && periodosDeExpulsados.has(siguiente)) {
    saltados.push(siguiente);
    siguiente++;
  }
  return { siguiente: siguiente <= numParticipantes ? siguiente : null, saltados };
}

/**
 * Nuevas fechas de vencimiento de los periodos que faltan, espaciadas por la
 * frecuencia a partir de `base` (el vencimiento del periodo que cierra, o el
 * momento del cierre si fue tarde). Así nadie queda vencido por un periodo que
 * todavía no podía pagar, y un periodo saltado no deja un hueco en el calendario.
 */
export function recalcularCalendario(
  base: Date,
  frecuencia: string,
  periodosRestantes: number[]
): Map<number, Date> {
  const fechas = new Map<number, Date>();
  periodosRestantes.forEach((periodo, i) => {
    fechas.set(periodo, calcDueDate(base, frecuencia, i + 1));
  });
  return fechas;
}

export type CierrePeriodo = {
  cerrado: boolean;
  tandaCompletada?: boolean;
  releaseHash?: string;
};

/**
 * Cierra el periodo si ya no quedan pagos abiertos: libera el escrow (si hay),
 * marca el premio del receptor, avanza al siguiente periodo y recalcula el
 * calendario. Seguro ante llamadas concurrentes: solo un proceso avanza el periodo.
 */
export async function cerrarPeriodoSiCompleto(
  tandaId: string,
  periodo: number,
  ahora = new Date()
): Promise<CierrePeriodo> {
  const tanda = await prisma.tanda.findUnique({ where: { id: tandaId } });
  if (!tanda || tanda.estado !== "activa" || tanda.periodo_actual !== periodo) {
    return { cerrado: false };
  }

  const abiertos = await prisma.pago.count({
    where: {
      tanda_id: tandaId,
      periodo,
      estado: { notIn: PAGO_ESTADOS_SALDADOS },
    },
  });
  if (abiertos > 0) return { cerrado: false };

  let releaseHash: string | undefined;
  if (!isTandaPayVisualOnly()) {
    const release = await releaseEscrowForPeriod(tandaId, periodo);
    if (release.status === "busy") return { cerrado: false };
    if (release.status === "released") releaseHash = release.hash;
  }

  const turnos = await prisma.turno.findMany({
    where: { tanda_id: tandaId },
    select: { id: true, numero_turno: true, estado_turno: true },
  });
  const periodosDeExpulsados = new Set(
    turnos
      .filter((t) => t.estado_turno === "expulsado")
      .map((t) => t.numero_turno)
  );
  const { siguiente, saltados } = planearAvance(
    periodo,
    tanda.num_participantes,
    periodosDeExpulsados
  );

  const vencimientoActual = await prisma.pago.findFirst({
    where: { tanda_id: tandaId, periodo },
    select: { fecha_vencimiento: true },
  });
  const venceEn = vencimientoActual?.fecha_vencimiento ?? ahora;
  const base = venceEn > ahora ? venceEn : ahora;
  const restantes: number[] = [];
  if (siguiente !== null) {
    for (let p = siguiente; p <= tanda.num_participantes; p++) {
      if (!periodosDeExpulsados.has(p)) restantes.push(p);
    }
  }
  const calendario = recalcularCalendario(base, tanda.frecuencia, restantes);

  const cerrado = await prisma.$transaction(
    async (tx) => {
      const avance = await tx.tanda.updateMany({
        where: { id: tandaId, estado: "activa", periodo_actual: periodo },
        data:
          siguiente === null
            ? { estado: "completada" }
            : {
                periodo_actual: siguiente,
                fecha_fin: calendario.get(restantes[restantes.length - 1]),
              },
      });
      if (avance.count === 0) return false;

      await tx.turno.updateMany({
        where: {
          tanda_id: tandaId,
          numero_turno: periodo,
          estado_turno: { in: ["pendiente", "pospuesto"] },
        },
        data: { estado_turno: "completado" },
      });
      await tx.turno.updateMany({
        where: { tanda_id: tandaId, numero_turno: periodo },
        data: { premio_entregado: true },
      });

      if (saltados.length > 0) {
        await tx.pago.updateMany({
          where: {
            tanda_id: tandaId,
            periodo: { in: saltados },
            estado: { in: PAGO_ESTADOS_ABIERTOS },
          },
          data: { estado: "cancelado" },
        });
      }

      for (const [p, fecha] of calendario) {
        await tx.pago.updateMany({
          where: { tanda_id: tandaId, periodo: p },
          data: { fecha_vencimiento: fecha },
        });
        await tx.turno.updateMany({
          where: { tanda_id: tandaId, numero_turno: p },
          data: { fecha_cobro: fecha },
        });
      }
      return true;
    },
    { timeout: 20_000 }
  );

  return {
    cerrado,
    tandaCompletada: cerrado && siguiente === null,
    releaseHash,
  };
}
