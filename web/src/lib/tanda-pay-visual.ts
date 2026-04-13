/** Si es true, POST /api/tandas/[id]/pay solo actualiza BD (sin Stellar ni escrow). */
export function isTandaPayVisualOnly(): boolean {
  return process.env["TANDA_PAY_VISUAL_ONLY"] === "true";
}
