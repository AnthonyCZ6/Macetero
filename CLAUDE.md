# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Macetero is a Spanish-language app for **tandas** (rotating savings groups) with Stellar wallets, Trustless Work escrows per payout period, and an MXN on/off-ramp via Etherfuse. Domain names, DB columns, UI copy, and commit messages are in Spanish. Commits use Conventional Commits with a scope, e.g. `fix(cron): ...` or `feat(trustless): ...`.

## Layout and commands

There are two separate npm packages, each with its own `node_modules` and lockfile. Run `npm install` in both.

- **Root (`/`)**: the Prisma CLI config (`prisma.config.ts`, which points at `web/prisma/schema.prisma`) and a few dev scripts in `server/` run with `tsx`. The root `tsconfig.json` only covers `server/**`.
- **`web/`**: the actual application, a Next.js 16 App Router app (React 19, Tailwind 4). All backend logic lives in its route handlers under `web/src/app/api/**`. There is no separate backend server. `web/` is self-contained: it owns the Prisma schema and generates its client in `postinstall`, so it builds with only `web/` installed (e.g. Vercel with Root Directory `web`).

```bash
# root
npm run db:push        # sync web/prisma/schema.prisma to Postgres (Supabase); no migrations folder in use
npm run db:generate    # regenerate web's Prisma client (runs web's prisma CLI)
npm run db:studio
npm run db:test        # upsert + list users via server/test-db.ts (imports web/src/lib/prisma)
npm run test:etherfuse-webhook [fixture.json]   # POST a signed fixture to a running dev server
npm run test:web       # = vitest in web/

# web/
npm run dev            # http://localhost:3000
npm run build
npm run lint           # eslint (next core-web-vitals + typescript)
npm run typecheck      # tsc --noEmit
npm run test           # vitest run (node env, only src/**/*.test.ts)
npx vitest run src/lib/__tests__/trustless-work.test.ts      # single file
npx vitest run -t "normalizeMilestones"                      # single test by name
```

The Prisma client must be generated from `web/`: Prisma resolves the client location from the schema's directory, and its CLI refuses to generate into a `node_modules` other than its own. That is why the schema lives in `web/prisma/` and root `db:generate` delegates to `web`.

**Env:** `.env.example` is the template. Copy it to `web/.env.local` (Next.js) and/or to the root `.env` (Prisma CLI and `server/` scripts). `server/send-etherfuse-webhook.ts` reads both files.

## Architecture

### Identity: signed session cookie
- `/api/auth/register` and `/api/auth/login` set an httpOnly cookie (`lib/session.ts`). The cookie holds `uid.exp` plus an HMAC-SHA256 signature keyed by `SESSION_SECRET`; if that variable is unset, the key is derived via HKDF from `WALLET_ENCRYPTION_KEY`.
- Every route gets the caller with `getSessionUserId(req)` and returns `unauthorizedResponse()` when there is none. **Never accept `userId` from the body or query string.**
- Membership checks for tanda-scoped reads go through `assertMiembroDeTanda` (`lib/tanda-acceso.ts`).
- Login is rate-limited in memory (`lib/rate-limit.ts`) and returns the same 401 message for an unknown email and for a wrong password. It also rehashes legacy unsalted SHA-256 hashes; the column is still named `pin_hash`.
- On the client, `hooks/useBackendUser.ts` confirms the session with `/api/auth/me` (one shared request per page load) and caches name/email in `localStorage` for display only. `clearSession` calls `/api/auth/logout`.

### Errors
Throw `AppError(message, status)` (`lib/api-error.ts`) for user-facing failures and end route handlers with `errorResponse(context, e)`. Any other error is logged and answered with a generic 500 in production (detailed message in dev). `isUniqueViolation` detects Prisma P2002 for race handling.

### Two independent wallet systems
1. **Custodial server keypair** (`Wallet` table): a Stellar keypair created at registration, in the same write as the user. The secret is stored AES-256-GCM encrypted (`lib/crypto.ts`, `WALLET_ENCRYPTION_KEY`, format `iv:tag:ciphertext`). Server code decrypts it to sign on the user's behalf: tanda payments, offramp, and the organizer's escrow deploy. **There is no endpoint that signs a client-supplied XDR**: every transaction is built server-side.
2. **Passkey smart account** (client-only): `components/WalletProvider.tsx` plus `hooks/useWallet.ts`, built on `smart-account-kit` and WebAuthn, holding a `C…` contract address. It is used by home, send, receive, and vault. Its balance comes from `/api/wallet/soroban-balance` (`getSACBalance`). WebAuthn requires `localhost` (not `127.0.0.1`) or HTTPS.

Tandas and escrow always use the custodial keypair. `lib/stellar.ts#getBalance` handles both `G…` accounts (`getAccountEntry`) and `C…` contracts.

### Tanda lifecycle (Prisma models `Tanda`, `Turno`, `Pago`, `TandaEscrow`)
- **Tanda states:** `Tanda.estado` goes `pendiente` → `activa` → `completada`. `Turno.numero_turno` is the period in which that participant receives the pot; for period *p* the receiver is the turno with `numero_turno == p`.
- **Activation:** `activarTanda` (`lib/tanda-periodo.ts`) runs when the last seat fills (`/api/tandas/join`) and when a completed tanda is repeated (`/api/tandas/[id]/repeat`). It sets `periodo_actual = 1`, moves a past `fecha_inicio` to now, sets each turno's `fecha_cobro`, and pre-creates **every** `Pago` (participants × periods).
- **Pago states:** `Pago.estado` goes `pendiente` → `en_gracia` (days 1–2 late) → `vencido` (day 3+) → `pagado`. Two more states exist:
  - `procesando` (a claimed in-flight payment). While a pago is `procesando`, `fecha_pago` holds the claim time; claims older than 10 minutes can be retaken.
  - `cancelado` (the contribution of an expelled member, or a skipped period).
  - Use `PAGO_ESTADOS_ABIERTOS` / `PAGO_ESTADOS_SALDADOS` from `lib/tanda.ts`, not literal lists.
- **Paying:** `/api/tandas/[id]/pay` atomically claims the pago (`updateMany` from an open state to `procesando`), moves money, marks it `pagado`, then calls `cerrarPeriodoSiCompleto`. If money movement fails, the claim is reverted.
- **Closing a period:** `cerrarPeriodoSiCompleto` is the single place that closes a period. It:
  - releases the escrow (if any);
  - advances `periodo_actual` with a compare-and-set, so only one caller wins;
  - skips periods whose receiver was expelled, cancelling their pagos;
  - recalculates the due dates of the remaining periods from `max(due date, now)`, so a late period never makes the next one overdue.
  - The penalties cron retries closes that failed.
- **Penalties cron:** `/api/cron/tanda-penalties` only looks at pagos of the **current** period of active tandas. It counts calendar days in `APP_TIMEZONE` (`lib/fechas.ts`, default `America/Mexico_City`) and applies `planearRetraso` (`lib/tanda-penalties.ts`), which is idempotent. Consequences by day:
  - Day 3: −points, applied once, on the transition to `vencido`.
  - Day 8: level downgrade.
  - Day 15: the turn moves to the end and is marked `pospuesto`, but only if that turn hasn't come yet. It uses a temporary `numero_turno` inside a transaction to respect `@@unique([tanda_id, numero_turno])`.
  - Day 21: expulsion. The turno becomes `expulsado`, the member's open pagos become `cancelado`, and the user is blocked for `BLOCK_DAYS`. `bloqueoVigente` treats the block as expired after `block_undate`.
- **Cron routes:** `/api/cron/*` export both `GET` (Vercel Cron) and `POST` and must call `isCronAuthorized` (`lib/cron-auth.ts`, fail closed). Schedules are in `web/vercel.json`.

### Trustless Work escrow
- **API key:** `web/src/lib/trustless-work.ts` is the **only** place that reads `TRUSTLESS_WORK_API_KEY`. The key must never be `NEXT_PUBLIC_` or reach the browser. The only `/api/trustless/*` route left is `deploy`, a Postman/admin tool gated by `Authorization: Bearer $ADMIN_API_SECRET`.
- **Escrow per period:** each (tanda, periodo) gets one **single-release** escrow in `TandaEscrow` (unique `[tanda_id, periodo]`; `saveTandaEscrow` resolves races). It has one milestone per participant. `milestoneIndexForUser` orders milestones by turno `createdAt`, **not** `numero_turno`, so postponing a turn doesn't shift milestones. The receiver is that period's turno wallet. Orchestration lives in `lib/tanda-escrow.ts`.
- **Organizer deploy:**
  - `EscrowOrganizerDeploySection` calls `/api/tandas/[id]/escrow-preview`, then `POST /escrow-deploy`. The server builds the terms from the tanda and signs with the organizer's custodial key.
  - If the indexer hasn't seen the contract yet, the response is `pending_index`, and the client retries `/escrow-finalize`.
  - If nobody deploys, the pay route deploys with the operator key (`ensureEscrowForCurrentPeriod`).
- **Pay flow with escrow:** when `trustlessWorkConfigured()` is true (`TRUSTLESS_WORK_ENABLED=true` + API key + signer secret), each payment funds the escrow, then marks the milestone `Completed` (signed by serviceProvider), then approves it (signed by approver).
  - The period close runs `releaseEscrowForPeriod`. It claims the row (`deployed` → `releasing`, stale after 10 min), approves milestones of `cancelado` pagos without funds, then releases (signed by releaseSigner).
  - Late fees are paid in native XLM to the organizer.
  - When Trustless Work is off, the route sends a direct XLM payment instead.
- **Roles:** escrow roles come from `TRUSTLESS_*_G` env vars and default to the signer account (`TRUSTLESS_SIGNER_SECRET`, alias `TRUSTLESS_WORK_OPERATOR_SECRET`). `resolveSecretForPublicKey` finds the matching `TRUSTLESS_*_SECRET`. `submitTwSignedXdr` tries TW's `/helper/send-transaction`, then Soroban RPC.
- **Project skill:** `.claude/skills/trustless-work` documents the TW API, SDK, and XDR signing rules. Use it before changing this integration.

### Etherfuse (ramp + KYC)
`lib/etherfuse.ts` wraps the Etherfuse API: wallet registration, onboarding URL, quotes, and orders. Routes live under `/api/ramp/*` and `/api/kyc/onboard`; `returnUrl` must be same-origin.

`/api/webhooks/etherfuse` updates `Order`, `User.kyc_status`, and `BankAccount`. It verifies the HMAC-SHA256 `x-signature` when `ETHERFUSE_WEBHOOK_SECRET` is set. Without the secret it responds 503 in production and accepts unsigned requests only in development.

Sample payloads are in `server/fixtures/etherfuse-webhook/`, and a Postman collection is in `postman/`.

### Dev/demo flags
- `TANDA_PAY_VISUAL_ONLY=true`: the pay route updates only the DB, with no Stellar or escrow calls.
- `SIMULATE_ESCROW_ON_CREATE=true`: creating a tanda inserts a fake `SIM_…` `TandaEscrow`. Pair it with `TANDA_PAY_VISUAL_ONLY`, because real payments refuse simulated escrows.

Stellar config (`lib/stellar.ts`) defaults to testnet and `soroban-testnet.stellar.org`. Routes that chain on-chain calls export `maxDuration`.
