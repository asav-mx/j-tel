-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0031 · la escalera de estados de la app pública — Neon
--
-- SE APLICA DESPUÉS DE LA 0030.
--
-- ⚠ ESTA NO ES PURAMENTE ADITIVA. El paso 2 ESCRIBE en las filas
--   existentes: pone `declared_frequency_minutes` en NULL donde hoy
--   vale exactamente 20. Es deliberado y está argumentado en el
--   encabezado de packages/db/drizzle/0031_estados_publico.sql.
--
--   Ninguno de esos 20 tiene un humano detrás — es el default de la
--   columna. La app los estaba diciendo en voz alta como si alguien
--   los hubiera declarado.
--
-- ⚠ LA MARCHA ATRÁS NO DEVUELVE ESOS 20. No puede: no eran un dato.
--   Ver packages/db/drizzle/0031_estados_publico.reversa.sql, que lo
--   dice antes de sus pasos.
--
-- ⚠ SE APLICA ANTES DE MERGEAR EL CÓDIGO QUE LA NECESITA.
--
-- ⚠ TODAS LAS COMPROBACIONES SON DE LECTURA. La consola de Neon aborta
--   la transacción en la primera sentencia que falla, así que aquí no
--   va ninguna prueba negativa. Que los CHECK muerden se comprueba
--   contra la base de PRUEBAS, en
--   packages/db/src/circuits-constraints.integration.test.ts (75/75).
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='corridor_tolerance_meters')  AS esta_la_0030,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='service_confidence_minutes') AS ya_esta_la_0031,
       (SELECT count(*) FROM circuits)            AS circuitos,
       (SELECT count(*) FROM compliance_facts)    AS hechos,
       (SELECT count(*) FROM service_occurrences) AS ocurrencias;

-- LO QUE DEBES VER:
--   esta_la_0030     TRUE
--   ya_esta_la_0031  FALSE   <- TRUE = ya aplicada, salta al PASO 3
--   circuitos        2
-- Anota `hechos` y `ocurrencias`. NO los compares contra un número de
-- esta hoja: se mueven solos. La comparación que vale es TU paso 1
-- contra TU paso 3.

SELECT public_slug, declared_frequency_minutes FROM circuits ORDER BY public_slug;

-- Los dos en 20. Ése es el valor que el paso 2 va a poner en NULL, y
-- ésta es tu última oportunidad de detenerte si alguno de los dos SÍ
-- lo declaró un humano: en ese caso, avísame antes de seguir.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR. Todo junto, en una sola corrida.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE circuits ALTER COLUMN declared_frequency_minutes DROP DEFAULT;

ALTER TABLE circuits ALTER COLUMN declared_frequency_minutes DROP NOT NULL;

UPDATE circuits SET declared_frequency_minutes = NULL WHERE declared_frequency_minutes = 20;

COMMENT ON COLUMN circuits.declared_frequency_minutes IS
  'Cada cuantos minutos declara el concesionario que pasa una unidad. NULL = no declarada, y entonces la app dice que hay servicio SIN tiempo estimado. Nunca se inventa una cadencia.';

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS service_confidence_minutes INTEGER NOT NULL DEFAULT 15;

ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_confianza_positiva;

ALTER TABLE circuits
  ADD CONSTRAINT circuits_confianza_positiva CHECK (service_confidence_minutes > 0);

COMMENT ON COLUMN circuits.service_confidence_minutes IS
  'Cuanto tiempo despues de ver una unidad DENTRO DEL CORREDOR se puede seguir afirmando que hay servicio. Pasado esto el circuito cae a SIN SERVICIO y la app deja de prometer cadencia. No se deriva de la frecuencia: son dos perillas con significados distintos.';

ALTER TABLE circuits ADD COLUMN IF NOT EXISTS arrival_range_enabled_at TIMESTAMPTZ;

COMMENT ON COLUMN circuits.arrival_range_enabled_at IS
  'Desde cuando el circuito muestra el RANGO de llegada al pasajero. NULL = apagado: se ve el camion en el mapa pero no el minuto estimado. Se prende cuando la velocidad del circuito ya se calibro contra la calle.';

COMMIT;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='circuits'
   AND column_name IN ('declared_frequency_minutes','service_confidence_minutes','arrival_range_enabled_at')
 ORDER BY column_name;

-- LO QUE DEBES VER:
--   arrival_range_enabled_at     timestamptz  YES  (sin default)
--   declared_frequency_minutes   integer      YES  (sin default)  <- las DOS cosas
--   service_confidence_minutes   integer      NO   15

SELECT public_slug,
       declared_frequency_minutes AS frecuencia,
       service_confidence_minutes AS confianza_min,
       arrival_range_enabled_at   AS rango_desde
  FROM circuits ORDER BY public_slug;

-- LO QUE DEBES VER, exactamente:
--   corredor-prueba   frecuencia NULL   confianza 15   rango NULL
--   oasis-centro      frecuencia NULL   confianza 15   rango NULL
--
-- Los dos sin frecuencia (la app dirá que hay servicio sin tiempo
-- estimado) y los dos con el rango apagado, que es el default querido.

SELECT conname, pg_get_constraintdef(oid) AS definicion
  FROM pg_constraint
 WHERE conrelid='circuits'::regclass
   AND conname IN ('circuits_confianza_positiva','circuits_frecuencia_positiva')
 ORDER BY conname;

-- Los DOS. El de la frecuencia no se tocó y sigue sirviendo: en Postgres
-- una comparación con NULL da UNKNOWN y un CHECK sólo se viola con
-- FALSE, así que protege el valor cuando lo hay y deja pasar la ausencia.

SELECT (SELECT count(*) FROM circuits)            AS circuitos,
       (SELECT count(*) FROM compliance_facts)    AS hechos,
       (SELECT count(*) FROM service_occurrences) AS ocurrencias;

-- `circuitos` idéntico (2). `hechos` y `ocurrencias` iguales o MAYORES
-- que en tu PASO 1 —el motor sigue sellando—, nunca menores.
