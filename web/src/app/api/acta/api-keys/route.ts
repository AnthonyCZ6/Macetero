import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actaCreateApiKey, type ActaNetwork } from "@/lib/acta";

/**
 * POST /api/acta/api-keys
 * Crea una API key en ACTA (testnet/mainnet) asociada a la wallet Stellar del usuario.
 * La clave solo se muestra una vez; ACTA la devuelve en esta respuesta.
 *
 * Body: { userId: string, name?: string, network?: "testnet" | "mainnet" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const name =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim().slice(0, 120)
        : "Macetero";
    const network: ActaNetwork =
      body.network === "mainnet" ? "mainnet" : "testnet";

    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

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
    console.error("ACTA api-keys:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
