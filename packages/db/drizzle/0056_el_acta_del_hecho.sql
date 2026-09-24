-- 0056 · El acta viaja dentro del hecho — C24, Tramo 4
--
-- El expediente de un hecho sellado explica su veredicto leyendo filas que
-- alguien puede editar: la ventana del viaje, la etiqueta y las placas de la
-- unidad, los nombres del perfil, el contrato y la planta. Nada de eso viaja
-- dentro del hecho, así que **un cambio ahí es indetectable por construcción**
-- — no se detecta tarde: no queda rastro de que hubo un antes.
--
-- La mitad barata de C24 entró el 12-ago (#291): el expediente ya lee
-- `contract_policy_snapshot` y no la política viva. Ésta es la otra mitad.
--
-- UNA columna y no cuatro (decisión de ASAV, 23-sep-2026): cuatro columnas
-- invitan a que un día se llenen tres, y estas familias ya crecieron una vez.
-- Las familias van como llaves del mismo jsonb, igual que
-- `contract_policy_snapshot`.
--
-- ⚠ **SIN DEFAULT, y el NULL significa algo.** Los 2 593 hechos ya sellados
-- nacen sin acta y **no se rellenan**: deducirla con los datos de hoy sería
-- escribir dentro de un expediente sellado un hecho que nadie observó (Marco
-- §E). Un `DEFAULT '{}'` haría que todos dijeran «su acta se guardó y estaba
-- vacía», que es falso y **es irreversible**. La pantalla dice el hueco con
-- palabras y lo distingue por forma, no sólo por color.
--
-- Qué lleva adentro:
--
--   ventana    · desde/hasta de la ventana de evidencia del viaje
--   unidades   · observada y de referencia, con económico y placas COMO TEXTO
--   nombres    · perfil, contrato, planta, cliente y transportista, texto
--   viaje      · su estado al sellar
--   evidencia  · el CONTORNO: cuántos puntos, de cuándo a cuándo, y una huella
--
-- **Texto plano y no referencias**, igual que `declared_driver_name` y por la
-- misma razón: una referencia a una fila que alguien puede editar o purgar
-- deja el acta con un hueco.
--
-- **Los puntos NO se copian** (decisión de ASAV): son miles por viaje y ya
-- viven en su tabla. Lo que se guarda es su contorno, que es lo que permite al
-- expediente **decir «esto ya no cuadra»** en vez de callarse. La huella no
-- reconstruye nada: es un testigo, no una copia.
--
-- NO BORRA NADA, NO TOCA DATOS, NO CAMBIA NINGUNA CONSULTA EXISTENTE.

ALTER TABLE compliance_facts
  ADD COLUMN IF NOT EXISTS acta_snapshot jsonb;
--> statement-breakpoint
COMMENT ON COLUMN compliance_facts.acta_snapshot IS
  'C24 · lo que el expediente enseña de un hecho sellado y no se podía deducir: ventana, unidades (texto), nombres (texto), estado del viaje y el CONTORNO de la evidencia (cuántos puntos, de cuándo a cuándo, y una huella que cambia si cambian). NULL = se selló antes de que el acta existiera; no se rellena hacia atrás.';
