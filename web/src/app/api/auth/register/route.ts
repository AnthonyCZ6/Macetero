import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, isUniqueViolation } from "@/lib/api-error";
import { MIN_PASSWORD_LENGTH, hashPassword } from "@/lib/password";
import { generateKeypair } from "@/lib/stellar";
import { encrypt } from "@/lib/crypto";
import { registerWallet } from "@/lib/etherfuse";
import { placeholderPhoneFromEmail } from "@/lib/phone-placeholder";
import { setSessionCookie } from "@/lib/session";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;
    const emailRaw = body.email as string | undefined;
    const password = body.password as string | undefined;

    if (!emailRaw || !password) {
      return NextResponse.json(
        { error: "email y password son obligatorios" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(emailRaw);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Correo electrónico no válido" }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
        },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { email },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese correo" },
        { status: 409 }
      );
    }

    const pinHash = hashPassword(password);
    const { publicKey, secret } = generateKeypair();
    const encryptedSecret = encrypt(secret);

    let etherfuseWalletId: string | null = null;
    try {
      const efWallet = await registerWallet(publicKey, "stellar", false);
      etherfuseWalletId = efWallet.walletId;
    } catch (e) {
      console.error("Etherfuse wallet registration failed:", e);
    }

    let user;
    try {
      // Usuario y wallet en una sola escritura: nunca queda una cuenta sin wallet.
      user = await prisma.user.create({
        data: {
          email,
          name: typeof name === "string" && name.trim() ? name.trim() : null,
          pin_hash: pinHash,
          phone: placeholderPhoneFromEmail(email),
          wallet: {
            create: {
              stellar_public_key: publicKey,
              encrypted_secret: encryptedSecret,
              etherfuse_wallet_id: etherfuseWalletId,
            },
          },
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        return NextResponse.json(
          { error: "Ya existe una cuenta con ese correo" },
          { status: 409 }
        );
      }
      throw e;
    }

    const res = NextResponse.json({
      userId: user.id,
      email: user.email,
      name: user.name,
      publicKey,
      etherfuseWalletId,
    });
    setSessionCookie(res, user.id);
    return res;
  } catch (e) {
    return errorResponse("Register", e);
  }
}
