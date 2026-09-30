import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { getOnboardingUrl } from "@/lib/etherfuse";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";

/** Solo se permite volver a una ruta de esta misma app (evita redirecciones abiertas). */
function safeReturnUrl(returnUrl: unknown, origin: string): string {
  if (typeof returnUrl === "string") {
    try {
      const url = new URL(returnUrl, origin);
      if (url.origin === origin) return url.toString();
    } catch {
      /* URL inválida: se usa la raíz */
    }
  }
  return `${origin}/`;
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const { returnUrl } = await req.json().catch(() => ({}));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      return NextResponse.json(
        { error: "User or wallet not found" },
        { status: 404 }
      );
    }

    // Generate a stable customer ID if the user doesn't have one yet
    let customerId = user.etherfuse_customer_id;
    if (!customerId) {
      customerId = randomUUID();
      await prisma.user.update({
        where: { id: userId },
        data: { etherfuse_customer_id: customerId },
      });
    }

    const bankAccountId = randomUUID();

    const result = await getOnboardingUrl(
      customerId,
      bankAccountId,
      user.wallet.stellar_public_key,
      safeReturnUrl(returnUrl, req.nextUrl.origin)
    );

    // Store the bank account placeholder
    await prisma.bankAccount.create({
      data: {
        userId,
        etherfuse_bank_account_id: bankAccountId,
        clabe: "pending",
        status: "pending",
      },
    });

    return NextResponse.json({
      onboardingUrl: result.onboardingUrl,
      customerId,
      bankAccountId,
    });
  } catch (e) {
    return errorResponse("KYC onboard", e);
  }
}
