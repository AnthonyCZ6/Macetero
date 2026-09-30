import { describe, expect, it } from "vitest";
import { stroopsToXlm } from "@/lib/stellar";

describe("stroopsToXlm", () => {
  it("convierte stroops a XLM con 7 decimales", () => {
    expect(stroopsToXlm(BigInt(0))).toBe("0.0000000");
    expect(stroopsToXlm(BigInt(1))).toBe("0.0000001");
    expect(stroopsToXlm(BigInt(10_000_000))).toBe("1.0000000");
    expect(stroopsToXlm(BigInt("123456789012345"))).toBe("12345678.9012345");
  });

  it("conserva el signo", () => {
    expect(stroopsToXlm(BigInt(-15_000_000))).toBe("-1.5000000");
  });
});
