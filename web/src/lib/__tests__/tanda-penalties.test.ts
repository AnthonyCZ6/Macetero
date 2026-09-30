import { describe, expect, it } from "vitest";
import { planearRetraso, reordenarAlFinal } from "@/lib/tanda-penalties";
import { cargoPorRetraso, estadoPagoPorRetraso } from "@/lib/tanda";

describe("planearRetraso", () => {
  it("días 1-2: gracia sin cargo ni penalización", () => {
    const plan = planearRetraso({ estado: "pendiente", diasRetraso: 2 });
    expect(plan.estado).toBe("en_gracia");
    expect(plan.cargoRetraso).toBe(0);
    expect(plan.penalizar).toBe(false);
  });

  it("día 3: pasa a vencido, cobra cargo y penaliza una vez", () => {
    const plan = planearRetraso({ estado: "en_gracia", diasRetraso: 3 });
    expect(plan.estado).toBe("vencido");
    expect(plan.cargoRetraso).toBe(20);
    expect(plan.penalizar).toBe(true);
  });

  it("no vuelve a penalizar un pago que ya estaba vencido", () => {
    const plan = planearRetraso({ estado: "vencido", diasRetraso: 10 });
    expect(plan.penalizar).toBe(false);
    expect(plan.cargoRetraso).toBe(40);
  });

  it("baja de nivel desde el día 8, pospone del 15 al 20 y expulsa desde el 21", () => {
    expect(planearRetraso({ estado: "vencido", diasRetraso: 7 }).degradarNivel).toBe(false);
    expect(planearRetraso({ estado: "vencido", diasRetraso: 8 }).degradarNivel).toBe(true);
    expect(planearRetraso({ estado: "vencido", diasRetraso: 14 }).posponerTurno).toBe(false);
    expect(planearRetraso({ estado: "vencido", diasRetraso: 15 }).posponerTurno).toBe(true);
    const dia21 = planearRetraso({ estado: "vencido", diasRetraso: 21 });
    expect(dia21.posponerTurno).toBe(false);
    expect(dia21.expulsar).toBe(true);
  });

  it("es idempotente: el mismo día produce el mismo plan", () => {
    const a = planearRetraso({ estado: "en_gracia", diasRetraso: 4 });
    const b = planearRetraso({ estado: a.estado, diasRetraso: 4 });
    expect(b.estado).toBe(a.estado);
    expect(b.cargoRetraso).toBe(a.cargoRetraso);
    expect(b.penalizar).toBe(false);
  });
});

describe("estadoPagoPorRetraso / cargoPorRetraso", () => {
  it("mapea días de retraso a estado", () => {
    expect(estadoPagoPorRetraso(0)).toBe("pendiente");
    expect(estadoPagoPorRetraso(1)).toBe("en_gracia");
    expect(estadoPagoPorRetraso(3)).toBe("vencido");
  });

  it("cobra por semana o fracción a partir del día 3", () => {
    expect(cargoPorRetraso(2)).toBe(0);
    expect(cargoPorRetraso(7)).toBe(20);
    expect(cargoPorRetraso(8)).toBe(40);
  });
});

describe("reordenarAlFinal", () => {
  it("baja un lugar a los turnos posteriores y manda el turno al final", () => {
    expect(reordenarAlFinal(2, 5)).toEqual([
      [3, 2],
      [4, 3],
      [5, 4],
      [2, 5],
    ]);
  });

  it("produce números de turno únicos 1..n", () => {
    const n = 6;
    const finales = new Map<number, number>();
    for (let t = 1; t <= n; t++) finales.set(t, t);
    for (const [actual, nuevo] of reordenarAlFinal(3, n)) finales.set(actual, nuevo);
    expect([...finales.values()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
