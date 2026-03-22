import { NextResponse } from "next/server";
import { getRoleAddresses, getTrustlineConfig } from "@/lib/trustless-work";

/**
 * GET /api/trustless/escrow-config
 * Expone roles + trustline para armar el payload del deploy (sin signer).
 * El campo `signer` debe ser la cuenta G del usuario que despliega (organizador),
 * obtenida vía GET /api/user/wallet-public?userId=.
 */
export async function GET() {
  try {
    const roles = getRoleAddresses();
    const trustline = getTrustlineConfig();
    return NextResponse.json({ roles, trustline });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
