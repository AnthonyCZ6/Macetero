import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Autoriza llamadas a los endpoints de cron mediante `CRON_SECRET` (env).
 * Espera `Authorization: Bearer <CRON_SECRET>` — mismo formato que envía
 * Vercel Cron automáticamente cuando CRON_SECRET está definido.
 * Sin CRON_SECRET configurado se rechaza todo (fail closed).
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env["CRON_SECRET"]?.trim();
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cronUnauthorizedResponse() {
  return Response.json(
    { error: "No autorizado: falta o no coincide CRON_SECRET" },
    { status: 401 }
  );
}
