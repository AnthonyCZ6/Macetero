import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/session";

describe("session tokens", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("devuelve el userId de un token válido", () => {
    const token = createSessionToken("user-123");
    expect(verifySessionToken(token)).toBe("user-123");
  });

  it("rechaza un token con el userId alterado", () => {
    const [, exp, sig] = createSessionToken("user-123").split(".");
    const forged = `${Buffer.from("otro-user").toString("base64url")}.${exp}.${sig}`;
    expect(verifySessionToken(forged)).toBeNull();
  });

  it("rechaza un token firmado con otro secreto", () => {
    const token = createSessionToken("user-123");
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rechaza un token expirado", () => {
    const hace31Dias = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const token = createSessionToken("user-123", hace31Dias);
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rechaza basura y valores vacíos", () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("a.b")).toBeNull();
    expect(verifySessionToken("a.b.c")).toBeNull();
  });

  it("sin SESSION_SECRET deriva la clave de WALLET_ENCRYPTION_KEY", () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("WALLET_ENCRYPTION_KEY", "ab".repeat(32));
    const token = createSessionToken("user-123");
    expect(verifySessionToken(token)).toBe("user-123");
  });

  it("sin ninguna clave configurada no emite sesiones", () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("WALLET_ENCRYPTION_KEY", "");
    expect(() => createSessionToken("user-123")).toThrow();
  });
});
