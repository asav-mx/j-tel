-- El libro de boletos y el registro de lectores — Ontoy 3.0 · PR P3.5. ADITIVA.
--
-- Se aplica ANTES de desplegar el código que la lee: la API relacional de
-- Drizzle pide TODAS las columnas declaradas (la lección de la 0016). Cuatro
-- tablas nuevas, vacías. No toca ninguna fila de nada que ya exista.
--
-- ⚠ **EN PRODUCCIÓN, NO ANTES DEL 29 DE SEPTIEMBRE** (la misma raya que la
-- 0053): la semana de la calibración con camiones va sin piezas nuevas cerca.
-- En la rama de PRUEBA se aplica ya.
--
-- ══════════════════════════════════════════════════════════════════════
-- 1. Por qué una tabla nueva y no `ledger_entries`
-- ══════════════════════════════════════════════════════════════════════
--
-- `ledger_entries` es la bitácora del árbitro: cada renglón cuelga de un
-- `trip_id` y un `service_occurrence_id` **obligatorios**, que son las piezas
-- del transporte de personal. Un boleto de Ontoy no tiene viaje contratado ni
-- ocurrencia de servicio, y nunca los va a tener. Meterlo ahí obligaría a
-- aflojar dos `NOT NULL` del motor para hospedar a un inquilino que no es de
-- la casa. Son dos libros de dos cosas distintas, y así se quedan
-- (decisión de Asav, 23-sep-2026).
--
-- ══════════════════════════════════════════════════════════════════════
-- 2. El libro no puede perder renglones (corrección de Asav, 23-sep)
-- ══════════════════════════════════════════════════════════════════════
--
-- Dos candados, y los dos están aquí porque una regla que sólo vive en el
-- código de turno se salta desde la consola de Neon — la lección de la 0020.
--
-- **a) Ninguna referencia del libro cae en cascada.** `circuit_unit_assignments`
-- sí borra en cascada desde `circuits` y desde `units`; si el libro colgara de
-- ella, borrar un circuito se llevaría por delante viajes quemados. Por eso el
-- libro apunta **directo** a `units` y a `circuits` con `ON DELETE RESTRICT`.
--
-- **Consecuencia deliberada, y se paga:** una unidad que ya quemó boletos **no
-- se puede borrar**, y tampoco la cuenta que la contiene. El borrado falla con
-- el nombre de la restricción en la cara. Eso es lo que significa que el libro
-- mande sobre el plan. En la desechable, después de una prueba física, la
-- ciudad sembrada ya no se tira con `--limpiar`: se tira la rama entera.
--
-- **b) La base rechaza `UPDATE` y `DELETE`.** Un trigger, no un permiso: el
-- permiso no alcanza al dueño de la tabla, y el dueño es justo quien corre las
-- hojas SQL. `TRUNCATE` lleva el suyo aparte porque no dispara triggers de
-- renglón — es el hueco por el que se vacía una tabla «sin borrar nada».
--
-- Alcanza también a `validator_syncs`: ahí queda el registro de los lotes
-- rechazados de un lector robado, y un registro que se puede borrar no es
-- registro.
--
-- ══════════════════════════════════════════════════════════════════════
-- 3. Lo que el libro guarda es LO OBSERVADO, y lo dice en los nombres
-- ══════════════════════════════════════════════════════════════════════
--
-- Las columnas se llaman `unidad_asignada_id` y `circuito_asignado_id`, no «la
-- unidad» y «el circuito» (corrección de Asav, 23-sep): salen de las
-- asignaciones vigentes al momento del quemado, y una asignación es **plan**.
-- El circuito **recorrido** se derivará del GPS y no vive aquí.
--
-- Si a esa hora el lector no tenía unidad, o la unidad no tenía circuito, la
-- columna queda en null y el renglón dice «no consta», que es la verdad. No se
-- inventa el camión.
--
-- **A quién le toca el dinero no se decide aquí.** No hay columna de importe,
-- de transportista ni de concesión: el reparto es de la Pieza 10 (8.14) y ni
-- siquiera está diseñado.
--
-- **Dos relojes, dos columnas.** `quemado_en` es la hora del lector, que puede
-- estar corrida y sin red no hay con qué ajustarla; `recibido_en` es la del
-- servidor, que sí consta. Una sola columna tendría que mentir en un lado.
--
-- ══════════════════════════════════════════════════════════════════════
-- 4. Lo que NO se guarda de cada boleto
-- ══════════════════════════════════════════════════════════════════════
--
-- El lote trae el boleto entero para que el servidor **re-verifique la firma de
-- J-Tel** al recibirlo (corrección de Asav: un lector robado no puede inventar
-- folios). Del boleto se guarda el folio y la firma; **el cuerpo no se guarda**:
-- lleva la llave del portador y el instante de emisión, y los boletos de una
-- misma compra comparten ese instante — guardarlos dejaría agrupados los diez
-- viajes de una persona, que es justo la liga que la decisión (e1) evitó.
--
-- Que la fila exista significa que la firma verificó al recibirla. No hay
-- columna «firma_verificada»: una columna que sólo puede decir `true` afirma
-- algo que no comprobó cada vez que se lee.
--
-- ══════════════════════════════════════════════════════════════════════
-- 5. Sin enums, a propósito
-- ══════════════════════════════════════════════════════════════════════
--
-- `kind` y `resultado` van en `text` con `CHECK`, como `ledger_entries.action`.
-- La lista de renglones va a crecer (`conciliado` lo llenará la caja del P4) y
-- `ALTER TYPE ... ADD VALUE` es la trampa conocida de la 0025: el valor nuevo
-- no se puede usar ni leer en la transacción que lo agrega. Un `CHECK` se
-- cambia en una sola transacción, con todo lo demás.
--
-- Todo este archivo corre en UNA transacción: no lleva CONCURRENTLY, no crea
-- enums y no usa valores nuevos de ninguno.

-- ── Los lectores ────────────────────────────────────────────────────────
--
-- Concepto propio, no `devices` (decisión de Asav, 23-sep, opción b). La razón
-- es dura: `device_assignments_unidad_una_vigente` (0039) dice **una unidad, un
-- aparato**, y un camión trae GPS y lector a la vez — reusarlo obligaría a
-- aflojar el candado que le dice al archivador de qué unidad es cada punto.
-- Además un lector no tiene IMEI, no transmite a Compás y el cotejo (6.7) lo
-- reclamaría por no aparecer allá. Misma **ley** (6.5: baja con fecha y motivo,
-- la fila no se borra), aparato distinto.
CREATE TABLE IF NOT EXISTS validators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  -- La llave pública Ed25519 del lector, en hex. Con ella firma sus lotes: no
  -- hay secreto compartido que pegar en un chat, y la privada no sale del
  -- aparato. Dar de baja el lector revoca su llave en el mismo instante.
  llave_publica text NOT NULL,
  -- El consecutivo global del nombre (6.3): se asigna una vez y no se reutiliza.
  consecutivo integer NOT NULL,
  label text NOT NULL,
  alta_en timestamptz NOT NULL DEFAULT now(),
  alta_por text,
  baja_en timestamptz,
  baja_motivo text,
  baja_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT validators_llave_publica_hex CHECK (llave_publica ~ '^[0-9a-f]{64}$'),
  -- Las dos juntas o ninguna (6.5, igual que `devices_baja_con_motivo`).
  CONSTRAINT validators_baja_con_motivo CHECK ((baja_en IS NULL) = (baja_motivo IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS validators_llave_publica_unica ON validators (llave_publica);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS validators_consecutivo_unico ON validators (consecutivo);
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS validators_consecutivo_seq AS integer MINVALUE 1;
--> statement-breakpoint

-- ── Lector ↔ unidad ─────────────────────────────────────────────────────
--
-- Espejo de `device_assignments`: asignar, soltar y dar de baja sin borrar la
-- fila, con quién y por qué al cerrar. **Esto sí cae en cascada**, como
-- `circuit_unit_assignments`: es plan, no es el libro.
CREATE TABLE IF NOT EXISTS validator_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validator_id uuid NOT NULL REFERENCES validators(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  asignada_por text,
  cerrada_por text,
  motivo_cierre text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS validator_assignments_lector_una_vigente
  ON validator_assignments (validator_id) WHERE valid_to IS NULL;
--> statement-breakpoint
-- Una unidad, un lector. Un camión con dos lectores vigentes haría que el libro
-- atribuyera el mismo quemado a dos aparatos según cuál leyera primero.
CREATE UNIQUE INDEX IF NOT EXISTS validator_assignments_unidad_una_vigente
  ON validator_assignments (unit_id) WHERE valid_to IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS validator_assignments_lector_idx
  ON validator_assignments (validator_id, valid_from);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS validator_assignments_unidad_idx
  ON validator_assignments (unit_id, valid_from);
--> statement-breakpoint

-- ── Las entregas del lector ─────────────────────────────────────────────
--
-- Un renglón por cada vez que un lector habla, traiga o no traiga quemados: el
-- latido de un camión vacío es una entrega aceptada de cero renglones
-- (decisión de Asav, 23-sep). De aquí sale «cuál lector lleva 4 h de servicio
-- sin contacto», y aquí queda el intento de un lector dado de baja.
CREATE TABLE IF NOT EXISTS validator_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validator_id uuid NOT NULL REFERENCES validators(id) ON DELETE RESTRICT,
  recibido_en timestamptz NOT NULL DEFAULT now(),
  resultado text NOT NULL,
  renglones_enviados integer NOT NULL DEFAULT 0,
  -- Los que entraron al libro. En un reenvío es 0: la idempotencia no duplica.
  renglones_nuevos integer NOT NULL DEFAULT 0,
  -- Los que el servidor no aceptó (firma del boleto que no es de J-Tel, folio
  -- que no cuadra con el boleto, renglón mal formado). El porqué va en detalle.
  renglones_rechazados integer NOT NULL DEFAULT 0,
  -- La firma del lote, tal como llegó. Se guarda también cuando no verifica:
  -- es la evidencia de qué se intentó.
  firma text,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT validator_syncs_resultado CHECK (
    resultado IN ('aceptado', 'aceptado_con_rechazos', 'rechazado_firma', 'rechazado_lector_de_baja')
  ),
  CONSTRAINT validator_syncs_conteos CHECK (
    renglones_enviados >= 0
    AND renglones_nuevos >= 0
    AND renglones_rechazados >= 0
    AND renglones_nuevos + renglones_rechazados <= renglones_enviados
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS validator_syncs_lector_idx ON validator_syncs (validator_id, recibido_en);
--> statement-breakpoint

-- ── El libro ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  folio text NOT NULL,
  -- Quién lo quemó. Null en los renglones que no vienen de un lector.
  validator_id uuid REFERENCES validators(id) ON DELETE RESTRICT,
  -- Lo observado: la unidad y el circuito que el PLAN le asignaba en ese
  -- momento. Null si no había asignación: no consta.
  unidad_asignada_id uuid REFERENCES units(id) ON DELETE RESTRICT,
  circuito_asignado_id uuid REFERENCES circuits(id) ON DELETE RESTRICT,
  con_senal boolean,
  -- La firma de J-Tel sobre el boleto, re-verificada al recibirla.
  firma_del_boleto text,
  -- El reloj del lector. Puede venir corrido y no hay con qué ajustarlo.
  quemado_en timestamptz,
  -- La fecha local del lector: su jornada, que es la que topa a 20 sin señal.
  dia_del_lector date,
  -- El reloj del servidor. Éste sí consta.
  recibido_en timestamptz NOT NULL DEFAULT now(),
  -- El id que el lector le puso al paso. Con él, reenviar un lote no duplica
  -- renglones **ni levanta un doble uso falso**.
  paso_del_lector uuid,
  sync_id uuid REFERENCES validator_syncs(id) ON DELETE RESTRICT,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ticket_operations_kind CHECK (
    kind IN ('emitido', 'quemado', 'reclamo_dictado', 'doble_uso_detectado', 'conciliado')
  ),
  -- Lo que un renglón del lector no puede callar.
  CONSTRAINT ticket_operations_del_lector_completo CHECK (
    kind NOT IN ('quemado', 'reclamo_dictado')
    OR (validator_id IS NOT NULL AND paso_del_lector IS NOT NULL
        AND quemado_en IS NOT NULL AND dia_del_lector IS NOT NULL
        AND con_senal IS NOT NULL AND sync_id IS NOT NULL)
  ),
  -- Un quemado trae la firma que se verificó. **La vía dictada no verifica
  -- nada** y por eso no puede traerla: ocho dígitos no son una firma, y un
  -- reclamo con firma sería un quemado disfrazado.
  CONSTRAINT ticket_operations_quemado_con_firma CHECK (
    kind <> 'quemado' OR firma_del_boleto IS NOT NULL
  ),
  CONSTRAINT ticket_operations_reclamo_sin_firma CHECK (
    kind <> 'reclamo_dictado' OR firma_del_boleto IS NULL
  ),
  -- El hallazgo lo escribe el servidor: no es de un lector ni de un paso.
  CONSTRAINT ticket_operations_hallazgo_sin_lector CHECK (
    kind <> 'doble_uso_detectado'
    OR (validator_id IS NULL AND paso_del_lector IS NULL AND firma_del_boleto IS NULL)
  )
);
--> statement-breakpoint
-- La idempotencia, y es la que sostiene la prueba: va por **lector y paso**,
-- nunca por folio a secas. Por folio, el segundo lector que quema el mismo
-- boleto se vería como un reenvío y el doble uso desaparecería en silencio.
CREATE UNIQUE INDEX IF NOT EXISTS ticket_operations_paso_unico
  ON ticket_operations (validator_id, paso_del_lector) WHERE paso_del_lector IS NOT NULL;
--> statement-breakpoint
-- Lo que pregunta el cotejo al recibir, y lo que pregunta el pase con señal.
CREATE INDEX IF NOT EXISTS ticket_operations_folio_idx ON ticket_operations (folio, kind);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ticket_operations_lector_idx
  ON ticket_operations (validator_id, recibido_en);
--> statement-breakpoint

-- ── Lo que la base no deja hacer ────────────────────────────────────────
CREATE FUNCTION rechazar_cambio_en_el_libro() RETURNS trigger AS $libro$
BEGIN
  RAISE EXCEPTION
    'El libro de boletos no se edita ni se borra (0054): % sobre % esta prohibido.',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'JT054';
END;
$libro$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ticket_operations_sin_cambios
  BEFORE UPDATE OR DELETE ON "ticket_operations"
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_en_el_libro();
--> statement-breakpoint
-- TRUNCATE no dispara triggers de renglón: sin éste, la tabla se vacía entera
-- sin que nada la defienda.
CREATE TRIGGER ticket_operations_sin_truncar
  BEFORE TRUNCATE ON "ticket_operations"
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_en_el_libro();
--> statement-breakpoint
CREATE TRIGGER validator_syncs_sin_cambios
  BEFORE UPDATE OR DELETE ON "validator_syncs"
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_en_el_libro();
--> statement-breakpoint
CREATE TRIGGER validator_syncs_sin_truncar
  BEFORE TRUNCATE ON "validator_syncs"
  FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_en_el_libro();
--> statement-breakpoint

COMMENT ON TABLE validators IS
  'Los lectores del camion (0054, Ontoy 3.0 P3.5). Concepto propio, no devices: un lector no tiene IMEI ni transmite a Compas, y un camion trae GPS y lector a la vez. Misma ley 6.5: baja con fecha y motivo, la fila no se borra.';
--> statement-breakpoint
COMMENT ON COLUMN validators.llave_publica IS
  'La publica Ed25519 del lector, en hex. Con la privada, que no sale del aparato, firma sus lotes. La baja la revoca en el instante: un lote firmado por un lector de baja se rechaza y queda su renglon en validator_syncs.';
--> statement-breakpoint
COMMENT ON TABLE validator_assignments IS
  'Lector en unidad, con vigencia (0054). Espejo de device_assignments; un lector en una unidad y una unidad con un lector a la vez. Es PLAN y cae en cascada, al contrario del libro.';
--> statement-breakpoint
COMMENT ON TABLE validator_syncs IS
  'Cada vez que un lector habla, traiga o no quemados (0054). El latido de un camion vacio es una entrega de cero renglones. Inmutable: aqui queda el intento de un lector dado de baja.';
--> statement-breakpoint
COMMENT ON TABLE ticket_operations IS
  'El libro de operaciones de boletos de Ontoy (0054). Solo INSERT: un trigger rechaza UPDATE, DELETE y TRUNCATE. No es ledger_entries, que es la bitacora del arbitro y cuelga de trip y occurrence. Guarda lo observado; no decide a quien le toca el dinero (Pieza 10, 8.14).';
--> statement-breakpoint
COMMENT ON COLUMN ticket_operations.circuito_asignado_id IS
  'El circuito que el PLAN le asignaba a la unidad al momento del quemado (circuit_unit_assignments). NO es el circuito recorrido: ese se deriva del GPS y no vive aqui. Null es no consta.';
--> statement-breakpoint
COMMENT ON COLUMN ticket_operations.quemado_en IS
  'La hora del reloj del LECTOR, que sin red puede venir corrida. La hora que consta es recibido_en, la del servidor.';
