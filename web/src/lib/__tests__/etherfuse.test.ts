import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "@/lib/etherfuse";

function signBody(raw: string, secret: string): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const secret = "test-webhook-secret-mx";
  const body = JSON.stringify({
    order_updated: { orderId: "ord-1", status: "completed" },
  });

  it("acepta firma HMAC-SHA256 hex correcta", () => {
    const sig = signBody(body, secret);
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("rechaza firma incorrecta", () => {
    expect(verifyWebhookSignature(body, "00".repeat(32), secret)).toBe(false);
  });

  it("rechaza firma vacía", () => {
    expect(verifyWebhookSignature(body, "", secret)).toBe(false);
  });

  it("funciona con Buffer como cuerpo", () => {
    const buf = Buffer.from(body, "utf8");
    const sig = signBody(body, secret);
    expect(verifyWebhookSignature(buf, sig, secret)).toBe(true);
  });
});
