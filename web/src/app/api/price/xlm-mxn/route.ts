import { NextResponse } from "next/server";

/**
 * GET /api/price/xlm-mxn
 * Cotización orientativa 1 XLM en MXN (mercado spot vía CoinGecko).
 * No sustituye la cotización de rampa Etherfuse.
 */
export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=mxn",
      {
        next: { revalidate: 120 },
        headers: { Accept: "application/json" },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      stellar?: { mxn?: number };
    };

    const mxn = data.stellar?.mxn;
    if (typeof mxn !== "number" || !Number.isFinite(mxn) || mxn <= 0) {
      return NextResponse.json(
        { error: "Respuesta CoinGecko inválida" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      mxnPerXlm: mxn,
      source: "coingecko",
    });
  } catch (e) {
    console.error("xlm-mxn price:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
