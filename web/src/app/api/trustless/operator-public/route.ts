import { NextResponse } from "next/server";
import { getSignerKeypair } from "@/lib/trustless-work";

/** GET /api/trustless/operator-public — cuenta G del firmante operador (env). */
export async function GET() {
  try {
    const publicKey = getSignerKeypair().publicKey();
    return NextResponse.json({ publicKey });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
