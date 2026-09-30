import { randomBytes } from "crypto";

export { maxTandasForLevel } from "./tanda-limits";

/** Generate a human-readable invite code like TANDA-2026-AB7K */
export function generateInviteCode(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `TANDA-${year}-${suffix}`;
}

export const FRECUENCIAS = ["semanal", "quincenal", "mensual"] as const;

export function diasPorFrecuencia(frecuencia: string): number {
  return frecuencia === "quincenal" ? 14 : frecuencia === "mensual" ? 30 : 7;
}

/** Calculate the end date of a tanda given start, frequency, and number of periods. */
export function calcEndDate(
  start: Date,
  frecuencia: string,
  periodos: number
): Date {
  return calcDueDate(start, frecuencia, periodos);
}

/** Calculate the due date for a specific period. */
export function calcDueDate(
  start: Date,
  frecuencia: string,
  periodo: number
): Date {
  const due = new Date(start);
  due.setDate(due.getDate() + diasPorFrecuencia(frecuencia) * periodo);
  return due;
}

/** Pagos que todavía deben cubrirse: bloquean el cierre del periodo y generan penalizaciones. */
export const PAGO_ESTADOS_ABIERTOS: string[] = ["pendiente", "en_gracia", "vencido"];

/**
 * Pagos que ya no bloquean el cierre del periodo. `cancelado` = aportación de
 * un participante expulsado o de un periodo que se salta.
 */
export const PAGO_ESTADOS_SALDADOS: string[] = ["pagado", "cancelado"];

/** Estado que corresponde a un pago abierto según sus días de retraso. */
export function estadoPagoPorRetraso(diasRetraso: number): string {
  if (diasRetraso >= 3) return "vencido";
  if (diasRetraso >= 1) return "en_gracia";
  return "pendiente";
}

/** Cargo acumulado: LATE_FEE_PER_WEEK por semana (o fracción) a partir del día 3. */
export function cargoPorRetraso(diasRetraso: number): number {
  if (diasRetraso < 3) return 0;
  return Math.ceil(diasRetraso / 7) * LATE_FEE_PER_WEEK;
}

/** Bloqueo vigente tras una expulsión (el bloqueo vence en `block_undate`). */
export function bloqueoVigente(
  user: { blocked_tandas: boolean; block_undate: Date | null },
  ahora = new Date()
): boolean {
  if (!user.blocked_tandas) return false;
  return !user.block_undate || user.block_undate > ahora;
}

/** Late fee per week of delay. */
export const LATE_FEE_PER_WEEK = 20;

/** Points awarded for on-time payment. */
export const POINTS_ON_TIME = 40;

/** Extra points for paying before the due date (UI / futura regla). */
export const POINTS_EARLY_BONUS = 20;

/** Bonus when streak reaches 4 weeks (UI / futura regla). */
export const POINTS_STREAK_4W_BONUS = 50;

/** Points deducted for first late (day 3). */
export const POINTS_LATE_PENALTY = 100;

/** Points deducted for expulsion (day 21). */
export const POINTS_EXPULSION = 200;

/** Days before level downgrade. */
export const DAYS_LEVEL_DOWNGRADE = 8;

/** Days before turn postponement. */
export const DAYS_POSTPONE_TURN = 15;

/** Days before expulsion. */
export const DAYS_EXPULSION = 21;

/** Days blocked from tandas after expulsion. */
export const BLOCK_DAYS = 90;
