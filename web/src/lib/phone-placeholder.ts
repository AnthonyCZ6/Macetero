import { createHash } from "crypto";

/** Normaliza correo igual que en auth/register. */
export function normalizeEmailForPhone(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Valor único para `User.phone` cuando el usuario solo se registra con correo.
 * Cumple NOT NULL / cliente Prisma que exige el campo; no es un número real.
 */
export function placeholderPhoneFromEmail(email: string): string {
  const h = createHash("sha256")
    .update(normalizeEmailForPhone(email))
    .digest("hex");
  return `m${h.slice(0, 31)}`;
}

export function isPlaceholderPhone(phone: string | null | undefined): boolean {
  if (phone == null || phone === "") return true;
  return /^m[a-f0-9]{31}$/.test(phone);
}
