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

/** Calculate the end date of a tanda given start, frequency, and number of periods. */
export function calcEndDate(
  start: Date,
  frecuencia: string,
  periodos: number
): Date {
  const end = new Date(start);
  const days =
    frecuencia === "quincenal" ? 14 : frecuencia === "mensual" ? 30 : 7;
  end.setDate(end.getDate() + days * periodos);
  return end;
}

/** Calculate the due date for a specific period. */
export function calcDueDate(
  start: Date,
  frecuencia: string,
  periodo: number
): Date {
  const due = new Date(start);
  const days =
    frecuencia === "quincenal" ? 14 : frecuencia === "mensual" ? 30 : 7;
  due.setDate(due.getDate() + days * periodo);
  return due;
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
