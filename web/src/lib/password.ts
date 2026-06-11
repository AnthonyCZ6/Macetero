import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_PREFIX = "scrypt";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

/** Hash con scrypt + salt aleatorio. Formato: `scrypt$<salt-hex>$<hash-hex>`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

/**
 * Verifica contra el formato scrypt actual o el legado (SHA-256 sin salt,
 * cuentas creadas antes del cambio). Comparación en tiempo constante.
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith(`${SCRYPT_PREFIX}$`)) {
    const [, salt, hashHex] = stored.split("$");
    if (!salt || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    const candidate = scryptSync(password, salt, expected.length);
    return timingSafeEqual(candidate, expected);
  }

  const legacy = createHash("sha256").update(password).digest("hex");
  const a = Buffer.from(legacy);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** true si el hash guardado está en el formato legado y conviene regenerarlo. */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith(`${SCRYPT_PREFIX}$`);
}
