-- ════════════════════════════════════════════════════════════════════════════
-- 0056 · El acta del hecho — paso a paso para Neon
--
-- 24 de septiembre de 2026.
--
-- QUÉ HACE: agrega UNA columna, `compliance_facts.acta_snapshot` (jsonb, sin
-- default, sin índice).
--
-- POR QUÉ: el expediente de un hecho sellado explica su veredicto leyendo
-- filas que alguien puede editar —la ventana del viaje, la etiqueta y las
-- placas de la unidad, los nombres del perfil, el contrato y la planta—, así
-- que un cambio ahí es **indetectable por construcción**. Esto es la segunda
-- mitad de C24; la primera (que el expediente lea la política del sello) entró
-- el 12-ago-2026 en el #291.
--
-- NO BORRA NADA, NO TOCA DATOS, NO CAMBIA NINGUNA CONSULTA EXISTENTE. Los
-- 2 593 hechos ya sellados quedan con `NULL`, y ese NULL significa «se selló
-- antes de que el acta existiera». **No se rellena hacia atrás**: deducirla
-- con los datos de hoy sería escribir dentro de un expediente sellado algo que
-- nadie observó (Marco §E).
--
-- CUÁNDO: **el 29 de septiembre, AL FINAL de la fila** — después de la 0054
-- (libro de boletos, #528) y de la 0055 (el circuito no se borra, #536).
-- Primero la rama de pruebas; producción sólo después de verla verde.
-- ════════════════════════════════════════════════════════════════════════════


-- ── PASO 0 · Dónde estoy parado ─────────────────────────────────────────────

SELECT current_database() AS base, current_user AS quien;

-- La columna NO debe existir todavía.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'compliance_facts' AND column_name = 'acta_snapshot';


-- ── PASO 1 · Cuántos nacen sin acta ─────────────────────────────────────────
-- Para poder decirlo después con un número, y no «unos cuantos».

SELECT count(*)::int AS hechos_sellados,
       count(*) FILTER (WHERE contract_policy_snapshot IS NOT NULL)::int AS con_politica,
       count(*) FILTER (WHERE candidatas_snapshot IS NOT NULL)::int AS con_candidatas
FROM compliance_facts;


-- ── PASO 2 · El cambio ──────────────────────────────────────────────────────
-- `ADD COLUMN` de una columna anulable y sin default **no reescribe la tabla**
-- en PostgreSQL 11+: es un cambio de catálogo. No hace falta ventana.

BEGIN;

ALTER TABLE compliance_facts
  ADD COLUMN IF NOT EXISTS acta_snapshot jsonb;

COMMENT ON COLUMN compliance_facts.acta_snapshot IS
  'C24 · lo que el expediente enseña de un hecho sellado y no se podía deducir: ventana, unidades (texto), nombres (texto), estado del viaje y el CONTORNO de la evidencia (cuántos puntos, de cuándo a cuándo, y una huella que cambia si cambian). NULL = se selló antes de que el acta existiera; no se rellena hacia atrás.';

COMMIT;


-- ── PASO 3 · Comprobar que quedó ────────────────────────────────────────────
-- Esperado: una fila, `jsonb`, `is_nullable = YES`, `column_default` vacío.

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'compliance_facts' AND column_name = 'acta_snapshot';

-- Y que TODO lo viejo siga en NULL. Si aquí sale algo distinto de cero antes
-- de desplegar el motor, alguien rellenó el pasado y hay que revisarlo.
SELECT count(*)::int AS con_acta FROM compliance_facts WHERE acta_snapshot IS NOT NULL;


-- ── PASO 4 · Después de desplegar: que el motor la esté escribiendo ─────────
-- Correr esto un rato después del despliegue, con el cron ya sellando.
-- Esperado: los hechos NUEVOS con acta, y los viejos sin ella.

SELECT
  count(*) FILTER (WHERE acta_snapshot IS NOT NULL)::int AS con_acta,
  count(*) FILTER (WHERE acta_snapshot IS NULL)::int     AS sin_acta,
  max(materialized_at) FILTER (WHERE acta_snapshot IS NOT NULL) AS el_ultimo_con_acta
FROM compliance_facts;

-- Y que el acta traiga sus cinco familias, no un objeto a medias.
SELECT jsonb_object_keys(acta_snapshot) AS familia, count(*)::int AS hechos
FROM compliance_facts
WHERE acta_snapshot IS NOT NULL
GROUP BY 1 ORDER BY 1;
-- esperado: evidencia · nombres · unidades · ventana · viaje


-- ── PASO 5 · Si hay que volver atrás ────────────────────────────────────────
-- `packages/db/drizzle/0056_el_acta_del_hecho.reversa.sql`.
--
-- ⚠ **Esa reversa SÍ borra**, y lo que se pierde no se puede volver a
-- calcular: la ventana, los nombres y las placas de entonces ya no existen en
-- ninguna otra parte, y la huella de la evidencia menos. No se revierte «por
-- si acaso».
--
-- Para dejar de escribir actas sin perder las que ya hay, basta con revertir
-- el despliegue: la columna se queda y el motor deja de llenarla.
