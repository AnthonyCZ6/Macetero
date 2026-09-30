import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "@/lib/crypto";

describe("encrypt / decrypt", () => {
  beforeEach(() => {
    vi.stubEnv("WALLET_ENCRYPTION_KEY", "ab".repeat(32));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("recupera el texto original", () => {
    const secret = "SBEXAMPLESECRETKEY";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("rechaza un tag de autenticación truncado", () => {
    const [iv, tag, data] = encrypt("secreto").split(":");
    expect(() => decrypt(`${iv}:${tag.slice(0, 8)}:${data}`)).toThrow();
  });

  it("rechaza un texto cifrado alterado", () => {
    const [iv, tag, data] = encrypt("secreto").split(":");
    const flipped = (parseInt(data[0], 16) ^ 1).toString(16) + data.slice(1);
    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow();
  });
});
