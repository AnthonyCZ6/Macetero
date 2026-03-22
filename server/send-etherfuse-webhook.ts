/**
 * Prueba local del endpoint POST /api/webhooks/etherfuse (mismo cuerpo que Etherfuse: JSON + firma HMAC).
 *
 * Uso (con el dev server en marcha: cd web && npm run dev):
 *   npx tsx server/send-etherfuse-webhook.ts
 *   npx tsx server/send-etherfuse-webhook.ts server/fixtures/etherfuse-webhook/01-order-updated-completed.json
 *
 * Variables (.env o web/.env.local):
 *   ETHERFUSE_WEBHOOK_SECRET — debe coincidir con la del servidor; si está vacía, el handler no exige firma.
 *   WEBHOOK_TEST_BASE_URL — por defecto http://localhost:3000
 *
 * Nota sobre XML: este proyecto no parsea XML en el webhook; Etherfuse envía JSON.
 * Si tienes payloads en XML (p. ej. de otro proveedor), hay que mapearlos a este JSON
 * o añadir otro route que traduzca XML → el mismo shape que consume route.ts.
 */

import { config } from "dotenv";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "web/.env.local"), override: true });

const BASE =
  process.env["WEBHOOK_TEST_BASE_URL"] || "http://localhost:3000";
const SECRET = process.env["ETHERFUSE_WEBHOOK_SECRET"] || "";
const DEFAULT_FIXTURE =
  "server/fixtures/etherfuse-webhook/01-order-updated-completed.json";

function signBody(raw: string): string {
  return createHmac("sha256", SECRET).update(raw).digest("hex");
}

async function main() {
  const fixturePath = resolve(process.cwd(), process.argv[2] || DEFAULT_FIXTURE);
  let raw = readFileSync(fixturePath, "utf8");
  // Permite reemplazos rápidos sin editar el archivo
  raw = raw.replace(/REPLACE_ORDER_EF_ID/g, process.env["TEST_EF_ORDER_ID"] || "REPLACE_ORDER_EF_ID");
  raw = raw.replace(
    /REPLACE_CUSTOMER_EF_ID/g,
    process.env["TEST_EF_CUSTOMER_ID"] || "REPLACE_CUSTOMER_EF_ID"
  );
  raw = raw.replace(
    /REPLACE_BANK_EF_ID/g,
    process.env["TEST_EF_BANK_ACCOUNT_ID"] || "REPLACE_BANK_EF_ID"
  );

  const url = `${BASE.replace(/\/$/, "")}/api/webhooks/etherfuse`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (SECRET) {
    headers["x-signature"] = signBody(raw);
  }

  console.log("POST", url);
  console.log("Fixture:", fixturePath);
  if (!SECRET) {
    console.warn(
      "ETHERFUSE_WEBHOOK_SECRET vacío: el servidor aceptará sin firma (solo para desarrollo)."
    );
  }

  const res = await fetch(url, { method: "POST", headers, body: raw });
  const text = await res.text();
  console.log(res.status, text);
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
