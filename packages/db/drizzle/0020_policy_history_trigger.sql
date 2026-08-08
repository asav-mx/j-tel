-- C13 · La red del registro de política — ADITIVA, va antes del deploy del código.
--
-- Se aplica DESPUÉS de la 0019.
--
-- ## El hecho que la motiva, medido el 7 de agosto de 2026
--
-- `contract_policy_history` existe desde la migración 0015, tiene la forma
-- correcta, y `updatePolicy` escribe su fila dentro de la misma transacción que
-- el UPDATE desde el 31 de julio (990be4f). O sea: **el camino de la aplicación
-- lleva cerrado más de una semana.**
--
-- Y la tabla sigue en CERO filas.
--
-- No es que nadie haya editado. Es que la única edición real de una política en
-- ese periodo —el contrato del Campus, 2026-08-06 09:14— la hizo un guion con
-- `UPDATE` crudo, que no pasa por `updatePolicy`. La lección, dicha sin
-- adornos: **cerrar el camino bueno no cierra la puerta de atrás**, y el hueco
-- no se ve hasta que alguien va a leer la historia y no hay nada.
--
-- Un trigger de Postgres alcanza a todos: la aplicación, los guiones del repo y
-- la consola de Neon. Es la diferencia entre una regla que se pide y una que no
-- se puede saltar.
--
-- ## Por qué el trigger CEDE EL PASO cuando la aplicación ya registró
--
-- No son dos escritores compitiendo. `updatePolicy` compara la política
-- EFECTIVA —la que sale del esquema con sus defaults aplicados—, y el trigger
-- solo puede comparar bytes. La diferencia importa: un contrato anterior a una
-- perilla no trae esa llave en su jsonb, pero el motor ya la resolvía con el
-- default al leerla. Comparando en crudo, el primer guardado de un contrato
-- viejo registraría seis "cambios" que nadie hizo, y una historia que arranca
-- con cambios falsos no se vuelve a creer.
--
-- Así que el camino bueno sigue decidiendo con la comparación buena, y lo
-- declara con `jtel.registrado`. El trigger es lo que pasa cuando NADIE lo
-- declaró — que es exactamente el caso que dejó la tabla vacía.
--
-- Consecuencia deliberada: un camino de edición NUEVO que alguien escriba
-- mañana y olvide registrar cae en el trigger. Eso es el punto.
--
-- ## Quién firma
--
-- Igual que en la 0019: la aplicación y los guiones declaran su actor con
-- `set_config('jtel.actor_kind', …, true)`. Lo que no lo declare queda firmado
-- `sql_directo`. Que una escritura desde la consola solo pueda firmarse así es
-- una decisión tomada con su costo a la vista, no un límite descubierto
-- después: es menos malo que cero filas.
--
-- Se aplica en UNA transacción (no lleva CONCURRENTLY).

CREATE FUNCTION registrar_cambio_de_politica() RETURNS trigger AS $registrar$
BEGIN
  -- El camino bueno ya escribió su fila, con la comparación efectiva y la firma
  -- de quien editó. Escribir otra aquí la duplicaría.
  IF coalesce(current_setting('jtel.registrado', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.policy IS DISTINCT FROM OLD.policy THEN
    INSERT INTO contract_policy_history (
      contract_id, policy_before, policy_after, actor_kind, actor_id, note
    ) VALUES (
      OLD.id, OLD.policy, NEW.policy,
      coalesce(nullif(current_setting('jtel.actor_kind', true), ''), 'sql_directo'),
      nullif(current_setting('jtel.actor_id', true), ''),
      nullif(current_setting('jtel.note', true), '')
    );
  END IF;
  RETURN NEW;
END;
$registrar$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER contracts_registrar_politica
  BEFORE UPDATE ON "service_contracts"
  FOR EACH ROW
  EXECUTE FUNCTION registrar_cambio_de_politica();
