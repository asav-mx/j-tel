-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0032 · la fecha de arranque del servicio — Neon
--
-- SE APLICA DESPUÉS DE LA 0031.
--
-- ✓ ES PURAMENTE ADITIVA. Una columna nueva, nullable, sin default.
--   No escribe en ninguna fila existente: los circuitos que hay
--   quedan en NULL, que significa «ya opera» — la verdad de los dos.
--
-- ✓ LA MARCHA ATRÁS DEVUELVE EL ESTADO EXACTO, mientras nadie haya
--   capturado una fecha. Ver
--   packages/db/drizzle/0032_fecha_arranque.reversa.sql.
--
-- ⚠ SE APLICA ANTES DE MERGEAR EL CÓDIGO QUE LA NECESITA. El endpoint
--   del pasajero lee esta columna para TODOS los circuitos, no sólo
--   para los que tengan fecha: sin ella, ninguno contesta.
--
-- ⚠ TODAS LAS COMPROBACIONES SON DE LECTURA. La consola de Neon aborta
--   la transacción en la primera sentencia que falla, así que aquí no
--   va ninguna prueba negativa.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='service_confidence_minutes') AS esta_la_0031,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='service_launch_date')        AS ya_esta_la_0032,
       (SELECT count(*) FROM circuits)            AS circuitos,
       (SELECT count(*) FROM compliance_facts)    AS hechos,
       (SELECT count(*) FROM service_occurrences) AS ocurrencias;

-- LO QUE DEBES VER:
--   esta_la_0031     TRUE
--   ya_esta_la_0032  FALSE   <- TRUE = ya aplicada, salta al PASO 3
-- Anota `circuitos`, `hechos` y `ocurrencias`. NO los compares contra
-- un número de esta hoja: se mueven solos. La comparación que vale es
-- TU paso 1 contra TU paso 3.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR. Todo junto, en una sola corrida.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE circuits ADD COLUMN IF NOT EXISTS service_launch_date DATE;

COMMENT ON COLUMN circuits.service_launch_date IS
  'El dia en que arranca el servicio de este circuito. NULL = ya opera (nunca "arranca hoy"). Con fecha futura la app ensena el recorrido y lo declarado y dice que arranca ese dia, sin caer a SIN EVIDENCIA. Es el primer escalon de la escalera: la fecha manda sobre el reloj. No se llama service_start_date para no confundirse con service_start_local, que es la HORA de apertura diaria.';

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='circuits'
   AND column_name IN ('service_launch_date','service_start_local')
 ORDER BY column_name;

-- LO QUE DEBES VER:
--   service_launch_date   date                    YES  (sin default)
--   service_start_local   time without time zone  NO   '05:00:00'
--
-- Las dos juntas a propósito: son las que NO se pueden confundir. La
-- de arriba es el DÍA en que el servicio existe por primera vez; la de
-- abajo, la HORA a la que abre cada día.

SELECT public_slug,
       service_launch_date AS arranca_el,
       service_start_local AS abre_a,
       service_end_local   AS cierra_a
  FROM circuits ORDER BY public_slug;

-- LO QUE DEBES VER: los dos circuitos con `arranca_el` en NULL, y sus
-- horarios intactos. NULL aquí significa «ya opera», que es lo cierto
-- de los dos: ninguno está esperando una fecha de arranque.
--
-- Las fechas se capturan desde el expediente del circuito, sección
-- «Lo que el concesionario declara». No se siembran desde aquí: esta
-- hoja mueve el esquema, no declara por nadie.

SELECT (SELECT count(*) FROM circuits)            AS circuitos,
       (SELECT count(*) FROM compliance_facts)    AS hechos,
       (SELECT count(*) FROM service_occurrences) AS ocurrencias;

-- `circuitos` idéntico a tu PASO 1. `hechos` y `ocurrencias` iguales o
-- MAYORES —el motor sigue sellando—, nunca menores.
