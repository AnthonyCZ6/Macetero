/** Si es true, al crear una tanda se inserta un TandaEscrow simulado (sin red). */
export function simulateEscrowOnCreate(): boolean {
  return process.env["SIMULATE_ESCROW_ON_CREATE"] === "true";
}
