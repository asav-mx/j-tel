# j-tel

Repositorio de JTEL en Cursor — plataforma multi-cuenta de verificación de transporte de personal (maquiladora, México).

> Repo separado de `jtel` (otro entorno). Este es el workspace oficial de Cursor.

## Requisitos

- Node.js 20+
- pnpm 10+
- PostgreSQL (recomendado: [Neon](https://neon.com) en la nube)

## Inicio rápido

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate      # SOLO en local — ver la advertencia de abajo
pnpm db:seed
pnpm dev
```

Abrir http://localhost:3000

> ⛔ **`pnpm db:migrate` NUNCA se corre contra producción.** Producción no tiene la
> tabla de bitácora del migrador, así que este comando ve una base virgen e intenta
> aplicar las migraciones desde la `0000` contra una base con 37 tablas y 846 hechos
> sellados: revienta, y deja su bitácora a medio escribir. Las migraciones se aplican
> ejecutando su SQL directamente. **El procedimiento real está en
> [docs/Procedimiento-Migraciones.md](docs/Procedimiento-Migraciones.md)** — léelo
> antes de tocar la base.
>
> En local también se atora en la `0014`, que lleva `CREATE INDEX CONCURRENTLY` y el
> migrador envuelve cada migración en una transacción. El documento explica cómo
> levantar una base local con el mismo procedimiento que producción.

> **Seed y producción.** `pnpm db:seed` hace `TRUNCATE` de TODAS las tablas antes de
> sembrar. Por eso exige `SEED_DATABASE_URL` (definida en `.env.example`) apuntando a
> una base de desarrollo/demo: si falta, o si es idéntica a `DATABASE_URL`, el seed se
> niega a correr. Nunca vacía producción por accidente.

## Estructura

- `apps/web` — UI cliente, carrier, J-Staff + API
- `apps/worker` — Job de verificación post-deadline
- `packages/db` — Esquema Drizzle, repos, seeds
- `packages/verification` — Motor puro de decisión
- `packages/gps-umbrella` — Adaptador API Umbrella
- `packages/services` — Orquestación verificación + ingesta
- `docs/marco-limpio` — Fuente de verdad del dominio
- `docs/Procedimiento-Migraciones.md` — Cómo se aplica una migración (a mano, no con el migrador)

## Usuarios demo (header `X-JTEL-User`)

- `tecma_admin` — corporativo Tecma
- `tecma_planta47` — solo planta 47
- `jb_admin` — carrier Juárez Bus
- `jstaff_admin` — operador plataforma

## Cron verificación

```bash
curl -H "Authorization: Bearer dev-cron-secret" http://localhost:3000/api/cron/verify
```

<!-- deploy: credenciales GPS por carrier (JTEL_SECRET_KEY) -->

## Git hooks

Los hooks están versionados en `scripts/hooks/`. Actívalos una sola vez por clon:

```bash
git config core.hooksPath scripts/hooks
```

- **post-checkout** — borra `apps/web/.next` al cambiar de rama para evitar bundles con módulos cacheados de la rama anterior.
