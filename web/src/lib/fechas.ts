const DAY_MS = 86_400_000;

/** Zona horaria para contar días de retraso (los servidores suelen correr en UTC). */
export function appTimeZone(): string {
  return process.env["APP_TIMEZONE"]?.trim() || "America/Mexico_City";
}

/** Día calendario de `date` en la zona indicada, como días desde 1970-01-01. */
export function diaCalendario(date: Date, timeZone = appTimeZone()): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day")) / DAY_MS;
}

/** Días de calendario de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(
  desde: Date,
  hasta: Date,
  timeZone = appTimeZone()
): number {
  return diaCalendario(hasta, timeZone) - diaCalendario(desde, timeZone);
}

export function sumarDias(date: Date, dias: number): Date {
  return new Date(date.getTime() + dias * DAY_MS);
}
