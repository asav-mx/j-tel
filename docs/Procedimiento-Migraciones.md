# Cómo se aplican las migraciones

**Este es el procedimiento real, el que se usa.** Se escribió el 31 de julio de
2026, después de descubrir que el que decía el README no funciona contra
producción.

---

## La regla

> **`pnpm db:migrate` NUNCA se corre contra producción.**
>
> Las migraciones se aplican ejecutando su SQL directamente contra la base, con
> verificación antes y después.

No es una preferencia de estilo. Son dos razones independientes, y cualquiera de
las dos basta.

### Razón 1 — producción no tiene la bitácora del migrador

El migrador de Drizzle lleva su propia tabla de control (`__drizzle_migrations`,
en el esquema `drizzle`) para saber qué archivos ya aplicó. **En producción esa
tabla no existe**: se verificó el 2026-07-31 y el único esquema de usuario es
`public`.

O sea que el migrador nunca ha corrido ahí. El esquema se construyó por otro
camino, y desde la migración `0003` los archivos se vienen aplicando a mano.

Consecuencia: si alguien corre `pnpm db:migrate` contra producción, el migrador
**no ve "falta solo la última"**. Ve una base virgen e intenta aplicar todas las
migraciones desde la `0000` contra una base con 37 tablas, 846 hechos de
cumplimiento y 2.4 millones de puntos de telemetría. La primera revienta con
`relation "accounts" already exists` — después de haber creado su tabla de
bitácora, que queda a medio escribir.

### Razón 2 — el migrador envuelve todo en una transacción

`drizzle-orm/pg-core/dialect.js` corre las migraciones dentro de
`session.transaction(...)`. Hay sentencias que **no pueden ir en una
transacción**, y la más importante para esta base es:

```sql
CREATE INDEX CONCURRENTLY ...
```

`CONCURRENTLY` es lo que permite construir un índice **sin bloquear la tabla para
escritura**. En `telemetry_points`, que recibe telemetría en vivo, un
`CREATE INDEX` normal congela la ingesta durante toda la construcción. Por eso la
migración `0014` la usa — y por eso ese archivo, si pasara por el migrador,
fallaría con `CREATE INDEX CONCURRENTLY cannot run inside a transaction block`.

---

## Escribir una migración

Cuatro archivos, siempre los cuatro:

1. **El SQL** — `packages/db/drizzle/NNNN_nombre_descriptivo.sql`.
   Sentencias separadas por `--> statement-breakpoint`. Arriba, en comentarios:
   qué hace, si es aditiva, y cualquier cosa que quien la aplique deba saber
   (por ejemplo, que lleva `CONCURRENTLY` y no puede ir en transacción).

2. **La entrada en la bitácora del repo** — `packages/db/drizzle/meta/_journal.json`.
   Se agrega a mano, con el `idx` siguiente y el mismo `tag` que el nombre del
   archivo. Sirve de índice legible aunque el migrador no la use.

3. **El esquema de Drizzle** — `packages/db/src/schema/index.ts`.
   La tabla, columna o índice se declara también aquí. Si no, la próxima vez que
   alguien regenere el esquema desde el código, lo que aplicaste a mano
   desaparece.

4. **Nada de `drizzle-kit generate`.** Los snapshots de `meta/` se quedaron en el
   `0002` y no reflejan la realidad; regenerarlos produciría un diff falso.
   Las migraciones se escriben a mano.

**Preferir siempre migraciones aditivas** (tabla nueva, columna nueva nullable,
índice nuevo). Se pueden aplicar antes de desplegar el código sin romper lo que
está corriendo. Un `DROP` o un `NOT NULL` sobre datos existentes es otra
conversación y no se hace sin plan de dos pasos.

---

## Aplicar una migración

### Antes de tocar nada — leer

Con el usuario **de solo lectura** (`DATABASE_URL_READONLY`), no con el dueño:

```sql
-- ¿Ya está aplicada?
SELECT to_regclass('public.mi_tabla_nueva') IS NOT NULL AS existe;

-- La foto de "antes" con la que se compara después.
SELECT (SELECT count(*) FROM compliance_facts)     AS hechos,
       (SELECT count(*) FROM service_occurrences)  AS ocurrencias,
       (SELECT count(*) FROM information_schema.tables
         WHERE table_schema='public')              AS tablas;
```

Anotar esos números. Son la evidencia de que la migración no movió datos.

### Aplicar

Con `DATABASE_URL` (el usuario dueño). Un script chico que **lee el SQL del
propio archivo de la migración** — nunca se retecleaan las sentencias, porque
entonces lo que corre y lo que queda versionado dejan de ser lo mismo:

```js
// packages/db/aplicar.mjs — desechable, se borra al terminar
import { readFileSync } from "node:fs";
import postgres from "postgres";

const sql = postgres(process.env.DB_URL, { max: 1 });
const sentencias = readFileSync(process.argv[2], "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").trim())
  .filter(Boolean);

console.log(sentencias.join("\n---\n"));

// En transacción: o quedan todas, o no queda ninguna.
await sql.begin(async (tx) => {
  for (const s of sentencias) await tx.unsafe(s);
});

await sql.end();
```

```bash
cd packages/db
DB_URL="$(grep -E '^DATABASE_URL=' ../../.env | cut -d= -f2-)" \
  node aplicar.mjs drizzle/0013_route_traversal_measurements.sql
```

**En transacción siempre que se pueda.** La excepción es `CONCURRENTLY`, que no
lo admite: ahí la sentencia se manda suelta (`await sql.unsafe(sentencia)` sin
`sql.begin`). Es el único caso, y el archivo de la migración debe decirlo en su
encabezado.

### Después — verificar

Con el usuario de solo lectura otra vez:

```sql
-- 1. La estructura quedó como se pidió.
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='mi_tabla_nueva'
 ORDER BY ordinal_position;

SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename='mi_tabla_nueva';

-- 2. Los conteos no se movieron (comparar con la foto de antes).
SELECT (SELECT count(*) FROM compliance_facts)    AS hechos,
       (SELECT count(*) FROM service_occurrences) AS ocurrencias;

-- 3. Si se creó un índice: que quedara válido.
--    Un CONCURRENTLY que falla a la mitad deja el índice INVÁLIDO y hay que
--    borrarlo a mano antes de reintentar.
SELECT c.relname FROM pg_index x
  JOIN pg_class c ON c.oid = x.indexrelid
 WHERE NOT x.indisvalid;
```

**Los conteos antes y después son parte del entregable**, no un lujo. Una
migración aditiva que mueve un conteo no es aditiva.

### Borrar el script

El script de aplicación es desechable. Lo que queda versionado es el `.sql`, la
entrada del journal y el esquema.

---

## Dos ejemplos reales

### `0013_route_traversal_measurements` — tabla nueva, en transacción

```
=== ANTES ===  hechos: 846, ocurrencias: 1948, tablas: 36, ya_existe: false
[1/2] CREATE TABLE ejecutada OK
[2/2] CREATE INDEX ejecutada OK
=== DESPUÉS === hechos: 846, ocurrencias: 1948, tablas: 37, existe: true, filas: 0
```

Las dos sentencias dentro de una transacción. Los conteos intactos, una tabla
más, la tabla nueva vacía.

### `0014_telemetry_unit_idx` — índice, sin transacción

```
CREATE INDEX CONCURRENTLY terminó en 2.9 s
índice válido=true listo=true tamaño=76 MB
hechos: 846 · ocurrencias: 1948 · índices inválidos: ninguno
```

Sobre 2 400 968 filas y 704 MB, con la tabla recibiendo telemetría durante toda
la construcción. Sin `CONCURRENTLY` habría bloqueado la ingesta esos segundos.

---

## Base local

`pnpm db:migrate` **sí funciona contra una base local vacía**, con una excepción:
se atora en la `0014` por el `CONCURRENTLY`. Dos salidas:

- Aplicar los `.sql` en orden con el mismo script de arriba (es el procedimiento
  oficial, y así lo local se parece a producción).
- O correr `pnpm db:migrate` y aplicar la `0014` aparte. En una base local sin
  ingesta viva, el `CONCURRENTLY` sobra: `CREATE INDEX` normal sirve igual.

---

## Si algo sale mal

- **La sentencia falla dentro de la transacción** → no quedó nada aplicado.
  Corregir el `.sql` y volver a correr.
- **`CONCURRENTLY` falla a la mitad** → queda un índice **inválido** que no sirve
  y ocupa espacio. Se borra con `DROP INDEX CONCURRENTLY <nombre>;` y se
  reintenta. La consulta de índices inválidos de arriba lo detecta.
- **Se aplicó a medias algo que no iba en transacción** → no adivinar el estado.
  Leer el esquema real (`information_schema`) y comparar contra el `.sql` antes
  de tocar nada más.

---

## Lo que falta (deuda conocida)

El repo tiene un migrador que nadie usa. Mientras siga ahí, alguien puede
correrlo contra producción por seguir el README viejo. Las dos salidas posibles:

1. **Darle bitácora inicial al migrador** — insertarle a mano los registros de
   las migraciones ya aplicadas para que arranque desde la actual. Es lo
   "correcto" pero se hace sobre una base viva con 846 hechos, y si los hashes no
   coinciden con lo que el migrador espera, vuelve a intentar aplicar todo.
2. **Adoptar el SQL a mano** — lo que hace este documento.

Se eligió (2) por ser lo seguro. (1) queda como candidato para cuando exista una
base de práctica desechable donde ensayarlo sin riesgo — está en el PLAN-v1 §7.
