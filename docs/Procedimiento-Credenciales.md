# Dónde viven las credenciales y cómo se rotan

**Escrito el 31 de julio de 2026**, después de que una rotación costara una hora
porque el `.env` de una máquina y las variables de Vercel decían cosas distintas.

---

## La regla

> **Los valores viven en Vercel. El `.env` local es un archivo generado.**
>
> Nadie edita el `.env` a mano. Rotar un secreto es **un solo cambio**, en
> Vercel, y después cada quien corre `pnpm env:pull`.

Cuatro archivos sostienen esto:

| Archivo | Qué es |
|---|---|
| `.env.example` | La **lista autorizada de nombres**. Sin valores. Versionado. |
| `.env` | Los valores, **generados** con `pnpm env:pull`. Nunca en git. |
| `scripts/verificar-env.mjs` | El árbitro. `pnpm env:check`. |
| `scripts/verificar-env.test.mjs` | Que el árbitro sepa fallar. `pnpm env:test`. |

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

**El `.env` que genera trae los valores entre comillas** (`CLAVE="valor"`). Es
formato válido y `env:check` lo entiende, pero conviene saberlo: la primera
versión de este árbitro no le quitaba las comillas y, con ellas puestas, la
comprobación del password se saltaba **en silencio** y anunciaba verde — se
apagaba sola justo en el flujo que este documento recomienda. Por eso
`pnpm env:test` existe y por eso corre dentro de `pnpm test`: un detector que no
sabe fallar es peor que no tenerlo, porque da una seguridad que no hay.

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

## El caso contrario: rotar el password del DUEÑO (`neondb_owner`)

**No es el mismo procedimiento que el de solo lectura, y confundirlos tira
producción.** `DATABASE_URL_READONLY` se guarda explícita en Vercel, así que se
pega a mano. `DATABASE_URL` y las `POSTGRES_*` **las administra la integración**,
y ahí el `ALTER ROLE` desde la consola SQL es exactamente lo que no se hace:
Neon acepta el cambio, Vercel no se entera, y la app se queda con la contraseña
vieja.

**Lo que decide el procedimiento es cuál de las dos integraciones está
instalada.** Se distingue mirando qué variables inyecta:

| Si en Vercel aparecen… | Es la integración… | Rotación |
|---|---|---|
| `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGUSER`, `PGPASSWORD` | **Neon-managed** (instalada desde Neon) | Neon sincroniza solo al resetear; si no, Neon Console → Integrations → Manage → Settings → **Save changes** fuerza el resync |
| `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, bajo Vercel → Storage | **Vercel-managed** (Marketplace) | Las dos rutas de abajo |

Al 10 de agosto de 2026 el `.env.example` de este repo declara **las tres
`POSTGRES_*` y ninguna `PG*`**, lo que apunta a la **Vercel-managed** — pero
**no está verificado contra el panel**, y es lo primero que hay que confirmar.

### Las dos rutas, y por qué importa cuál

**Ruta A — desde Vercel (la diseñada).** Integrations → el proveedor →
Installed Products → el recurso → Settings → **Secure This Resource** →
**Rotate Secrets** → redesplegar. Es la única que puede ofrecer **ventana de
gracia**: la API de rotación del Marketplace admite
`delayOldSecretsExpirationHours`, que deja la credencial vieja viva unas horas.
**Si Neon lo implementa, se ve en ese diálogo** — y si lo ofrece, se usa.

**Ruta B — desde el panel de Neon.** Integrations → el proveedor → **Log into
provider** → resetear ahí. Vercel documenta que eso **sincroniza solo**, pero
con una letra chica que es todo el asunto: los valores nuevos quedan
**preparados para aplicarse cuando los proyectos se redesplieguen**. No entran
a lo que ya está corriendo.

### La respuesta a «¿cinco minutos o susto?»: ninguna de las dos. Es una ventana.

La sincronización **sí es automática**. Lo que no es automático —y no hay forma
de que lo sea— es que el despliegue vivo tome el valor nuevo. Y por el otro
lado, el artículo de Vercel para Neon lo dice sin rodeos:

> «Al resetear el secreto de la base de Neon, el actual **deja de funcionar de
> inmediato**. Todos los proyectos que dependan de él **no podrán conectarse
> hasta que se les vuelva a desplegar.**»

Las dos cosas juntas dan **un hueco inevitable entre el reset y el fin del
redespliegue**, que dura lo que dure un build. El consejo general de Vercel
—*actualiza Vercel ANTES de invalidar la credencial vieja*— **no aplica aquí**:
un password de rol no admite dos valores a la vez. Por eso la Ruta A, si ofrece
la ventana de gracia, es la buena.

Y como el hueco existe, se elige cuándo: `/api/cron/verify` corre **cada
minuto**, así que va a fallar durante el build. Es aceptable si es a propósito,
y es un incidente si te agarra desprevenido.

### El orden

1. **Confirmar cuál integración es** (la tabla de arriba) y elegir ventana.
2. **Rotar** por la Ruta A si ofrece gracia; si no, por la que sea.
3. **Confirmar en Vercel que las variables cambiaron.** No se asume: el artículo
   de Vercel pide ir a verlas. No editarlas a mano — la integración las
   sobrescribe.
4. **Redesplegar producción.** Sin esto no pasa nada, con reset y todo.
5. **Verificar con algo real:** los logs del siguiente tick de
   `/api/cron/verify` y una página que pegue a la base. **No con `/api/salud`**,
   que responde «sano» con servicios sin veredicto.
6. **Local:** `pnpm env:pull && pnpm env:check`, y `verificar-solo-lectura` debe
   seguir en verde — `ALTER ROLE ... PASSWORD` no toca los `GRANT`, y
   `jtel_readonly` es otro rol.

**Qué NO se toca.** `neondb_owner` no es una cuenta: es el rol por omisión de
**cada** proyecto de Neon, con contraseña distinta en cada uno. Medido el 10 de
agosto de 2026, `DATABASE_URL_TEST` (`ep-lucky-dust-ad7m4lqp`) y
`JRZ_OLD_MEMORY_DATABASE_URL` (`ep-shiny-paper-ahsmhggg`) son **otras bases con
otras contraseñas**. Rotar la de producción no las toca.

**Si sale mal, hay vidrio que romper:** mientras el `.env` de alguien tenga la
contraseña vieja, `ALTER ROLE neondb_owner WITH PASSWORD '<la vieja>'` devuelve
el servicio. Deja todo como estaba y hay que re-rotar — es para salir del hueco,
no para quedarse.

**Fuentes:** [Rotating environment variables](https://vercel.com/docs/environment-variables/rotating-secrets)
· [How to rotate the secrets of your Neon integration](https://vercel.com/kb/guide/how-to-reset-a-secret-for-a-neon-integration)
· [Connecting with the Neon-Managed Integration](https://neon.com/docs/guides/neon-managed-vercel-integration)
· [How do I rotate my Neon database connection string](https://neon.com/faqs/rotate-database-connection-string-security)

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
