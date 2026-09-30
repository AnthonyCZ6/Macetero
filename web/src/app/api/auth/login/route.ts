import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { isPlaceholderPhone } from "@/lib/phone-placeholder";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/password";
import { clientIp, resetRateLimit, takeRateLimit } from "@/lib/rate-limit";
import { setSessionCookie } from "@/lib/session";

const MAX_INTENTOS = 10;
const VENTANA_MS = 15 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** POST — correo + contraseña (mismo hash que registro). Abre sesión con cookie. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const emailRaw = body.email as string | undefined;
    const password = body.password as string | undefined;

    if (!emailRaw || !password) {
      return NextResponse.json(
        { error: "email y password son obligatorios" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(emailRaw);

    const limitKey = `login:${clientIp(req.headers)}:${email}`;
    const limit = takeRateLimit(limitKey, MAX_INTENTOS, VENTANA_MS);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos e intenta de nuevo." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    let user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user && !email.includes("@")) {
      user = await prisma.user.findFirst({
        where: { phone: emailRaw.trim() },
      });
    }

    // Mismo mensaje si no existe la cuenta o la contraseña no coincide.
    if (!user || !verifyPassword(password, user.pin_hash)) {
      return NextResponse.json(
        { error: "Correo o contraseña incorrectos" },
        { status: 401 }
      );
    }
    resetRateLimit(limitKey);

    // Migra hashes legados (SHA-256 sin salt) a scrypt al iniciar sesión
    if (needsRehash(user.pin_hash)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { pin_hash: hashPassword(password) },
      });
    }

    const res = NextResponse.json({
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: isPlaceholderPhone(user.phone) ? null : user.phone,
    });
    setSessionCookie(res, user.id);
    return res;
  } catch (e) {
    return errorResponse("Login", e);
  }
}
