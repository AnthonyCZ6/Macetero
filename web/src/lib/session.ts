import { createHmac, hkdfSync, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Sesión sin estado: cookie httpOnly `uid.exp.firma` con HMAC-SHA256.
 * El servidor es la única fuente del usuario actual — las rutas nunca deben
 * aceptar `userId` desde el body o el query string.
 */
export const SESSION_COOKIE = "macetero_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * `SESSION_SECRET` si existe; si no, una clave derivada (HKDF) de
 * `WALLET_ENCRYPTION_KEY` para que el proyecto funcione sin variable extra.
 */
function sessionKey(): Buffer {
  const explicit = process.env["SESSION_SECRET"]?.trim();
  if (explicit) {
    if (explicit.length < 32) {
      throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
    }
    return Buffer.from(explicit, "utf8");
  }
  const walletKey = process.env["WALLET_ENCRYPTION_KEY"];
  if (walletKey && walletKey.length === 64) {
    return Buffer.from(
      hkdfSync(
        "sha256",
        Buffer.from(walletKey, "hex"),
        Buffer.alloc(0),
        "macetero-session-v1",
        32
      )
    );
  }
  throw new Error(
    "Define SESSION_SECRET (o WALLET_ENCRYPTION_KEY) para firmar sesiones"
  );
}

function sign(data: string): string {
  return createHmac("sha256", sessionKey()).update(data).digest("base64url");
}

export function createSessionToken(
  userId: string,
  now = Date.now()
): string {
  const exp = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const data = `${Buffer.from(userId, "utf8").toString("base64url")}.${exp}`;
  return `${data}.${sign(data)}`;
}

/** Devuelve el userId si la firma es válida y no expiró; si no, null. */
export function verifySessionToken(
  token: string | undefined,
  now = Date.now()
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uidB64, expStr, signature] = parts;
  const expected = Buffer.from(sign(`${uidB64}.${expStr}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null;
  const userId = Buffer.from(uidB64, "base64url").toString("utf8");
  return userId || null;
}

export function getSessionUserId(req: NextRequest): string | null {
  try {
    return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  } catch (e) {
    console.error("session:", e);
    return null;
  }
}

export function setSessionCookie(res: NextResponse, userId: string): void {
  res.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Inicia sesión para continuar" },
    { status: 401 }
  );
}
