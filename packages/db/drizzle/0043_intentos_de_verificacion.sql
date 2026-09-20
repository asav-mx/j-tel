-- El conteo de intentos de verificación — ADITIVA, tres columnas y un relleno.
--
-- Se aplica DESPUÉS de la 0042.
--
-- ## Qué resuelve
--
-- El motor escribía una entrada de ledger por cada intento, aunque el intento
-- no cambiara nada. Medido el 19 de septiembre de 2026 en producción:
-- **4 163 318 entradas de `verificacion_automatica` sobre 1 008 servicios**,
-- hasta 17 637 sobre uno solo — una por minuto durante doce días, todas
-- diciendo exactamente lo mismo: «sigue sin evidencia».
--
-- Eso no es expediente: es ruido que sepulta lo que sí pasó. Diagnóstico
-- completo en `docs/Diagnostico-Reverificacion-Infinita-2026-09-19.md`.
--
-- ## Por qué el contador NO es una entrada del ledger
--
-- Fue la primera idea y está mal. `ledger_entries` **no tiene `factId`** —deuda
-- conocida, anotada en `docs/DESPUES.md`— así que `ledger-pairing.ts` empareja
-- la entrada con el hecho vigente **por fecha**, con diez minutos de
-- tolerancia, y ante la duda no empareja. Una entrada que se reescribe para
-- incrementar un contador deja de representar «la corrida que produjo este
-- hecho», y el acta empezaría a no emparejar — o, peor, a emparejar mal.
--
-- Y rompe el principio de la casa: los cambios son eventos, no reemplazos.
-- Reescribir un renglón cada minuto, justo en la tabla que existe para ser la
-- historia, es exactamente lo contrario.
--
-- El estado vive donde vive el estado: en el viaje. **Nunca fue historia**, así
-- que actualizarlo no reescribe nada. El ledger recibe UNA entrada cuando la
-- espera se cierra (`sin_evidencia_posible`), que ya existe.
--
-- ## El relleno NO BORRA NADA
--
-- Los 4.16 millones de entradas se quedan donde están: son hechos, y son la
-- evidencia del diagnóstico. Lo que hace el relleno es **leerlas** para que la
-- verdad que contienen —cuántas veces se intentó, desde cuándo y hasta
-- cuándo— siga estando después de que el motor deje de escribirlas.
--
-- ⚠ El UPDATE recorre `ledger_entries` entera. Tarda segundos, no minutos, y
-- no bloquea lectura. Se corre una sola vez.

ALTER TABLE trips ADD COLUMN IF NOT EXISTS intentos_de_verificacion INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE trips ADD COLUMN IF NOT EXISTS primer_intento_at TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ultimo_intento_at TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_intentos_no_negativos;
--> statement-breakpoint
ALTER TABLE trips ADD CONSTRAINT trips_intentos_no_negativos CHECK (intentos_de_verificacion >= 0);
--> statement-breakpoint
-- El relleno: la verdad que vivía en los 4.16 millones de renglones, ahora
-- también como estado. Se cuentan las dos acciones que sellan —la de
-- eliminación escribe la misma carga— para no perder los intentos de esos.
UPDATE trips t
   SET intentos_de_verificacion = x.intentos,
       primer_intento_at        = x.primero,
       ultimo_intento_at        = x.ultimo
  FROM (
    SELECT trip_id,
           count(*)        AS intentos,
           min(created_at) AS primero,
           max(created_at) AS ultimo
      FROM ledger_entries
     WHERE action IN ('verificacion_automatica', 'eliminacion_candidatas')
     GROUP BY trip_id
  ) x
 WHERE t.id = x.trip_id;
--> statement-breakpoint
COMMENT ON COLUMN trips.intentos_de_verificacion IS
  'Cuantas veces el motor intento verificar este viaje. Es ESTADO, no historia: por eso vive aqui y no como entradas del ledger, que se emparejan por fecha con el hecho vigente y no se pueden reescribir. Su valor inicial salio de contar las entradas de verificacion_automatica y eliminacion_candidatas que ya existian.';
--> statement-breakpoint
COMMENT ON COLUMN trips.primer_intento_at IS
  'Cuando se intento por primera vez. Junto con ultimo_intento_at conserva «se intento N veces, de tal fecha a tal fecha» sin un renglon por intento.';
--> statement-breakpoint
COMMENT ON COLUMN trips.ultimo_intento_at IS
  'Cuando se intento por ultima vez.';
