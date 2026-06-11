import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPlaceholderPhone } from "@/lib/phone-placeholder";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/password";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** POST — correo + contraseña (mismo hash que registro). */
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

    let user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user && !email.includes("@")) {
      user = await prisma.user.findFirst({
        where: { phone: emailRaw.trim() },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: "No encontramos una cuenta con ese correo" },
        { status: 404 }
      );
    }

    if (!verifyPassword(password, user.pin_hash)) {
      return NextResponse.json(
        { error: "Contraseña incorrecta" },
        { status: 401 }
      );
    }

    // Migra hashes legados (SHA-256 sin salt) a scrypt al iniciar sesión
    if (needsRehash(user.pin_hash)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { pin_hash: hashPassword(password) },
      });
    }

    return NextResponse.json({
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: isPlaceholderPhone(user.phone) ? null : user.phone,
    });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
