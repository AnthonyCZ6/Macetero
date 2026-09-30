import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actaCreateApiKey, type ActaNetwork } from "@/lib/acta";
import { errorResponse } from "@/lib/api-error";
import { getSessionUserId, unauthorizedResponse } from "@/lib/session";

/**
 * POST /api/acta/api-keys
 * Crea una API key en ACTA (testnet/mainnet) asociada a la wallet Stellar del usuario de la sesión.
 * La clave solo se muestra una vez; ACTA la devuelve en esta respuesta.
 *
 * Body: { name?: string, network?: "testnet" | "mainnet" }
 */
export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return unauthorizedResponse();

  try {
    const body = await req.json();
    const name =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim().slice(0, 120)
        : "Macetero";
    const network: ActaNetwork =
      body.network === "mainnet" ? "mainnet" : "testnet";

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user?.wallet?.stellar_public_key) {
      return NextResponse.json(
        {
          error:
            "No hay wallet Stellar registrada para esta cuenta. Completa el registro con tu llave pública.",
        },
        { status: 400 }
      );
    }

    const walletAddress = user.wallet.stellar_public_key.trim();
    if (!walletAddress.startsWith("G") || walletAddress.length < 50) {
      return NextResponse.json(
        { error: "La wallet guardada no parece una dirección Stellar válida (G...)." },
        { status: 400 }
      );
    }

    const result = await actaCreateApiKey(network, {
      name,
      wallet_address: walletAddress,
      metadata: { network },
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          actaStatus: result.status,
          hint:
            result.status === 403
              ? "ACTA puede exigir crear la clave desde dapp.acta.build. Prueba allí con la misma wallet."
              : undefined,
        },
        { status: result.status >= 400 ? result.status : 502 }
      );
    }

    return NextResponse.json({
      message: result.data.message,
      api_key: result.data.api_key,
      api_key_record: result.data.api_key_record,
      network,
    });
  } catch (e) {
    return errorResponse("ACTA api-keys", e);
  }
}
