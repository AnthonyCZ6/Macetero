# Macetero

Tandas (ahorro rotativo) con wallets Stellar, escrow por periodo con Trustless Work y rampa MXN con Etherfuse.
La app es Next.js en `web/`; la base de datos es PostgreSQL (Supabase) vía Prisma.

## Puesta en marcha

```bash
npm install                 # raíz: CLI de Prisma y scripts de server/
cd web && npm install       # genera el cliente Prisma (postinstall)
cp ../.env.example .env.local   # completa las variables
cd .. && npm run db:push    # crea/actualiza las tablas
cd web && npm run dev       # http://localhost:3000
```

Las variables están documentadas en `.env.example`. La raíz usa `.env` (Prisma y `server/`); la app, `web/.env.local`.

## Scripts (raíz)

| Comando | Descripción |
|--------|-------------|
| `npm run db:push` | Sincroniza `web/prisma/schema.prisma` con la base de datos |
| `npm run db:generate` | Regenera el cliente Prisma de `web/` |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:test` | Prueba inserción y lectura de usuarios |
| `npm run test:etherfuse-webhook [fixture]` | Envía un webhook firmado al servidor local |
| `npm run test:web` | Tests de `web/` |

## Scripts (`web/`)

`npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`.

## Despliegue

- En Vercel, usa `web` como Root Directory. Los crons están en `web/vercel.json` y se autentican con `CRON_SECRET`.
- En producción son obligatorios `ETHERFUSE_WEBHOOK_SECRET` y `SESSION_SECRET` (o `WALLET_ENCRYPTION_KEY`, del que se deriva).
