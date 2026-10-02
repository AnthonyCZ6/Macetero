/**
 * Pruebas end-to-end por HTTP contra la build de producción (`next start`): auth, tandas,
 * pagos concurrentes, cierre de periodos, cron de penalizaciones, repetir tanda, webhook
 * de Etherfuse y guardas de admin.
 *
 * Uso:
 *   npm run test:e2e          compila web/ y corre este script
 *   npx tsx server/e2e.ts     usa la build que ya exista en web/.next
 *
 * Base de datos — NUNCA la de producción:
 *   E2E_DATABASE_URL, o DATABASE_URL de `.env.pruebas.local` (raíz, ignorado por git).
 *   Se niega a correr si coincide con DATABASE_URL/DIRECT_URL de `.env` o `web/.env.local`.
 *   Antes de empezar sincroniza el esquema (`prisma db push`) en esa base.
 *
 * El servidor corre con TANDA_PAY_VISUAL_ONLY=true (sin Stellar ni escrow), secretos aleatorios
 * y Etherfuse apuntando a un puerto cerrado: ninguna prueba llama a servicios externos.
 * Si todo pasa borra los datos que creó; si algo falla los conserva para depurar.
 *
 * Opcional: E2E_PORT (por defecto 3100).
 */

import { spawn, type ChildProcess } from "child_process";
import { createHash, createHmac, randomBytes } from "crypto";
import { createWriteStream, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { parse } from "dotenv";

type PrismaModule = typeof import("../web/src/lib/prisma");
type Prisma = PrismaModule["prisma"];

const ROOT = resolve(__dirname, "..");
const PORT = Number(process.env["E2E_PORT"] || 3100);
const BASE = `http://localhost:${PORT}`;
const DIA = 86_400_000;
const PASS = "contrasena-segura-1";
const run = Date.now().toString(36);
const email = (nombre: string) => `${nombre}.${run}@prueba.mx`;
const secreto = () => randomBytes(32).toString("hex");
const SECRETOS = { cron: secreto(), admin: secreto(), webhook: secreto() };

// ── Configuración ────────────────────────────────────────────────────────

function leerEnv(archivo: string): Record<string, string> {
  const ruta = join(ROOT, archivo);
  return existsSync(ruta) ? parse(readFileSync(ruta)) : {};
}

function urlDePruebas(): string {
  const url =
    process.env["E2E_DATABASE_URL"]?.trim() ||
    leerEnv(".env.pruebas.local")["DATABASE_URL"]?.trim();
  if (!url) {
    throw new Error(
      "Falta la base de PRUEBAS: define E2E_DATABASE_URL o DATABASE_URL en .env.pruebas.local"
    );
  }
  for (const archivo of [".env", "web/.env.local"]) {
    const env = leerEnv(archivo);
    for (const clave of ["DATABASE_URL", "DIRECT_URL"]) {
      if (env[clave]?.trim() === url) {
        throw new Error(
          `La base de pruebas es la misma que ${clave} de ${archivo}; no se corre contra esa base.`
        );
      }
    }
  }
  return url;
}

function correr(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((ok, mal) => {
    const p = spawn(process.execPath, args, { cwd: ROOT, env, stdio: "inherit" });
    p.on("error", mal);
    p.on("exit", (code) =>
      code === 0 ? ok() : mal(new Error(`${args.slice(1).join(" ")} terminó con código ${code}`))
    );
  });
}

async function levantarServidor(databaseUrl: string): Promise<{ proceso: ChildProcess; log: string }> {
  if (!existsSync(join(ROOT, "web/.next/BUILD_ID"))) {
    throw new Error("No hay build en web/.next: usa `npm run test:e2e` o `npm run build --prefix web`.");
  }
  if (await fetch(BASE).then(() => true, () => false)) {
    throw new Error(`Ya hay algo escuchando en ${BASE}; elige otro puerto con E2E_PORT.`);
  }

  // Lo que se define aquí gana sobre web/.env.local (Next no sobrescribe variables existentes).
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    WALLET_ENCRYPTION_KEY: secreto(),
    SESSION_SECRET: secreto(),
    CRON_SECRET: SECRETOS.cron,
    ADMIN_API_SECRET: SECRETOS.admin,
    ETHERFUSE_WEBHOOK_SECRET: SECRETOS.webhook,
    ETHERFUSE_BASE_URL: "http://127.0.0.1:9",
    ETHERFUSE_API_KEY: "e2e-sin-clave",
    TANDA_PAY_VISUAL_ONLY: "true",
    SIMULATE_ESCROW_ON_CREATE: "false",
    TRUSTLESS_WORK_ENABLED: "false",
    APP_TIMEZONE: "America/Mexico_City",
  };
  const log = join(tmpdir(), "macetero-e2e-server.log");
  const salida = createWriteStream(log);
  const proceso = spawn(
    process.execPath,
    [join(ROOT, "web/node_modules/next/dist/bin/next"), "start", "-p", String(PORT), "-H", "localhost"],
    { cwd: join(ROOT, "web"), env }
  );
  proceso.stdout?.pipe(salida);
  proceso.stderr?.pipe(salida);

  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) {
      throw new Error(`next start terminó con código ${proceso.exitCode}; revisa ${log}`);
    }
    if (await fetch(BASE).then((r) => r.ok, () => false)) return { proceso, log };
    await new Promise((r) => setTimeout(r, 500));
  }
  proceso.kill();
  throw new Error(`next start no respondió en 60 s; revisa ${log}`);
}

// ── Utilidades de prueba ─────────────────────────────────────────────────

let pasaron = 0;
const fallos: string[] = [];
let seccion = "";

function sec(nombre: string) {
  seccion = nombre;
  console.log(`\n== ${nombre}`);
}

function ok(nombre: string, cond: unknown, detalle?: unknown) {
  if (cond) {
    pasaron++;
    console.log(`  ✓ ${nombre}`);
    return;
  }
  fallos.push(`[${seccion}] ${nombre}`);
  const extra =
    detalle === undefined ? "" : `  → ${typeof detalle === "string" ? detalle : JSON.stringify(detalle)}`;
  console.log(`  ✗ ${nombre}${extra}`);
}

type Respuesta = {
  status: number;
  json: any;
  text: string;
  setCookie?: string;
  token?: string;
};

async function api(
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; headers?: Record<string, string>; raw?: string } = {}
): Promise<Respuesta> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.cookie) headers["cookie"] = `macetero_session=${opts.cookie}`;
  let body: string | undefined = opts.raw;
  if (body === undefined && opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["content-type"] = "application/json";
  }
  const res = await fetch(BASE + path, { method, headers, body, redirect: "manual" });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith("macetero_session="));
  const token = setCookie?.split(";")[0].slice("macetero_session=".length);
  return { status: res.status, json, text, setCookie, token };
}

// ── Pruebas ──────────────────────────────────────────────────────────────

async function pruebas(prisma: Prisma, U: Record<string, { id: string; token?: string }>) {
  let r: Respuesta;

  sec("Páginas");
  for (const p of ["/", "/entrar", "/registro", "/onboarding", "/tandas", "/perfil", "/perfil/mi-ahorro", "/liga", "/send", "/receive", "/vault"]) {
    r = await api("GET", p);
    ok(`GET ${p} → 200`, r.status === 200, r.status);
  }

  sec("Autenticación");
  r = await api("GET", "/api/auth/me");
  ok("me sin cookie → 401", r.status === 401, r.status);
  r = await api("GET", "/api/auth/me", { cookie: "dXNlcg.9999999999.firmaFalsa" });
  ok("me con cookie forjada → 401", r.status === 401, r.status);

  r = await api("POST", "/api/auth/register", { body: { email: email("x") } });
  ok("registro sin password → 400", r.status === 400, r.status);
  r = await api("POST", "/api/auth/register", { body: { email: "no-es-correo", password: PASS } });
  ok("registro con correo inválido → 400", r.status === 400, r.status);
  r = await api("POST", "/api/auth/register", { body: { email: email("x"), password: "corta" } });
  ok("registro con password corta → 400", r.status === 400, r.status);

  for (const n of ["ana", "beto", "carla", "dani"]) {
    r = await api("POST", "/api/auth/register", { body: { email: email(n), password: PASS, name: n } });
    ok(`registro ${n} → 200`, r.status === 200 && r.json?.userId, r.json ?? r.status);
    ok(`registro ${n} fija cookie httpOnly`, !!r.token && /HttpOnly/i.test(r.setCookie ?? ""), r.setCookie);
    ok(`registro ${n} devuelve publicKey G…`, /^G[A-Z2-7]{55}$/.test(r.json?.publicKey ?? ""), r.json?.publicKey);
    U[n] = { id: r.json?.userId, token: r.token };
  }
  r = await api("POST", "/api/auth/register", { body: { email: email("ana").toUpperCase(), password: PASS } });
  ok("registro duplicado (mayúsculas) → 409", r.status === 409, r.status);

  const w = await prisma.wallet.findUnique({ where: { userId: U.ana.id } });
  ok(
    "secreto de wallet cifrado iv:tag:ct (no empieza con S)",
    !!w && w.encrypted_secret.split(":").length === 3 && !w.encrypted_secret.startsWith("S"),
    w?.encrypted_secret.slice(0, 20)
  );

  r = await api("GET", "/api/auth/me", { cookie: U.ana.token });
  ok("me con sesión válida → 200 y mismo userId", r.status === 200 && r.json?.userId === U.ana.id, r.json);

  r = await api("POST", "/api/auth/login", { body: { email: email("ana"), password: "incorrecta-123" } });
  const msgMalPass = r.json?.error;
  ok("login password incorrecta → 401", r.status === 401, r.status);
  r = await api("POST", "/api/auth/login", { body: { email: email("noexiste"), password: "incorrecta-123" } });
  ok("login correo inexistente → 401 con el mismo mensaje", r.status === 401 && r.json?.error === msgMalPass, r.json);
  r = await api("POST", "/api/auth/login", { body: { email: `  ${email("ana").toUpperCase()} `, password: PASS } });
  ok("login correcto (correo con espacios/mayúsculas) → 200 + cookie", r.status === 200 && !!r.token, r.status);

  r = await api("POST", "/api/auth/logout", { cookie: U.ana.token });
  ok("logout borra cookie (Max-Age=0)", r.status === 200 && /Max-Age=0/i.test(r.setCookie ?? ""), r.setCookie);

  const estados: number[] = [];
  for (let i = 0; i < 11; i++) {
    estados.push((await api("POST", "/api/auth/login", { body: { email: email("ratelimit"), password: "x".repeat(10) } })).status);
  }
  ok("rate limit: 10 intentos 401 y el 11º → 429", estados.slice(0, 10).every((s) => s === 401) && estados[10] === 429, estados);

  // Hash legado SHA-256 → se migra a scrypt al iniciar sesión
  await prisma.user.update({
    where: { id: U.dani.id },
    data: { pin_hash: createHash("sha256").update(PASS).digest("hex") },
  });
  r = await api("POST", "/api/auth/login", { body: { email: email("dani"), password: PASS } });
  const dani = await prisma.user.findUniqueOrThrow({ where: { id: U.dani.id } });
  ok("login con hash legado → 200 y se rehashea a scrypt", r.status === 200 && dani.pin_hash.startsWith("scrypt$"), dani.pin_hash.slice(0, 12));

  sec("Rutas protegidas sin sesión");
  for (const [m, p] of [
    ["GET", "/api/tandas"], ["POST", "/api/tandas"], ["POST", "/api/tandas/join"],
    ["GET", "/api/user/profile"], ["GET", "/api/user/movimientos"], ["GET", "/api/user/wallet-public"],
    ["POST", "/api/kyc/onboard"], ["POST", "/api/acta/api-keys"], ["POST", "/api/tandas/x/pay"], ["GET", "/api/tandas/x"],
  ]) {
    r = await api(m, p, m === "GET" ? {} : { body: {} });
    ok(`${m} ${p} sin sesión → 401`, r.status === 401, r.status);
  }

  sec("Crear tanda: validaciones");
  const base = {
    nombre: "Tanda prueba",
    monto_aportacion: 100,
    frecuencia: "semanal",
    num_participantes: 3,
    fecha_inicio: new Date(Date.now() - DIA).toISOString(),
  };
  for (const [desc, cambio] of [
    ["sin nombre", { nombre: "" }], ["1 participante", { num_participantes: 1 }],
    ["51 participantes", { num_participantes: 51 }], ["frecuencia inválida", { frecuencia: "diaria" }],
    ["monto 0", { monto_aportacion: 0 }], ["fecha inválida", { fecha_inicio: "no-fecha" }],
  ] as const) {
    r = await api("POST", "/api/tandas", { cookie: U.ana.token, body: { ...base, ...cambio } });
    ok(`crear tanda con ${desc} → 400`, r.status === 400, r.status);
  }

  sec("Tanda T1 (3 personas): unirse y activar");
  r = await api("POST", "/api/tandas", {
    cookie: U.ana.token,
    body: { ...base, nombre: "T1", userId: U.beto.id, organizador_id: U.beto.id },
  });
  ok("crear T1 → 200", r.status === 200 && r.json?.tandaId, r.json ?? r.status);
  const T1: string = r.json?.tandaId;
  const cod1: string = r.json?.codigoInvitacion ?? "";
  const t1 = await prisma.tanda.findUnique({ where: { id: T1 } });
  ok("organizador = usuario de la sesión (ignora userId del body)", t1?.organizador_id === U.ana.id, t1?.organizador_id);

  r = await api("POST", "/api/tandas/join", { cookie: U.beto.token, body: { codigo: "NOEXISTE" } });
  ok("unirse con código inexistente → 404", r.status === 404, r.status);
  r = await api("POST", "/api/tandas/join", { cookie: U.ana.token, body: { codigo: cod1 } });
  ok("organizador se une otra vez → 409", r.status === 409, r.status);
  r = await api("POST", "/api/tandas/join", { cookie: U.beto.token, body: { codigo: cod1.toLowerCase() } });
  ok("beto se une (código en minúsculas) → turno 2, pendiente", r.status === 200 && r.json?.turnoAsignado === 2 && r.json?.estado === "pendiente", r.json);
  r = await api("GET", `/api/tandas/${T1}`, { cookie: U.dani.token });
  ok("no miembro no puede ver T1 → 403/404", [403, 404].includes(r.status), r.status);
  r = await api("POST", "/api/tandas/join", { cookie: U.carla.token, body: { codigo: cod1 } });
  ok("carla llena la tanda → turno 3, activa", r.status === 200 && r.json?.turnoAsignado === 3 && r.json?.estado === "activa", r.json);
  r = await api("POST", "/api/tandas/join", { cookie: U.dani.token, body: { codigo: cod1 } });
  ok("dani a tanda llena/activa → 400", r.status === 400, r.json);

  const pagosT1 = await prisma.pago.findMany({ where: { tanda_id: T1 }, orderBy: { periodo: "asc" } });
  ok("activación crea 9 pagos (3×3) pendientes", pagosT1.length === 9 && pagosT1.every((p) => p.estado === "pendiente"), pagosT1.length);
  const t1a = await prisma.tanda.findUniqueOrThrow({ where: { id: T1 } });
  ok(
    "T1 activa, periodo 1, fecha_inicio pasada movida a ahora",
    t1a.estado === "activa" && t1a.periodo_actual === 1 && Math.abs(Date.now() - t1a.fecha_inicio.getTime()) < 5 * 60_000,
    { estado: t1a.estado, periodo: t1a.periodo_actual, inicio: t1a.fecha_inicio }
  );
  const venc = [1, 2, 3].map((p) => pagosT1.find((x) => x.periodo === p)!.fecha_vencimiento!.getTime());
  ok(
    "vencimientos escalonados semanalmente",
    Math.abs(venc[1] - venc[0] - 7 * DIA) < 2 * 3_600_000 && Math.abs(venc[2] - venc[1] - 7 * DIA) < 2 * 3_600_000,
    venc.map((v) => new Date(v).toISOString())
  );

  r = await api("GET", `/api/tandas/${T1}`, { cookie: U.beto.token });
  ok("detalle T1 para miembro → 200, 3 participantes, payVisualOnly", r.status === 200 && r.json?.participants?.length === 3 && r.json?.payVisualOnly === true, r.json ?? r.status);
  r = await api("GET", "/api/tandas", { cookie: U.carla.token });
  ok("listado de carla incluye T1 con miTurno 3", r.status === 200 && r.json?.tandas?.some((t: { id: string; miTurno: number }) => t.id === T1 && t.miTurno === 3), r.json);

  sec("T1: pagos, concurrencia y cierre de periodos");
  const puntos = (id: string) => prisma.user.findUniqueOrThrow({ where: { id }, select: { score: true, streak: true } });
  const anaAntes = await puntos(U.ana.id);
  r = await api("POST", `/api/tandas/${T1}/pay`, { cookie: U.ana.token });
  ok("ana paga periodo 1 → 200 visual_demo, sin cierre aún", r.status === 200 && r.json?.mode === "visual_demo" && r.json?.prizeDelivered === false, r.json);
  const anaDesp = await puntos(U.ana.id);
  ok("pago a tiempo suma +40 puntos y racha +1", anaDesp.score - anaAntes.score === 40 && anaDesp.streak - anaAntes.streak === 1, { anaAntes, anaDesp });
  r = await api("POST", `/api/tandas/${T1}/pay`, { cookie: U.ana.token });
  ok("ana paga dos veces → 409", r.status === 409, r.json);
  r = await api("POST", `/api/tandas/${T1}/pay`, { cookie: U.dani.token });
  ok("no miembro intenta pagar → 404", r.status === 404, r.json);

  const [rb, rc] = await Promise.all([
    api("POST", `/api/tandas/${T1}/pay`, { cookie: U.beto.token }),
    api("POST", `/api/tandas/${T1}/pay`, { cookie: U.carla.token }),
  ]);
  ok("beto y carla pagan a la vez → ambos 200", rb.status === 200 && rc.status === 200, [rb.json, rc.json]);
  ok("exactamente uno reporta premio entregado", [rb, rc].filter((x) => x.json?.prizeDelivered).length === 1, [rb.json?.prizeDelivered, rc.json?.prizeDelivered]);
  let t1b = await prisma.tanda.findUniqueOrThrow({ where: { id: T1 } });
  const turno1 = await prisma.turno.findFirstOrThrow({ where: { tanda_id: T1, numero_turno: 1 } });
  ok(
    "T1 avanza a periodo 2; turno 1 completado y premio entregado",
    t1b.periodo_actual === 2 && turno1.estado_turno === "completado" && turno1.premio_entregado,
    { periodo: t1b.periodo_actual, turno: turno1.estado_turno, premio: turno1.premio_entregado }
  );

  const triple = await Promise.all([1, 2, 3].map(() => api("POST", `/api/tandas/${T1}/pay`, { cookie: U.ana.token })));
  const st = triple.map((x) => x.status).sort();
  ok("3 pagos simultáneos de ana → uno 200 y dos 409", JSON.stringify(st) === "[200,409,409]", st);
  const pa2 = await prisma.pago.findUniqueOrThrow({
    where: { tanda_id_pagador_id_periodo: { tanda_id: T1, pagador_id: U.ana.id, periodo: 2 } },
  });
  ok("pago de ana periodo 2 queda 'pagado' (no 'procesando')", pa2.estado === "pagado", pa2.estado);

  for (const u of ["beto", "carla"]) await api("POST", `/api/tandas/${T1}/pay`, { cookie: U[u].token });
  t1b = await prisma.tanda.findUniqueOrThrow({ where: { id: T1 } });
  ok("T1 avanza a periodo 3", t1b.periodo_actual === 3 && t1b.estado === "activa", { periodo: t1b.periodo_actual, estado: t1b.estado });
  const resp3: Respuesta[] = [];
  for (const u of ["ana", "beto", "carla"]) resp3.push(await api("POST", `/api/tandas/${T1}/pay`, { cookie: U[u].token }));
  ok("último pago del periodo 3 → allPaid y premio entregado", resp3[2].json?.allPaid === true && resp3[2].json?.prizeDelivered === true, resp3[2].json);
  t1b = await prisma.tanda.findUniqueOrThrow({ where: { id: T1 } });
  const turnosT1 = await prisma.turno.findMany({ where: { tanda_id: T1 } });
  ok(
    "T1 completada; 3 turnos completados con premio",
    t1b.estado === "completada" && turnosT1.every((t) => t.estado_turno === "completado" && t.premio_entregado),
    { estado: t1b.estado, turnos: turnosT1.map((t) => [t.estado_turno, t.premio_entregado]) }
  );
  r = await api("POST", `/api/tandas/${T1}/pay`, { cookie: U.ana.token });
  ok("pagar tanda completada → 409", r.status === 409, r.status);

  sec("Repetir T1");
  r = await api("POST", `/api/tandas/${T1}/repeat`, { cookie: U.beto.token, body: { fecha_inicio: new Date().toISOString() } });
  ok("no organizador repite → 403", r.status === 403, r.status);
  r = await api("POST", `/api/tandas/${T1}/repeat`, { cookie: U.ana.token, body: {} });
  ok("repetir sin fecha → 400", r.status === 400, r.status);
  r = await api("POST", `/api/tandas/${T1}/repeat`, { cookie: U.ana.token, body: { fecha_inicio: new Date(Date.now() + DIA).toISOString() } });
  ok("organizador repite → 200 activa", r.status === 200 && r.json?.estado === "activa" && r.json?.participantes === 3, r.json);
  const T2: string = r.json?.tandaId;
  const ordenT2 = await prisma.turno.findMany({ where: { tanda_id: T2 }, orderBy: { numero_turno: "asc" } });
  ok(
    "turnos invertidos (carla 1, beto 2, ana 3)",
    ordenT2.map((t) => t.participante_id).join() === [U.carla.id, U.beto.id, U.ana.id].join(),
    ordenT2.map((t) => t.participante_id)
  );
  const pagosT2 = await prisma.pago.count({ where: { tanda_id: T2 } });
  ok("T2 con 9 pagos creados", pagosT2 === 9, pagosT2);

  sec("Carrera por el último lugar");
  r = await api("POST", "/api/tandas", { cookie: U.ana.token, body: { ...base, nombre: "T4 carrera", num_participantes: 2 } });
  const T4: string = r.json?.tandaId;
  const carrera = await Promise.all([
    api("POST", "/api/tandas/join", { cookie: U.beto.token, body: { codigo: r.json?.codigoInvitacion } }),
    api("POST", "/api/tandas/join", { cookie: U.dani.token, body: { codigo: r.json?.codigoInvitacion } }),
  ]);
  ok(
    "solo uno gana el último lugar; el otro recibe 4xx",
    carrera.filter((x) => x.status === 200).length === 1 && carrera.some((x) => x.status >= 400 && x.status < 500),
    carrera.map((x) => [x.status, x.json?.error])
  );
  const turnosT4 = await prisma.turno.count({ where: { tanda_id: T4 } });
  ok("la tanda queda con exactamente 2 turnos", turnosT4 === 2, turnosT4);

  sec("Cron: autorización");
  r = await api("GET", "/api/cron/tanda-penalties");
  ok("cron sin bearer → 401", r.status === 401, r.status);
  r = await api("GET", "/api/cron/tanda-penalties", { headers: { authorization: "Bearer incorrecto" } });
  ok("cron con bearer incorrecto → 401", r.status === 401, r.status);
  const CRON = { authorization: `Bearer ${SECRETOS.cron}` };
  for (const c of ["tanda-penalties", "tanda-start", "tanda-remind"]) {
    r = await api("GET", `/api/cron/${c}`, { headers: CRON });
    ok(`GET /api/cron/${c} con bearer → 200`, r.status === 200, r.json ?? r.status);
    r = await api("POST", `/api/cron/${c}`, { headers: CRON });
    ok(`POST /api/cron/${c} con bearer → 200`, r.status === 200, r.json ?? r.status);
  }

  sec("T3 (4 personas): retrasos día 1 / 3 / 8 / 15 / 21");
  r = await api("POST", "/api/tandas", { cookie: U.ana.token, body: { ...base, nombre: "T3", num_participantes: 4 } });
  const T3: string = r.json?.tandaId;
  const cod3: string = r.json?.codigoInvitacion ?? "";
  for (const u of ["beto", "carla", "dani"]) {
    r = await api("POST", "/api/tandas/join", { cookie: U[u].token, body: { codigo: cod3 } });
    ok(`${u} se une a T3`, r.status === 200, r.json);
  }
  for (const u of ["ana", "beto", "dani"]) await api("POST", `/api/tandas/${T3}/pay`, { cookie: U[u].token });

  const pagoCarla = async () => {
    const p = await prisma.pago.findUniqueOrThrow({
      where: { tanda_id_pagador_id_periodo: { tanda_id: T3, pagador_id: U.carla.id, periodo: 1 } },
    });
    return { estado: p.estado, cargo: Number(p.cargo_retraso), total: Number(p.monto_total) };
  };
  const carla = () => prisma.user.findUniqueOrThrow({ where: { id: U.carla.id } });
  const atrasar = (dias: number) =>
    prisma.pago.updateMany({
      where: { tanda_id: T3, periodo: 1 },
      data: { fecha_vencimiento: new Date(Date.now() - dias * DIA) },
    });
  const cron = async () => (await api("POST", "/api/cron/tanda-penalties", { headers: CRON })).json;
  const accionesDe = (j: any, tandaId: string): string[] =>
    (j?.actions ?? []).filter((a: { tandaId: string }) => a.tandaId === tandaId).map((a: { action: string }) => a.action);

  await atrasar(1);
  await cron();
  let pc = await pagoCarla();
  ok("día 1 → en_gracia sin cargo", pc.estado === "en_gracia" && pc.cargo === 0, pc);

  const c0 = await carla();
  await atrasar(3);
  let j = await cron();
  pc = await pagoCarla();
  const c1 = await carla();
  ok("día 3 → vencido con cargo y monto_total = base + cargo", pc.estado === "vencido" && pc.cargo > 0 && pc.total === 100 + pc.cargo, pc);
  ok("día 3 → −100 puntos y racha a 0", c0.score - c1.score === 100 && c1.streak === 0, { antes: c0.score, despues: c1.score, racha: c1.streak });
  j = await cron();
  ok(
    "cron repetido el mismo día es idempotente (sin nueva penalización)",
    (await carla()).score === c1.score && accionesDe(j, T3).length === 0,
    accionesDe(j, T3)
  );

  await prisma.user.update({ where: { id: U.carla.id }, data: { level: "CONFIABLE" } });
  await atrasar(8);
  j = await cron();
  ok("día 8 → baja de nivel a BASICO", (await carla()).level === "BASICO" && accionesDe(j, T3).includes("level_downgrade"), accionesDe(j, T3));

  await atrasar(15);
  await cron();
  const turnosT3 = await prisma.turno.findMany({ where: { tanda_id: T3 }, orderBy: { numero_turno: "asc" } });
  const tc = turnosT3.find((t) => t.participante_id === U.carla.id);
  const td = turnosT3.find((t) => t.participante_id === U.dani.id);
  ok(
    "día 15 → turno de carla al final (4, pospuesto) y dani sube al 3",
    tc?.numero_turno === 4 && tc.estado_turno === "pospuesto" && td?.numero_turno === 3,
    turnosT3.map((t) => [t.numero_turno, t.estado_turno])
  );
  j = await cron();
  ok("día 15 repetido no vuelve a posponer", !accionesDe(j, T3).includes("turn_postponed"), accionesDe(j, T3));

  const cAntes = await carla();
  await atrasar(21);
  j = await cron();
  const cDesp = await carla();
  const turnoCarla = await prisma.turno.findFirstOrThrow({ where: { tanda_id: T3, participante_id: U.carla.id } });
  const abiertosCarla = await prisma.pago.count({ where: { tanda_id: T3, pagador_id: U.carla.id, estado: { not: "cancelado" } } });
  ok(
    "día 21 → expulsada, sus pagos abiertos cancelados",
    turnoCarla.estado_turno === "expulsado" && abiertosCarla === 0 && accionesDe(j, T3).includes("expelled"),
    { turno: turnoCarla.estado_turno, abiertosCarla, acciones: accionesDe(j, T3) }
  );
  const diasBloqueo = ((cDesp.block_undate?.getTime() ?? 0) - Date.now()) / DIA;
  ok(
    "día 21 → bloqueada ~90 días y −200 puntos",
    cDesp.blocked_tandas && diasBloqueo > 89 && diasBloqueo < 91 && cAntes.score - cDesp.score === 200,
    { bloqueada: cDesp.blocked_tandas, diasBloqueo, antes: cAntes.score, despues: cDesp.score }
  );
  let t3 = await prisma.tanda.findUniqueOrThrow({ where: { id: T3 } });
  ok(
    "el mismo cron cierra el periodo 1 (todos saldados) → periodo 2",
    t3.periodo_actual === 2 && accionesDe(j, T3).includes("period_1_closed"),
    { periodo: t3.periodo_actual, acciones: accionesDe(j, T3) }
  );
  const v2 = await prisma.pago.aggregate({ where: { tanda_id: T3, periodo: 2 }, _min: { fecha_vencimiento: true } });
  ok(
    "vencimiento del periodo 2 recalculado desde ahora (no queda vencido)",
    (v2._min.fecha_vencimiento?.getTime() ?? 0) > Date.now() + 6 * DIA,
    v2._min.fecha_vencimiento
  );

  r = await api("POST", "/api/tandas", { cookie: U.carla.token, body: { ...base, nombre: "bloqueada" } });
  ok("usuaria bloqueada no puede crear tanda → 403", r.status === 403, r.status);
  r = await api("POST", `/api/tandas/${T3}/pay`, { cookie: U.carla.token });
  ok("expulsada no puede pagar (aportación cancelada) → 409", r.status === 409, r.json);

  sec("T3: pago tardío con cargo y periodo saltado");
  for (const u of ["ana", "dani"]) await api("POST", `/api/tandas/${T3}/pay`, { cookie: U[u].token });
  await prisma.pago.updateMany({
    where: { tanda_id: T3, periodo: 2 },
    data: { fecha_vencimiento: new Date(Date.now() - 3 * DIA) },
  });
  await cron();
  const betoAntes = await puntos(U.beto.id);
  r = await api("POST", `/api/tandas/${T3}/pay`, { cookie: U.beto.token });
  const betoDesp = await puntos(U.beto.id);
  ok(
    "beto paga tarde → incluye cargo y cierra periodo 2",
    r.status === 200 && r.json?.cargoRetraso > 0 && r.json?.montoPagado === 100 + r.json?.cargoRetraso && r.json?.prizeDelivered,
    r.json
  );
  ok("pago tardío no suma puntos de puntualidad", betoDesp.score === betoAntes.score, { antes: betoAntes.score, despues: betoDesp.score });
  const v3 = await prisma.pago.aggregate({ where: { tanda_id: T3, periodo: 3 }, _min: { fecha_vencimiento: true } });
  ok(
    "periodo 3 vence ~7 días después del cierre tardío",
    Math.abs((v3._min.fecha_vencimiento?.getTime() ?? 0) - (Date.now() + 7 * DIA)) < 3_600_000,
    v3._min.fecha_vencimiento
  );

  for (const u of ["ana", "beto", "dani"]) r = await api("POST", `/api/tandas/${T3}/pay`, { cookie: U[u].token });
  t3 = await prisma.tanda.findUniqueOrThrow({ where: { id: T3 } });
  const p4 = await prisma.pago.findMany({ where: { tanda_id: T3, periodo: 4 } });
  ok("periodo 4 (receptora expulsada) se salta → T3 completada", t3.estado === "completada" && r.json?.prizeDelivered, { estado: t3.estado, resp: r.json });
  ok("pagos del periodo saltado quedan cancelados", p4.length === 4 && p4.every((p) => p.estado === "cancelado"), p4.map((p) => p.estado));
  r = await api("GET", `/api/tandas/${T3}`, { cookie: U.ana.token });
  const per4 = r.json?.periodos?.find((p: { periodo: number }) => p.periodo === 4);
  ok("detalle T3: periodo 4 con 0 aportaciones contables", r.status === 200 && per4?.total === 0, per4);

  sec("Límite de tandas por nivel");
  r = await api("POST", "/api/tandas", { cookie: U.ana.token, body: { ...base, nombre: "extra A" } });
  const r2 = await api("POST", "/api/tandas", { cookie: U.ana.token, body: { ...base, nombre: "extra B" } });
  ok(
    "BASICO: 3 tandas abiertas máximo → la 4ª es 400",
    r.status === 200 && r2.status === 400 && /hasta 3/.test(r2.json?.error ?? ""),
    [r.status, r2.status, r2.json?.error]
  );

  sec("Perfil, movimientos y liga");
  for (const p of ["/api/user/profile", "/api/user/movimientos", "/api/user/wallet-public", "/api/liga/leaderboard", "/api/liga/ahorro", "/api/auth/me"]) {
    r = await api("GET", p, { cookie: U.ana.token });
    ok(`GET ${p} → 200`, r.status === 200, r.json ?? r.status);
    ok(`${p} no expone secretos`, !/encrypted_secret|pin_hash|"S[A-Z2-7]{55}"/.test(r.text), r.text.slice(0, 120));
  }
  r = await api("GET", "/api/tandas/id-que-no-existe", { cookie: U.ana.token });
  ok("tanda inexistente → 403/404 (no 500)", [403, 404].includes(r.status), r.status);

  sec("Webhook Etherfuse");
  const firma = (b: string) => createHmac("sha256", SECRETOS.webhook).update(b).digest("hex");
  await prisma.user.update({ where: { id: U.ana.id }, data: { etherfuse_customer_id: `cust-${run}` } });
  const kyc = JSON.stringify({ kyc_updated: { customerId: `cust-${run}`, approved: true, updateReason: "documents_verified" } });
  r = await api("POST", "/api/webhooks/etherfuse", { raw: kyc, headers: { "content-type": "application/json" } });
  ok("sin firma → 401", r.status === 401, r.status);
  r = await api("POST", "/api/webhooks/etherfuse", { raw: kyc, headers: { "x-signature": firma(kyc + " ") } });
  ok("firma incorrecta → 401", r.status === 401, r.status);
  r = await api("POST", "/api/webhooks/etherfuse", { raw: "{no-json", headers: { "x-signature": firma("{no-json") } });
  ok("firma válida + JSON inválido → 400", r.status === 400, r.status);
  r = await api("POST", "/api/webhooks/etherfuse", { raw: kyc, headers: { "x-signature": firma(kyc) } });
  let kycStatus = (await prisma.user.findUniqueOrThrow({ where: { id: U.ana.id } })).kyc_status;
  ok("kyc_updated firmado → 200 y kyc_status approved", r.status === 200 && kycStatus === "approved", { status: r.status, kycStatus });
  const cust = JSON.stringify({ customer_updated: { customerId: `cust-${run}`, status: "kyc_failed" } });
  r = await api("POST", "/api/webhooks/etherfuse", { raw: cust, headers: { "x-signature": firma(cust) } });
  kycStatus = (await prisma.user.findUniqueOrThrow({ where: { id: U.ana.id } })).kyc_status;
  ok("customer_updated 'failed' → rejected", r.status === 200 && kycStatus === "rejected", kycStatus);

  sec("Admin Trustless");
  r = await api("POST", "/api/trustless/deploy", { body: {} });
  ok("deploy sin bearer → 401", r.status === 401, r.status);
  r = await api("POST", "/api/trustless/deploy", { body: {}, headers: { authorization: "Bearer otro" } });
  ok("deploy con bearer incorrecto → 401", r.status === 401, r.status);
  r = await api("POST", "/api/trustless/deploy", { cookie: U.ana.token, body: {} });
  ok("deploy con sesión de usuario (sin bearer) → 401", r.status === 401, r.status);
}

/** Borra todo lo creado por esta corrida (usuarios `*.${run}@prueba.mx` y sus tandas). */
async function limpiar(prisma: Prisma, userIds: string[]) {
  if (userIds.length === 0) return;
  const tandas = await prisma.tanda.findMany({
    where: { organizador_id: { in: userIds } },
    select: { id: true },
  });
  const tandaIds = tandas.map((t) => t.id);
  await prisma.$transaction([
    prisma.pago.deleteMany({ where: { OR: [{ tanda_id: { in: tandaIds } }, { pagador_id: { in: userIds } }] } }),
    prisma.turno.deleteMany({ where: { OR: [{ tanda_id: { in: tandaIds } }, { participante_id: { in: userIds } }] } }),
    prisma.tanda.deleteMany({ where: { id: { in: tandaIds } } }), // TandaEscrow cae en cascada
    prisma.wallet.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.bankAccount.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.order.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

async function main() {
  const databaseUrl = urlDePruebas();
  console.log(`Base de pruebas: ${new URL(databaseUrl).host}`);

  await correr([join(ROOT, "node_modules/prisma/build/index.js"), "db", "push"], {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
  });

  // lib/prisma lee DATABASE_URL al cargarse: se fija antes del require.
  process.env["DATABASE_URL"] = databaseUrl;
  const { prisma } = require("../web/src/lib/prisma") as PrismaModule;

  const servidor = await levantarServidor(databaseUrl);
  const detener = () => servidor.proceso.kill();
  process.once("SIGINT", () => {
    detener();
    process.exit(130);
  });

  const U: Record<string, { id: string; token?: string }> = {};
  try {
    await pruebas(prisma, U);
  } catch (e) {
    fallos.push(`[${seccion}] excepción: ${e instanceof Error ? e.message : String(e)}`);
    console.error(e);
  } finally {
    detener();
  }

  console.log(`\n${pasaron} pasaron, ${fallos.length} fallaron`);
  if (fallos.length > 0) {
    console.log("Fallos:\n" + fallos.map((f) => `  - ${f}`).join("\n"));
    console.log(`\nDatos conservados para depurar: usuarios *.${run}@prueba.mx`);
    console.log(`Log del servidor: ${servidor.log}`);
    process.exitCode = 1;
  } else {
    await limpiar(prisma, Object.values(U).map((u) => u.id).filter(Boolean));
    console.log("Datos de la corrida borrados.");
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
