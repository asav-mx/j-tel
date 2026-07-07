# JTEL

Plataforma multi-cuenta de verificación de transporte de personal (maquiladora, México).

## Requisitos

- Node.js 20+
- pnpm 10+
- PostgreSQL con PostGIS (`docker compose up -d`)

## Inicio rápido

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abrir http://localhost:3000

## Estructura

- `apps/web` — UI cliente, carrier, J-Staff + API
- `apps/worker` — Job de verificación post-deadline
- `packages/db` — Esquema Drizzle, repos, seeds
- `packages/verification` — Motor puro de decisión
- `packages/gps-umbrella` — Adaptador API Umbrella
- `packages/services` — Orquestación verificación + ingesta
- `docs/marco-limpio` — Fuente de verdad del dominio

## Usuarios demo (header `X-JTEL-User`)

- `tecma_admin` — corporativo Tecma
- `tecma_planta47` — solo planta 47
- `jb_admin` — carrier Juárez Bus
- `jstaff_admin` — operador plataforma

## Cron verificación

```bash
curl -H "Authorization: Bearer dev-cron-secret" http://localhost:3000/api/cron/verify
```
