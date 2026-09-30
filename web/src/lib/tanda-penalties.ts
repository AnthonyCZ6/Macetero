import {
  DAYS_EXPULSION,
  DAYS_LEVEL_DOWNGRADE,
  DAYS_POSTPONE_TURN,
  cargoPorRetraso,
  estadoPagoPorRetraso,
} from "@/lib/tanda";

export type PlanRetraso = {
  diasRetraso: number;
  estado: string;
  cargoRetraso: number;
  /** −POINTS_LATE_PENALTY y racha a 0; solo al pasar a `vencido` por primera vez. */
  penalizar: boolean;
  degradarNivel: boolean;
  posponerTurno: boolean;
  expulsar: boolean;
};

/**
 * Qué le toca a un pago abierto del periodo actual según sus días de retraso.
 * Es idempotente: correr el cron dos veces el mismo día produce el mismo plan
 * y la penalización de puntos solo se aplica en la transición a `vencido`.
 */
export function planearRetraso(pago: {
  estado: string;
  diasRetraso: number;
}): PlanRetraso {
  const dias = Math.max(0, pago.diasRetraso);
  const estado =
    pago.estado === "vencido" ? "vencido" : estadoPagoPorRetraso(dias);
  return {
    diasRetraso: dias,
    estado,
    cargoRetraso: cargoPorRetraso(dias),
    penalizar: estado === "vencido" && pago.estado !== "vencido",
    degradarNivel: dias >= DAYS_LEVEL_DOWNGRADE,
    posponerTurno: dias >= DAYS_POSTPONE_TURN && dias < DAYS_EXPULSION,
    expulsar: dias >= DAYS_EXPULSION,
  };
}

/**
 * Nuevo orden al mandar el turno `numeroTurno` al final: los turnos
 * posteriores bajan un lugar. Devuelve `[numeroActual, numeroNuevo]` por turno movido.
 */
export function reordenarAlFinal(
  numeroTurno: number,
  ultimoTurno: number
): Array<[number, number]> {
  const movimientos: Array<[number, number]> = [];
  for (let n = numeroTurno + 1; n <= ultimoTurno; n++) {
    movimientos.push([n, n - 1]);
  }
  movimientos.push([numeroTurno, ultimoTurno]);
  return movimientos;
}
