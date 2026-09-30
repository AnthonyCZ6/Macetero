import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * `Authorization: Bearer <secreto>` contra la variable de entorno indicada.
 * Sin la variable configurada se rechaza todo (fail closed).
 */
export function isBearerAuthorized(req: NextRequest, envName: string): boolean {
  const secret = process.env[envName]?.trim();
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Autoriza llamadas a los endpoints de cron mediante `CRON_SECRET` (env).
 * Espera `Authorization: Bearer <CRON_SECRET>` — mismo formato que envía
 * Vercel Cron automáticamente cuando CRON_SECRET está definido.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  return isBearerAuthorized(req, "CRON_SECRET");
}

export function cronUnauthorizedResponse() {
  return Response.json(
    { error: "No autorizado: falta o no coincide CRON_SECRET" },
    { status: 401 }
  );
}
