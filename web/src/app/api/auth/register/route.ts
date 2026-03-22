import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { generateKeypair } from "@/lib/stellar";
import { encrypt } from "@/lib/crypto";
import { registerWallet } from "@/lib/etherfuse";
import { placeholderPhoneFromEmail } from "@/lib/phone-placeholder";

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

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
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

    const pinHash = createHash("sha256").update(password).digest("hex");
    const { publicKey, secret } = generateKeypair();
    const encryptedSecret = encrypt(secret);

    const user = await prisma.user.create({
      data: {
        email,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
        pin_hash: pinHash,
        phone: placeholderPhoneFromEmail(email),
      },
    });

    let etherfuseWalletId: string | null = null;
    try {
      const efWallet = await registerWallet(publicKey, "stellar", false);
      etherfuseWalletId = efWallet.walletId;
    } catch (e) {
      console.error("Etherfuse wallet registration failed:", e);
    }

    await prisma.wallet.create({
      data: {
        userId: user.id,
        stellar_public_key: publicKey,
        encrypted_secret: encryptedSecret,
        etherfuse_wallet_id: etherfuseWalletId,
      },
    });

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      name: user.name,
      publicKey,
      etherfuseWalletId,
    });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
