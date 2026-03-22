/**
 * Max simultaneous tandas (pendiente + activa) by user level.
 * Escrow (firmar deploy y enviar a Stellar) no usa este límite: cualquier organizador
 * con wallet en Perfil puede desplegar si Trustless está configurado.
 */
export function maxTandasForLevel(level: string): number {
  if (level === "AVANZADO") return Infinity;
  if (level === "CONFIABLE") return 5;
  if (level === "BASICO") return 3;
  return 3;
}

/** Human-readable label for max simultaneous tandas (for UI). */
export function maxTandasLabel(level: string): string {
  const max = maxTandasForLevel(level);
  if (!Number.isFinite(max)) return "sin límite";
  if (max === 1) return "1 a la vez";
  return `hasta ${max} a la vez`;
}

const LEVEL_ES: Record<string, string> = {
  BASICO: "Básico",
  CONFIABLE: "Confiable",
  AVANZADO: "Avanzado",
};

export function levelDisplayName(level: string): string {
  return LEVEL_ES[level] ?? level;
}

/** API / UI error when user tries to join or create beyond their limit. */
export function maxTandasExceededMessage(level: string): string {
  const max = maxTandasForLevel(level);
  const nombre = levelDisplayName(level);
  if (!Number.isFinite(max)) return "";
  if (max === 1) {
    return `En nivel ${nombre} solo puedes tener 1 tanda pendiente o activa a la vez. Cuando termine o deje de contar, podrás unirte a otra o crear una nueva. Subir de nivel en la liga te da más cupos.`;
  }
  return `En nivel ${nombre} puedes tener hasta ${max} tandas pendientes o activas a la vez. Cierra cupo cuando alguna termine o sube de nivel para ampliar el límite.`;
}
