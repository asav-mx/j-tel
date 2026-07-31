# Dónde viven las credenciales y cómo se rotan

**Escrito el 31 de julio de 2026**, después de que una rotación costara una hora
porque el `.env` de una máquina y las variables de Vercel decían cosas distintas.

---

## La regla

> **Los valores viven en Vercel. El `.env` local es un archivo generado.**
>
> Nadie edita el `.env` a mano. Rotar un secreto es **un solo cambio**, en
> Vercel, y después cada quien corre `pnpm env:pull`.

Tres archivos sostienen esto:

| Archivo | Qué es |
|---|---|
| `.env.example` | La **lista autorizada de nombres**. Sin valores. Versionado. |
| `.env` | Los valores, **generados** con `pnpm env:pull`. Nunca en git. |
| `scripts/verificar-env.mjs` | El árbitro. `pnpm env:check`. |

Si agregas una variable al código, va a `.env.example` **en el mismo commit**.
`pnpm env:check` compara los dos archivos en ambos sentidos y avisa cuando se
separan — que es la forma exacta en que se perdió esa hora.

---

## El día a día

```bash
pnpm env:pull     # trae los valores de Vercel al .env local
pnpm env:check    # ¿el .env cumple el contrato?
```

`env:pull` corre el CLI de Vercel con `pnpm dlx`, así que no hace falta
instalarlo. La primera vez pide vincular el proyecto (`vercel link`); ese paso
deja un `.vercel/` local que no se versiona.

---

## Rotar un secreto

1. Cambiarlo **donde nace** (Neon, Umbrella, el que sea).
2. Actualizarlo en **Vercel → Settings → Environment Variables**, en los
   entornos que apliquen.
3. Redesplegar si el secreto lo consume la app en producción.
4. Cada quien: `pnpm env:pull && pnpm env:check`.

No hay un cuarto lugar donde pegarlo. Ese era el problema.

**`DATABASE_URL` es la excepción, y para bien:** la administra la integración de
Neon en Vercel → Storage. No se pega a mano ni se rota a mano. Lo mismo con las
`POSTGRES_*`, que la integración inyecta como respaldo — `apps/web/src/lib/db.ts`
cae por ellas en orden si falta `DATABASE_URL`.

---

## El caso especial: `DATABASE_URL_READONLY`

Para qué sirve cada conexión y por qué las lecturas de verificación van con ésta,
lo cuenta `docs/Procedimiento-Migraciones.md` — ahí está la tabla de las tres.
Lo que importa aquí es que la integración de Neon **no** la administra: se
guarda explícita en Vercel, y por eso entra en este procedimiento.

Dos cosas tienen que ser ciertas, y son independientes:

```bash
pnpm --filter @jtel/db verificar-solo-lectura   # los permisos, contra el catálogo
pnpm env:check                                  # el secreto, contra el del dueño
```

La primera pregunta si el rol puede escribir. La segunda es la que faltaba:
**el password de `jtel_readonly` debe ser distinto al de `neondb_owner`**. Si es
el mismo, los permisos siguen bien —el rol no puede escribir— pero la credencial
"segura" ya no lo es: quien la tenga solo cambia el usuario en la URL y entra
como dueño. Eso pasa todas las pruebas de permisos sin levantar una sola
bandera, por eso se verifica aparte.

### Rotar el password de solo lectura

Toca producción. Va con verificación antes y después, como las migraciones.

```sql
-- Con el usuario dueño (DATABASE_URL), desde la consola de Neon.
ALTER ROLE jtel_readonly WITH PASSWORD '<nuevo, distinto al del dueño>';
```

Después: actualizar `DATABASE_URL_READONLY` en Vercel, `pnpm env:pull`, y correr
las dos comprobaciones de arriba. La de permisos debe seguir en verde —
`ALTER ROLE ... PASSWORD` no toca los `GRANT`— y `env:check` debe dejar de
quejarse.

---

## Deuda conocida

**El worker lee otros nombres.** `apps/worker/src/run.ts` pide
`UMBRELLA_USER_ID` y `UMBRELLA_PASSWORD`, mientras que el resto del repo usa
`UMBRELLA_GPS_USERID` y `UMBRELLA_GPS_PASSWORD`. Mientras siga así, el worker
necesita **las dos parejas** definidas o se autentica contra Umbrella con
`undefined`. Las cuatro están en el contrato para que nadie se sorprenda, pero
lo correcto es unificar los nombres en el worker y borrar las dos viejas — es un
cambio de comportamiento en producción y no se hace de pasada.

**Clerk se fue y quedó el rastro.** El `.env.example` viejo pedía
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`; no hay una sola
referencia a Clerk en el código. Se quitaron del contrato. La autenticación de
desarrollo hoy sale de `JTEL_DEV_USER` y del encabezado que lee
`apps/web/src/lib/auth.ts`.
