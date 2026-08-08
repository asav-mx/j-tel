-- Historia del turno — ADITIVA, va antes del deploy del código.
--
-- C21, opción 4 de la decisión del 7 de agosto de 2026. `shifts` no tenía
-- `updated_at`, así que cuando el Turno B de Planta 47 se movió no se pudo
-- FECHAR el cambio: solo acotarlo entre dos corridas del cron. Con historia, la
-- divergencia entre una ocurrencia y su turno pasa de inferible a legible.
--
-- Esto no arregla C21 por sí solo, y por eso entra igual: es lo único de las
-- cuatro opciones que sirve aunque no se haga ninguna otra.
--
-- Una fila por EDICIÓN, con las dos fotos, igual que `contract_policy_history`
-- (migración 0015). Guardar el "después" además del "antes" es redundante a
-- propósito: hace cada fila verdadera por sí sola y permite detectar un hueco
-- en la cadena —si el `after` de una fila no coincide con el `before` de la
-- siguiente, alguien escribió sin registrar— en vez de dibujar una historia
-- falsa.
--
-- ## Por qué un TRIGGER y no solo código de la aplicación
--
-- Ésta es la lección que costó C13. Ahí el registro se escribe dentro de
-- `updatePolicy`, en la misma transacción, desde el 31 de julio — y al 7 de
-- agosto `contract_policy_history` sigue en CERO filas, porque la única edición
-- real de una política en ese periodo la hizo un guion con `UPDATE` crudo, que
-- no pasa por ese camino. El camino bueno estaba cerrado y la puerta de atrás
-- abierta.
--
-- Un trigger de Postgres atrapa a cualquiera que escriba: la aplicación, un
-- guion, y la consola de Neon. Es la diferencia entre una regla que se pide y
-- una que no se puede saltar.
--
-- El costo, dicho como decisión y no como límite descubierto después: una
-- escritura cruda no puede firmar quién fue, y queda como `sql_directo`. Eso es
-- menos malo que cero filas.
--
-- ## Quién firma
--
-- La aplicación declara al actor con `set_config('jtel.actor_kind', ..., true)`
-- dentro de su transacción; el trigger lo lee. Quien no lo declare —o sea,
-- cualquier escritura que no pase por el código— queda firmada `sql_directo`.
-- Hasta que exista auth-rbac, `actor_id` viaja vacío incluso desde la
-- aplicación: el sistema sabe que fue una persona pero no cuál, y la firma
-- honesta es el rol.
--
-- ## Sin backfill, a propósito
--
-- `updated_at` entra NULLABLE y sin default. Rellenarla con `now()` afirmaría
-- que los tres turnos que existen se editaron el día de la migración, y eso es
-- falso. NULL dice lo que de verdad se sabe: no hay registro de edición. Es el
-- mismo criterio de la 0015 — una historia que arranca con datos inventados no
-- se vuelve a creer.
--
-- Se aplica en UNA transacción (no lleva CONCURRENTLY).

ALTER TABLE "shifts" ADD COLUMN "updated_at" timestamptz;
--> statement-breakpoint
CREATE TABLE "shift_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shift_id" uuid NOT NULL REFERENCES "shifts"("id") ON DELETE cascade,
  "name_before" text NOT NULL,
  "name_after" text NOT NULL,
  "start_time_before" time NOT NULL,
  "start_time_after" time NOT NULL,
  -- Quién editó. `sql_directo` cuando la escritura no declaró actor: es la
  -- firma honesta de una edición por fuera del código.
  "actor_kind" text NOT NULL,
  "actor_id" text,
  -- Por qué. Opcional: no bloquea guardar, pero cuando está vale más que el qué.
  "note" text,
  "changed_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX sh_shift_idx ON "shift_history" ("shift_id", "changed_at" DESC);
--> statement-breakpoint
CREATE FUNCTION registrar_cambio_de_turno() RETURNS trigger AS $registrar$
BEGIN
  -- Una edición que no cambió nada no genera fila: el formulario manda nombre y
  -- hora en cada guardado, así que abrir y guardar sin tocar nada es común.
  -- Registrarlo escondería las ediciones que sí cambiaron algo entre entradas
  -- vacías. Es el mismo criterio que `updatePolicy`.
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.start_time IS DISTINCT FROM OLD.start_time THEN
    INSERT INTO shift_history (
      shift_id, name_before, name_after,
      start_time_before, start_time_after,
      actor_kind, actor_id, note
    ) VALUES (
      OLD.id, OLD.name, NEW.name,
      OLD.start_time, NEW.start_time,
      coalesce(nullif(current_setting('jtel.actor_kind', true), ''), 'sql_directo'),
      nullif(current_setting('jtel.actor_id', true), ''),
      nullif(current_setting('jtel.note', true), '')
    );
    -- La fecha del cambio la pone el trigger, no quien escribe: si dependiera
    -- de que el UPDATE la incluyera, volvería a depender de que alguien se
    -- acuerde, que es exactamente lo que esto viene a quitar.
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$registrar$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER shifts_registrar_cambio
  BEFORE UPDATE ON "shifts"
  FOR EACH ROW
  EXECUTE FUNCTION registrar_cambio_de_turno();
