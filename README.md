# Macetero

Backend con **Prisma** y **PostgreSQL** (Supabase).

## Scripts

| Comando | Descripción |
|--------|-------------|
| `npm run db:push` | Sincroniza el schema con la base de datos |
| `npm run db:generate` | Regenera el cliente Prisma |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:test` | Prueba inserción y lectura de usuarios |

Configura `DATABASE_URL` y `DIRECT_URL` en `.env` (ver Supabase → Settings → Database).
