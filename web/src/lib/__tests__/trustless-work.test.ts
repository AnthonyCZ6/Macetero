import { Keypair } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMPACTA_APPROVER_G,
  DEFAULT_TRUSTLESS_WALLET_G,
  DEFAULT_TRUSTLINE_USDC_TESTNET,
  getRoleAddresses,
  getTrustlineConfig,
  normalizeMilestones,
} from "@/lib/trustless-work";

describe("normalizeMilestones", () => {
  it("rellena title y description desde description sola", () => {
    const out = normalizeMilestones([{ description: "Pago 1" }]);
    expect(out[0]?.title).toBe("Meta 1");
    expect(out[0]?.description).toBe("Pago 1");
  });

  it("usa title cuando viene", () => {
    const out = normalizeMilestones([{ title: "A", description: "B" }]);
    expect(out[0]).toEqual({ title: "A", description: "B" });
  });

  it("genera pasos por índice si faltan textos", () => {
    const out = normalizeMilestones([{}]);
    expect(out[0]?.description).toContain("Paso");
  });
});

describe("getTrustlineConfig", () => {
  beforeEach(() => {
    vi.stubEnv("TRUSTLINE_ISSUER_G", "");
    vi.stubEnv("TRUSTLINE_SYMBOL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa USDC testnet por defecto", () => {
    const c = getTrustlineConfig();
    expect(c.address).toBe(DEFAULT_TRUSTLINE_USDC_TESTNET.address);
    expect(c.symbol).toBe("USDC");
  });

  it("respeta env override", () => {
    vi.stubEnv("TRUSTLINE_ISSUER_G", "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
    vi.stubEnv("TRUSTLINE_SYMBOL", "MXN");
    const c = getTrustlineConfig();
    expect(c.symbol).toBe("MXN");
  });
});

describe("getRoleAddresses", () => {
  const kp = Keypair.random();

  beforeEach(() => {
    vi.stubEnv("TRUSTLESS_SIGNER_SECRET", kp.secret());
    vi.stubEnv("TRUSTLESS_WORK_OPERATOR_SECRET", "");
    vi.stubEnv("TRUSTLESS_USE_IMPACTA_ROLE_DEFAULTS", "");
    vi.stubEnv("TRUSTLESS_TEAM_WALLET_G", "");
    vi.stubEnv("TRUSTLESS_APPROVER_G", "");
    vi.stubEnv("TRUSTLESS_DISPUTE_RESOLVER_G", "");
    vi.stubEnv("TRUSTLESS_SERVICE_PROVIDER_G", "");
    vi.stubEnv("TRUSTLESS_PLATFORM_ADDRESS_G", "");
    vi.stubEnv("TRUSTLESS_RELEASE_SIGNER_G", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sin Impacta, todos los roles coinciden con la cuenta del signer", () => {
    const pk = kp.publicKey();
    const r = getRoleAddresses();
    expect(r.approver).toBe(pk);
    expect(r.serviceProvider).toBe(pk);
    expect(r.platformAddress).toBe(pk);
    expect(r.releaseSigner).toBe(pk);
    expect(r.disputeResolver).toBe(pk);
  });

  it("con Impacta, approver y dispute usan issuer Impacta", () => {
    vi.stubEnv("TRUSTLESS_USE_IMPACTA_ROLE_DEFAULTS", "true");
    const r = getRoleAddresses();
    expect(r.approver).toBe(DEFAULT_IMPACTA_APPROVER_G);
    expect(r.disputeResolver).toBe(DEFAULT_IMPACTA_APPROVER_G);
    expect(r.serviceProvider).toBe(kp.publicKey());
  });

  it("TRUSTLESS_APPROVER_G override", () => {
    const custom = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBQ";
    vi.stubEnv("TRUSTLESS_APPROVER_G", custom);
    const r = getRoleAddresses();
    expect(r.approver).toBe(custom);
  });

  it("TRUSTLESS_TEAM_WALLET_G fuerza rol base cuando está definido", () => {
    const team = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCQ";
    vi.stubEnv("TRUSTLESS_TEAM_WALLET_G", team);
    const r = getRoleAddresses();
    expect(r.serviceProvider).toBe(team);
    expect(r.platformAddress).toBe(team);
    expect(r.releaseSigner).toBe(team);
  });
});

describe("DEFAULT_TRUSTLESS_WALLET_G", () => {
  it("es la wallet documentada para escrow Macetero", () => {
    expect(DEFAULT_TRUSTLESS_WALLET_G).toMatch(/^G[A-Z0-9]{55}$/);
    expect(DEFAULT_TRUSTLESS_WALLET_G).toBe(
      "GAMAANR75JRJX3GH7C7KOAIQC342HQQOFDOG7BCDB7MZXVB2IJMNWSZ3"
    );
  });
});
