import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/tanda-escrow", () => ({ releaseEscrowForPeriod: vi.fn() }));

import { planearAvance, recalcularCalendario } from "@/lib/tanda-periodo";
import { diasEntre } from "@/lib/fechas";

describe("planearAvance", () => {
  it("avanza al siguiente periodo", () => {
    expect(planearAvance(1, 4, new Set())).toEqual({ siguiente: 2, saltados: [] });
  });

  it("completa la tanda al cerrar el último periodo", () => {
    expect(planearAvance(4, 4, new Set())).toEqual({ siguiente: null, saltados: [] });
  });

  it("salta los periodos cuyo receptor fue expulsado", () => {
    expect(planearAvance(1, 5, new Set([2, 3]))).toEqual({
      siguiente: 4,
      saltados: [2, 3],
    });
  });

  it("si solo quedan periodos de expulsados, la tanda termina", () => {
    expect(planearAvance(3, 4, new Set([4]))).toEqual({
      siguiente: null,
      saltados: [4],
    });
  });
});

describe("recalcularCalendario", () => {
  const base = new Date("2026-03-01T12:00:00Z");

  it("espacia los periodos restantes según la frecuencia", () => {
    const fechas = recalcularCalendario(base, "semanal", [3, 4]);
    expect(diasEntre(base, fechas.get(3)!)).toBe(7);
    expect(diasEntre(base, fechas.get(4)!)).toBe(14);
  });

  it("un periodo saltado no deja hueco en el calendario", () => {
    const fechas = recalcularCalendario(base, "quincenal", [2, 4]);
    expect(diasEntre(base, fechas.get(2)!)).toBe(14);
    expect(diasEntre(base, fechas.get(4)!)).toBe(28);
    expect(fechas.has(3)).toBe(false);
  });
});

describe("diasEntre (zona horaria de la app)", () => {
  it("cuenta días de calendario en America/Mexico_City, no en UTC", () => {
    // 23:30 del día 10 en CDMX = 05:30 UTC del día 11.
    const vence = new Date("2026-03-11T05:30:00Z");
    const ahora = new Date("2026-03-11T07:00:00Z"); // 01:00 del día 11 en CDMX
    expect(diasEntre(vence, ahora, "America/Mexico_City")).toBe(1);
    expect(diasEntre(vence, ahora, "UTC")).toBe(0);
  });
});
