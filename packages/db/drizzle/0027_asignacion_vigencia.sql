-- Asignación de unidad a circuito: el motivo y el candado — ADITIVA.
--
-- Se aplica DESPUÉS de la 0026. Una columna y un índice sobre una tabla que
-- **todavía no tiene una sola escritura en el código**: la 0025 creó
-- `circuit_unit_assignments` y hasta hoy nadie inserta en ella.
--
-- ## La vigencia ya estaba; lo que faltaba era la garantía
--
-- La 0025 nació bien: `valid_from` / `valid_to`, no una columna `circuito_id`
-- sobre la unidad. Una unidad que corre el circuito hoy y maquila mañana cierra
-- su asignación, no la pisa, y el pasado se queda donde estaba.
--
-- Lo que le faltó es lo que sí tienen las versiones de parada: **el candado**.
-- Sin él, nada impide dos filas abiertas de la misma unidad, y una unidad con
-- dos asignaciones vigentes se publica en dos circuitos a la vez. Un camión
-- físico corre un circuito a la vez, y eso lo garantiza la base — no el código
-- de turno, que cambia con cada pantalla nueva.
--
-- Misma forma que `circuit_stop_versions_una_vigente`, por la misma razón: que
-- «la unidad que corre este circuito hoy» nunca sea ambiguo.
--
-- ## Por qué el motivo
--
-- Una asignación que termina sin decir por qué deja un hueco justo donde está
-- el valor: el historial de la concesión. «Se fue a maquila», «entró a taller»,
-- «la cambió el carrier» son la diferencia entre una fecha y una explicación.
-- Se escribe al CERRAR, que es cuando existe algo que explicar — igual que el
-- `motivo` de las versiones de parada.

-- ⚠ EL ÍNDICE ÚNICO FALLA SI YA HAY DUPLICADOS ABIERTOS. Hoy no puede haberlos
-- porque no existe camino de escritura, pero eso se COMPRUEBA antes de aplicar,
-- no se supone. La consulta está en el runbook, en docs/correcciones/.
ALTER TABLE circuit_unit_assignments ADD COLUMN IF NOT EXISTS motivo TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS circuit_unit_assignments_una_vigente
  ON circuit_unit_assignments (unit_id) WHERE valid_to IS NULL;
--> statement-breakpoint
COMMENT ON COLUMN circuit_unit_assignments.motivo IS
  'Por qué TERMINÓ la asignación, cuando quien la cerró se molesta en decirlo. Se escribe al cerrar, no al abrir. Alimenta el historial de la concesión.';
