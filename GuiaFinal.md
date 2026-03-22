# Macetero — Plan Maestro de Producto y Tecnología

---

## 1. Visión General

**Macetero** es una plataforma de inclusión financiera que digitaliza las tandas tradicionales en México, integrando:

- Ahorro digital en pesos mexicanos
- Rendimientos financieros accesibles
- Sistema de reputación alternativo
- Gamificación social para incentivar disciplina financiera

> **Propuesta de valor:**
> *"Tu tanda sin trampa. Tus ahorros con rendimiento."*

---

## 2. Problema

- 37 millones de adultos no bancarizados en México
- $180 mil millones MXN en tandas informales sin digitalizar
- Alto riesgo de fraude en tandas tradicionales
- Sin historial financiero → sin acceso a crédito

---

## 3. Solución

Una aplicación web (Next.js) que permite:

- Crear y gestionar tandas digitales seguras
- Autenticarse con passkeys (Face ID, Touch ID, Windows Hello) — sin contraseñas
- Operar una smart wallet en Stellar firmando con biometría del dispositivo
- Ahorrar dinero con rendimiento
- Generar historial financiero sin banco
- Participar en dinámicas sociales que incentivan el cumplimiento

---

## 4. Usuario Objetivo

- Personas no bancarizadas
- Comerciantes informales
- Participantes activos de tandas tradicionales
- Cualquier usuario con navegador moderno y biometría en su dispositivo

---

## 5. MVP (Producto Inicial)

### Incluye:

- Registro con correo electrónico + creación de passkey
- Smart wallet en Stellar (passkey-secured via smart-account-kit)
- Wallet en MXN (guardar / retirar)
- Tandas completas (crear, unirse, pagar, recibir premio)
- Sistema de castigos por retraso
- Sistema de reputación básico
- Liga (ranking, rachas, torneos)
- Ahorro Plus (rendimiento simulado)

### No incluye (fase posterior):

- Inversión real
- Créditos
- Integraciones complejas

---

## 6. Arquitectura Tecnológica

### Frontend

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **smart-account-kit** para wallet con passkeys sobre Stellar/Soroban

### Backend

- **Next.js API Routes** — lógica ligera, BFF (Backend For Frontend), sesiones
- **Supabase Edge Functions** (Deno) — lógica de negocio pesada, cron jobs, webhooks

### Base de datos

- **PostgreSQL** con Supabase (Row Level Security, Realtime, Auth)

### Autenticación

- **Passkeys (WebAuthn)** via smart-account-kit — sin contraseñas
- Cada usuario obtiene una smart wallet en Stellar al registrarse

---

## 7. Arquitectura de Sistema

```text
Navegador (Next.js)
       ↓
┌──────────────────────────────┐
│  Next.js API Routes (BFF)    │
│  - Sesión / auth             │
│  - Proxy a Supabase          │
│  - Lógica ligera             │
└──────────┬───────────────────┘
           ↓
┌──────────────────────────────┐
│  Supabase Edge Functions     │
│  - Tandas (turnos, pagos)    │
│  - Castigos / reputación     │
│  - Cron: intereses, vencidos │
│  - Webhooks                  │
└──────────┬───────────────────┘
           ↓
┌──────────────────────────────┐
│  Supabase PostgreSQL         │
│  - RLS (seguridad por fila)  │
│  - Realtime (notificaciones) │
└──────────────────────────────┘
           ↓
-----------------------------------------
Capa financiera  → Etherfuse
Capa reputación  → Acta
Capa optimización → DeFindex
Capa wallet      → smart-account-kit (Stellar passkey wallet)
-----------------------------------------
```

---

## 8. Integraciones Tecnológicas

### Passkey Smart Wallet (smart-account-kit)

Función:

- Registro sin contraseñas — el usuario crea una passkey con su biometría
- Smart wallet en Stellar protegida por WebAuthn (Face ID, Touch ID, Windows Hello)
- Firma de transacciones on-chain con passkey (sin seed phrases)
- Almacenamiento de sesión en IndexedDB

Rol:

> Identidad y custodia del usuario — reemplaza wallets tradicionales y contraseñas

---

### Etherfuse (Core financiero)

Función:

- On-ramp (depósitos MXN → cripto)
- Custodia de fondos
- Inversión (Ahorro Plus)
- Off-ramp (retiros cripto → MXN)

Rol:

> Infraestructura financiera principal (tipo "banco backend")

---

### Acta

Función:

- Registro de comportamiento financiero
- Generación de reputación verificable

Rol:

> Base para historial crediticio alternativo

---

### DeFindex

Función:

- Optimización de rendimiento financiero

Rol:

> Maximizar retorno en Ahorro Plus (fase avanzada)

---

## 9. Flujo de Dinero

```text
Usuario (MXN)
   ↓
Next.js API Route / Supabase Edge
   ↓
Etherfuse (on-ramp)
   ↓
----------------------------------
Saldo normal (custodia)
Ahorro Plus (invertido)
----------------------------------
   ↓
Etherfuse (off-ramp)
   ↓
Usuario (MXN)
```

---

## 10. Lógica del Producto

### Tandas

- Sistema interno gestionado por Supabase Edge Functions
- Turnos automáticos calculados al crear la tanda
- Pagos periódicos procesados vía Edge Functions + cron
- Distribución automática de premio al turno correspondiente

---

### Castigos

- Período de gracia configurable
- Penalizaciones económicas automáticas
- Pérdida de reputación
- Expulsión

---

### Reputación

- Niveles: Básico / Confiable / Avanzado
- Basado en comportamiento real (pagos a tiempo, rachas, tandas completadas)

---

### Gamificación

- Rankings por puntualidad
- Rachas (streaks)
- Torneos con recompensas reales

---

## 11. Modelo de Negocio

| Fuente                     | Descripción              |
| -------------------------- | ------------------------ |
| Comisión de retiro         | 2.5%                     |
| Diferencial de rendimiento | margen sobre Ahorro Plus |
| Servicios futuros          | créditos, seguros        |

---

## 12. KPIs Clave

- Retención D+30 > 50%
- Cumplimiento en tandas > 90%
- DAU/MAU > 30%
- TPV mensual > $5M MXN

---

## 13. Roadmap de Desarrollo

### Fase 1 — MVP (0–8 semanas)

- Next.js app con passkey login + smart wallet
- Supabase Edge Functions para lógica de tandas
- Wallet simulado (MXN)
- Tandas operativas (crear, unirse, pagar, cobrar)
- Reputación y gamificación básicas

---

### Fase 2 — Validación (8–12 semanas)

- Testing con usuarios reales
- Ajuste de UX
- Métricas de uso
- Optimización de Edge Functions

---

### Fase 3 — Dinero real (12–16 semanas)

- Integración con Etherfuse (on-ramp / off-ramp)
- Depósitos y retiros reales en MXN

---

### Fase 4 — Escalamiento

- Acta (reputación verificable on-chain)
- Expansión de usuarios
- PWA / mejoras mobile

---

### Fase 5 — Optimización

- DeFindex (rendimiento avanzado para Ahorro Plus)
- Nuevos productos financieros

---

## 14. Riesgos y Mitigación

| Riesgo                   | Mitigación                            |
| ------------------------ | ------------------------------------- |
| Desconfianza del usuario | embajadores + UX simple               |
| Incumplimiento           | castigos + presión social             |
| Regulación               | asesoría legal desde inicio           |
| Dependencia tecnológica  | arquitectura modular                  |
| Compatibilidad passkeys  | fallback a PIN + detección de soporte |

---

## 15. Estrategia de Crecimiento

- Embajadores comunitarios
- Grupos de WhatsApp
- Mercados y comunidades locales
- Marketing orgánico

---

## 16. Estrategia Clave

1. Validar comportamiento antes que tecnología
2. Mantener UX extremadamente simple
3. Escalar por comunidad, no por ads
4. Integrar tecnología avanzada progresivamente

---

## 17. Conclusión

Macetero combina:

- Cultura financiera existente (tandas)
- Tecnología invisible (passkeys, smart wallets)
- Incentivos conductuales
- Infraestructura moderna (Next.js + Supabase Edge + Stellar)

Para construir un sistema financiero accesible, escalable y confiable para millones de mexicanos no bancarizados.

---

## Database

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) unique,
  phone varchar(15) unique,
  name varchar(100),
  wallet_contract_id text unique,
  level varchar(20) default 'BASICO',
  score int default 0,
  created_at timestamp default now()
);

create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  balance numeric(12,2) default 0,
  created_at timestamp default now()
);

create table ahorro_plus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  balance numeric(12,2) default 0,
  interest_generated numeric(12,2) default 0,
  provider varchar(20) default 'mock', -- mock | etherfuse | defindex
  last_calculated timestamp,
  created_at timestamp default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  type varchar(50), -- deposit, withdraw, tanda_payment, reward, interest
  amount numeric(12,2),
  fee numeric(12,2) default 0,
  status varchar(20) default 'completed',
  reference text,
  created_at timestamp default now()
);

create table tandas (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references users(id),
  name varchar(100),
  amount numeric(12,2),
  frequency varchar(20), -- semanal, quincenal
  total_participants int,
  current_turn int default 1,
  status varchar(20) default 'active',
  created_at timestamp default now()
);

create table tanda_participants (
  id uuid primary key default gen_random_uuid(),
  tanda_id uuid references tandas(id) on delete cascade,
  user_id uuid references users(id),
  turn int,
  status varchar(20) default 'ACTIVE', -- ACTIVE, LATE, EXPELLED
  joined_at timestamp default now()
);

create table tanda_payments (
  id uuid primary key default gen_random_uuid(),
  tanda_id uuid references tandas(id),
  user_id uuid references users(id),
  amount numeric(12,2),
  due_date date,
  paid_at timestamp,
  status varchar(20) default 'pending'
);

create table reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  type varchar(50), -- pago_tiempo, retraso, completado
  points int,
  source varchar(20) default 'internal', -- internal | acta
  created_at timestamp default now()
);

create table streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  current_streak int default 0,
  max_streak int default 0,
  updated_at timestamp default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  title text,
  message text,
  read boolean default false,
  created_at timestamp default now()
);

create index idx_users_phone on users(phone);
create index idx_users_email on users(email);
create index idx_users_wallet on users(wallet_contract_id);
create index idx_transactions_user on transactions(user_id);
create index idx_tandas_creator on tandas(creator_id);
create index idx_tanda_participants_user on tanda_participants(user_id);
```
