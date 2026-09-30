import "dotenv/config";
import { defineConfig } from "prisma/config";

// El esquema vive en web/ para que `web` genere su propio cliente al instalar
// (ver `postinstall` en web/package.json). Estos comandos se corren desde la raíz.
export default defineConfig({
  schema: "web/prisma/schema.prisma",
  migrations: {
    path: "web/prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
    directUrl: process.env["DIRECT_URL"],
  },
});
