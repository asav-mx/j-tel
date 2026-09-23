-- ════════════════════════════════════════════════════════════════════════════
-- 0055 · El circuito no se borra — paso a paso para Neon
--
-- 23 de septiembre de 2026.
--
-- QUÉ HACE: cambia UNA referencia, `circuit_stops.circuit_id`, de
-- ON DELETE CASCADE a ON DELETE RESTRICT.
--
-- POR QUÉ: cada parada tiene un letrero de lámina **atornillado a un poste**.
-- Borrar un circuito se llevaba sus paradas por cascada, y con ellas cada QR
-- impreso de ese circuito — sin aviso, sin rastro y sin forma de deshacerlo. La
-- lámina en la calle no se entera de que alguien borró un renglón.
--
-- NO BORRA NADA, NO AGREGA COLUMNAS, NO TOCA DATOS. Sólo cambia qué pasa el día
-- que alguien intente un DELETE.
--
-- CUÁNDO: **no antes del 29 de septiembre**, y detrás del #528 (que trae la
-- 0054). Primero la rama de pruebas; producción sólo después de ver la rama de
-- pruebas verde.
-- ════════════════════════════════════════════════════════════════════════════


-- ── PASO 0 · Dónde estoy parado ─────────────────────────────────────────────
-- Antes de cambiar nada: confirmar la base y ver la restricción como está hoy.
-- Debe decir 'c' (CASCADE).

SELECT current_database() AS base, current_user AS quien;

SELECT
  con.conname                              AS restriccion,
  con.confdeltype                          AS al_borrar,   -- 'c' = CASCADE, 'r' = RESTRICT
  pg_get_constraintdef(con.oid)            AS definicion
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'circuit_stops'
  AND con.contype = 'f'
  AND pg_get_constraintdef(con.oid) LIKE '%circuits%';


-- ── PASO 1 · Cuánto hay en juego ────────────────────────────────────────────
-- Nada más para saberlo: cuántas láminas dependen de esto hoy.

SELECT
  count(*)                                        AS paradas,
  count(*) FILTER (WHERE retired_at IS NULL)      AS vigentes,
  count(DISTINCT circuit_id)                      AS circuitos
FROM circuit_stops;


-- ── PASO 2 · El cambio ──────────────────────────────────────────────────────
-- Las dos sentencias van JUNTAS, en una transacción: entre el DROP y el ADD la
-- tabla queda sin restricción, y ése es exactamente el momento en el que no
-- queremos que pase nada.

-- ⚠ **Fíjate en el nombre.** La 0025 creó esta tabla con SQL a mano, así que
-- quien nombró la restricción fue Postgres: `circuit_stops_circuit_id_fkey`, NO
-- el `..._circuits_id_fk` que pondría Drizzle. Soltar el nombre equivocado no
-- falla —el `IF EXISTS` lo pasa con un NOTICE— y deja la tabla con **dos**
-- referencias al mismo circuito, una RESTRICT y otra CASCADE: se ve verde y no
-- lo está. Por eso van los dos DROP, y por eso el PASO 3 cuenta las filas.

BEGIN;

ALTER TABLE circuit_stops
  DROP CONSTRAINT IF EXISTS circuit_stops_circuit_id_fkey;

ALTER TABLE circuit_stops
  DROP CONSTRAINT IF EXISTS circuit_stops_circuit_id_circuits_id_fk;

ALTER TABLE circuit_stops
  ADD CONSTRAINT circuit_stops_circuit_id_fkey
  FOREIGN KEY (circuit_id) REFERENCES circuits(id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT circuit_stops_circuit_id_fkey ON circuit_stops IS
  'RESTRICT y no CASCADE: cada parada tiene un letrero de lámina atornillado a un poste, y borrar el circuito convertiría cada QR impreso en un callejón sin aviso ni rastro. Para dejar de dar un circuito se despublica (published_at = NULL), que lo quita de la app al instante y no borra nada.';

COMMIT;


-- ── PASO 3 · Comprobar que quedó ────────────────────────────────────────────
-- La misma consulta del PASO 0. Tiene que devolver **exactamente un renglón**,
-- con `al_borrar` = 'r'. Dos renglones significa que quedó la vieja además de
-- la nueva: vuelve al PASO 2 y suelta las dos por su nombre.

SELECT
  con.conname                   AS restriccion,
  con.confdeltype               AS al_borrar,
  pg_get_constraintdef(con.oid) AS definicion
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'circuit_stops'
  AND con.contype = 'f'
  AND pg_get_constraintdef(con.oid) LIKE '%circuits%';


-- ── PASO 4 · Probar que de verdad muerde, SIN romper nada ───────────────────
-- Intenta borrar un circuito que tenga paradas y comprueba que la base dice que
-- no. Va dentro de una transacción que SIEMPRE se deshace: no hay forma de que
-- este paso borre algo, aunque la restricción no hubiera quedado.
--
-- Esperado: ERROR 23503 «update or delete on table "circuits" violates foreign
-- key constraint ... on table "circuit_stops"».

BEGIN;

DELETE FROM circuits
WHERE id = (SELECT circuit_id FROM circuit_stops LIMIT 1);

ROLLBACK;   -- ← SIEMPRE. Si el DELETE hubiera pasado, esto lo deshace.


-- ── PASO 5 · Si hay que volver atrás ────────────────────────────────────────
-- `packages/db/drizzle/0055_el_circuito_no_se_borra.reversa.sql`.
--
-- Volver atrás **vuelve a permitir** que borrar un circuito se lleve sus
-- paradas. No se revierte «por si acaso»: sólo si la restricción está
-- bloqueando una operación legítima — y entonces lo que hay que arreglar es esa
-- operación, no la restricción.
--
-- Lo que SÍ hay que hacer para dejar de dar un circuito es **despublicarlo**:
--
--   UPDATE circuits SET published_at = NULL WHERE public_slug = '‹slug›';
--
-- Lo quita de la app al instante, no borra nada, y los letreros de sus paradas
-- dejan de abrir — que es lo correcto: lo no publicado no existe para la app.
