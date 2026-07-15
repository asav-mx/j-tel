# j-tel

Sistema de telemetría y verificación de servicios de transporte.

## Setup

```bash
pnpm install
```

### Git hooks

El repo incluye hooks versionados en `scripts/hooks/`. Para instalarlos:

```bash
ln -sf ../../scripts/hooks/post-checkout .git/hooks/post-checkout && chmod +x .git/hooks/post-checkout
```

El hook `post-checkout` borra `apps/web/.next` al cambiar de rama, evitando que el dev server de Next.js sirva un bundle con módulos cacheados de la rama anterior.

## Dev server

```bash
pnpm --filter @jtel/web dev
```
