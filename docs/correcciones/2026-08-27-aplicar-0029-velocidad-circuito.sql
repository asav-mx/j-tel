-- ═══════════════════════════════════════════════════════════════════
-- Aplicar la 0029 · velocidad efectiva y color del circuito — Neon
--
-- SE APLICA DESPUÉS DE LA 0028.
--
-- ADITIVA y sin riesgo: una columna con default sobre una tabla de un
-- solo renglón. Ningún dato se mueve.
--
-- El 20.5 está MEDIDO, no supuesto: mediana de 9 118 ventanas de diez
-- minutos sobre 35 aparatos, 14 días, en horario. Su alcance es la
-- flota que reporta, NO este circuito — ver el encabezado de
-- packages/db/drizzle/0029_velocidad_circuito.sql.
--
-- Marcha atrás: packages/db/drizzle/0029_velocidad_circuito.reversa.sql
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='published_at')   AS esta_la_0028,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='avg_speed_kmh')  AS ya_esta_aplicada,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='circuits' AND column_name='color_hex')      AS ya_esta_el_color,
       (SELECT count(*) FROM circuits)                                        AS circuitos;

-- `esta_la_0028` TRUE · `ya_esta_aplicada` FALSE. Anota `circuitos`.


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS avg_speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 20.5;

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS color_hex TEXT NOT NULL DEFAULT '#7C5CE0';

ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_color_valido;

ALTER TABLE circuits
  ADD CONSTRAINT circuits_color_valido CHECK (color_hex ~* '^#[0-9a-f]{6}$');

ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_velocidad_positiva;

ALTER TABLE circuits
  ADD CONSTRAINT circuits_velocidad_positiva CHECK (avg_speed_kmh > 0);

COMMENT ON COLUMN circuits.avg_speed_kmh IS
  'Velocidad EFECTIVA de avance declarada del circuito, en km/h: desplazamiento entre tiempo, con paradas y semáforos dentro. Es el punto de partida del rango de llegada; el teléfono la corrige con lo que mide. Default 20.5 = mediana medida sobre la flota que reporta (9 118 ventanas, 35 aparatos, 14 días), NO sobre este circuito. Se calibra en la calle.';


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS, dentro de la misma transacción.
-- ───────────────────────────────────────────────────────────────────

-- 3.1 · La columna quedó con su tipo, su NOT NULL y su default. TRUE.
SELECT data_type = 'double precision'
   AND is_nullable = 'NO'
   AND column_default LIKE '%20.5%'   AS columna_ok
  FROM information_schema.columns
 WHERE table_name='circuits' AND column_name='avg_speed_kmh';

-- 3.2 · El CHECK existe. Debe dar 1.
SELECT count(*) AS check_puesto
  FROM information_schema.table_constraints
 WHERE table_name='circuits' AND constraint_name='circuits_velocidad_positiva';

-- 3.3 · El CHECK muerde de verdad. Esto DEBE fallar. Si pasa, ROLLBACK:
--       una velocidad de cero divide entre cero al calcular la llegada.
SAVEPOINT probar_check;
UPDATE circuits SET avg_speed_kmh = 0;
ROLLBACK TO SAVEPOINT probar_check;

-- 3.35 · El CHECK del color muerde. Esto DEBE fallar.
SAVEPOINT probar_color;
UPDATE circuits SET color_hex = 'morado';
ROLLBACK TO SAVEPOINT probar_color;

-- 3.4 · Ningún circuito quedó sin velocidad utilizable. Debe dar 0.
SELECT count(*) AS circuitos_sin_velocidad
  FROM circuits WHERE avg_speed_kmh IS NULL OR avg_speed_kmh <= 0;

-- 3.5 · El número de circuitos no se movió. Comparar con el paso 1.
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
-- El campo aparece editable en /jstaff/circuitos/<id>, junto a la
-- frecuencia declarada. Es el que vas a mover en la prueba de campo
-- de los días 11-13: si los rangos salen cortos, la velocidad real es
-- menor que la declarada, y al revés.
-- ───────────────────────────────────────────────────────────────────
