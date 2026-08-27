-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0029 · velocidad efectiva y color del circuito — Neon
--
-- SE APLICA DESPUÉS DE LA 0028. Agrega DOS columnas.
--
-- ADITIVA y sin riesgo: dos columnas con default sobre una tabla de un
-- solo renglón. Ningún dato se mueve.
--
-- El 20.5 está MEDIDO, no supuesto: mediana de 9 118 ventanas de diez
-- minutos sobre 35 aparatos, 14 días, en horario. Su alcance es la
-- flota que reporta, NO este circuito — ver el encabezado de
-- packages/db/drizzle/0029_velocidad_circuito.sql.
--
-- Marcha atrás: packages/db/drizzle/0029_velocidad_circuito.reversa.sql
--
-- ⚠ TODAS LAS COMPROBACIONES DE ESTE RUNBOOK SON DE LECTURA.
--
--   La versión anterior traía dos «pruebas negativas» —un UPDATE que
--   debía fallar, envuelto en SAVEPOINT— para demostrar que los CHECK
--   muerden. En una terminal de psql eso funciona. **En la consola SQL
--   de Neon, no**: se detiene en la primera sentencia que falla y marca
--   la transacción como fallida, así que el `ROLLBACK TO SAVEPOINT`
--   nunca llega a correr. El intento del 27 de agosto murió ahí.
--
--   Es la SEGUNDA vez que la misma clase de error tumba una aplicación
--   —la primera fue el enum de la 0025—, y la lección quedó escrita en
--   docs/Procedimiento-Migraciones.md: **una prueba que no corre en el
--   mismo entorno que el runbook no prueba el runbook.**
--
--   Que los candados muerden se comprueba contra la base de PRUEBAS,
--   automatizado, en packages/db/src/circuits-constraints.integration.test.ts.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='published_at')   AS esta_la_0028,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='avg_speed_kmh')  AS ya_esta_la_velocidad,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='color_hex')      AS ya_esta_el_color,
       (SELECT count(*) FROM circuits)                                        AS circuitos;

-- `esta_la_0028` TRUE · las dos `ya_esta_*` FALSE. Anota `circuitos`.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR. Todo esto junto, en una sola corrida.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS avg_speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 20.5;

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS color_hex TEXT NOT NULL DEFAULT '#7C5CE0';

ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_velocidad_positiva;

ALTER TABLE circuits
  ADD CONSTRAINT circuits_velocidad_positiva CHECK (avg_speed_kmh > 0);

ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_color_valido;

ALTER TABLE circuits
  ADD CONSTRAINT circuits_color_valido CHECK (color_hex ~* '^#[0-9a-f]{6}$');

COMMENT ON COLUMN circuits.avg_speed_kmh IS
  'Velocidad EFECTIVA de avance declarada del circuito, en km/h: desplazamiento entre tiempo, con paradas y semáforos dentro. Es el punto de partida del rango de llegada; el teléfono la corrige con lo que mide. Default 20.5 = mediana medida sobre la flota que reporta (9 118 ventanas, 35 aparatos, 14 días), NO sobre este circuito. Se calibra en la calle.';

COMMENT ON COLUMN circuits.color_hex IS
  'El color con que se identifica la ruta en el mapa y en la app del pasajero. Por circuito, no en el codigo: con mas rutas cada una lleva el suyo.';


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS, dentro de la misma transacción.
--          Todo LECTURA: nada de aquí puede tumbar la corrida.
-- ───────────────────────────────────────────────────────────────────

-- 3.1 · Las dos columnas quedaron como deben. Las dos filas TRUE.
SELECT column_name,
       CASE column_name
         WHEN 'avg_speed_kmh' THEN data_type = 'double precision'
                                   AND is_nullable = 'NO'
                                   AND column_default LIKE '%20.5%'
         WHEN 'color_hex'     THEN data_type = 'text'
                                   AND is_nullable = 'NO'
                                   AND column_default LIKE '%#7C5CE0%'
       END AS ok
  FROM information_schema.columns
 WHERE table_name = 'circuits'
   AND column_name IN ('avg_speed_kmh', 'color_hex')
 ORDER BY column_name;

-- 3.2 · Los DOS constraints existen y dicen lo que deben decir.
--
--       Se lee su definición en vez de intentar violarla: leer prueba lo
--       mismo —que la regla quedó escrita como se quería— y no puede
--       tumbar la transacción en una consola que se detiene al primer
--       error. Debe devolver DOS renglones.
SELECT conname,
       pg_get_constraintdef(oid) AS definicion
  FROM pg_constraint
 WHERE conrelid = 'circuits'::regclass
   AND conname IN ('circuits_velocidad_positiva', 'circuits_color_valido')
 ORDER BY conname;

-- Esperado, palabra por palabra. Copiado de una corrida real contra la
-- rama de prueba, no escrito de memoria — la primera versión de este
-- comentario traía un `(color_hex)::text` que Postgres NO pone, porque la
-- columna ya es texto, y habría hecho abortar una migración correcta:
--
--   circuits_color_valido        CHECK ((color_hex ~* '^#[0-9a-f]{6}$'::text))
--   circuits_velocidad_positiva  CHECK ((avg_speed_kmh > (0)::double precision))
--
-- Si falta cualquiera de los dos renglones, o la definición no cuadra:
-- ROLLBACK.

-- 3.3 · Ningún circuito quedó con un valor inutilizable. Los dos en 0.
SELECT count(*) FILTER (WHERE avg_speed_kmh IS NULL OR avg_speed_kmh <= 0) AS sin_velocidad,
       count(*) FILTER (WHERE color_hex !~* '^#[0-9a-f]{6}$')              AS con_color_invalido
  FROM circuits;

-- 3.4 · El número de circuitos no se movió. Comparar con el paso 1.
SELECT count(*) AS circuitos FROM circuits;


-- ───────────────────────────────────────────────────────────────────
-- PASO 4 · Si todo cuadró:
COMMIT;
-- Si no:
-- ROLLBACK;
-- ───────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────
-- DESPUÉS DEL COMMIT
--
-- Los dos campos aparecen editables en /jstaff/circuitos/<id>, junto a
-- la frecuencia declarada. La VELOCIDAD es la que vas a mover en la
-- prueba de campo de los días 11-13: si los rangos salen cortos, la
-- velocidad real es menor que la declarada, y al revés.
-- ───────────────────────────────────────────────────────────────────
