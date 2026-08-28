-- La escalera de cuatro estados de la app pública.
--
-- Se aplica DESPUÉS de la 0030. Tres cambios sobre `circuits`.
--
-- ⚠ NO es puramente aditiva: el tercer paso ESCRIBE en las dos filas
-- existentes, poniendo `declared_frequency_minutes` en NULL. Es un cambio de
-- datos deliberado y está argumentado abajo. La marcha atrás no puede
-- devolver esos valores porque no existían — ver el archivo `.reversa.sql`.
--
-- ## Qué resuelve
--
-- La app promete cadencia donde no hay servicio. La caída a «frecuencia
-- declarada» se diseñó para «hay servicio pero calló el GPS», y hoy se aplica
-- también a «no hay servicio operando» y a «está cerrado». Son tres silencios
-- distintos y la app los dice igual.
--
-- Con estas columnas el endpoint resuelve cuatro estados, parando en el
-- primero que aplique: FUERA DE HORARIO · EN VIVO · POR HORARIO · SIN
-- SERVICIO. Ninguno se guarda: el motor mide y reporta, no sella.
--
-- ══════════════════════════════════════════════════════════════════════
-- 1 · La frecuencia se vuelve OPCIONAL
-- ══════════════════════════════════════════════════════════════════════
--
-- Era `INTEGER NOT NULL DEFAULT 20`, así que todo circuito tenía frecuencia y
-- **nada registraba si alguien la escogió o si cayó del default**. «Declaró
-- 20» y «no declaró nada» eran indistinguibles en la base.
--
-- Eso importa porque la app afirma «cada 20 minutos» con la autoridad del
-- sistema detrás. Afirmar una cadencia que nadie declaró es exactamente la
-- falta de la sección E del Marco: completar un hueco porque la pantalla se ve
-- mejor completa.
--
-- El CHECK `> 0` se queda y sigue sirviendo: en Postgres una comparación con
-- NULL da UNKNOWN, y un CHECK sólo se viola con FALSE. Es decir, protege el
-- valor cuando lo hay y deja pasar la ausencia. No hace falta tocarlo.

ALTER TABLE circuits ALTER COLUMN declared_frequency_minutes DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE circuits ALTER COLUMN declared_frequency_minutes DROP NOT NULL;
--> statement-breakpoint
-- Los dos circuitos que existen quedan en NULL, y es la respuesta honesta:
-- ninguno de esos 20 tiene un humano detrás. El del corredor de laboratorio
-- nunca se declaró, y el de Oasis-Centro está anotado como pendiente de
-- confirmar con el concesionario. Si no se puede distinguir declarado de
-- heredado, no está declarado.
--
-- El WHERE no nombra circuitos: cualquier fila que hoy traiga exactamente el
-- default es indistinguible de no haber sido declarada, y por eso se limpia.
-- Una fila con otro valor sí la escribió alguien y no se toca.
UPDATE circuits SET declared_frequency_minutes = NULL WHERE declared_frequency_minutes = 20;
--> statement-breakpoint
COMMENT ON COLUMN circuits.declared_frequency_minutes IS
  'Cada cuantos minutos declara el concesionario que pasa una unidad. NULL = no declarada, y entonces la app dice que hay servicio SIN tiempo estimado. Nunca se inventa una cadencia.';
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════════
-- 2 · La ventana de confianza, con columna propia
-- ══════════════════════════════════════════════════════════════════════
--
-- Contesta UNA pregunta: cuánto tiempo después de la última vez que se vio una
-- unidad en el corredor se puede seguir afirmando que hay servicio.
--
-- No se deriva de la frecuencia, y fue una decisión con tres razones. Dos son
-- de construcción —la frecuencia ahora puede ser NULL, así que la fórmula se
-- quedaría sin insumo justo en el caso que la motiva; y con el default de 20
-- todo circuito heredaría 40 minutos que nadie eligió—. La tercera es de
-- fondo: **derivarla acopla dos perillas que significan cosas distintas.**
-- Quien afine la frecuencia porque al concesionario le cambió el horario
-- estaría moviendo sin saberlo cuánto tiempo la app sigue afirmando que hay
-- servicio.
--
-- 15 minutos de default es un punto de partida declarado, no una medición. Se
-- afina con lo que salga de la prueba de campo.
ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS service_confidence_minutes INTEGER NOT NULL DEFAULT 15;
--> statement-breakpoint
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_confianza_positiva;
--> statement-breakpoint
ALTER TABLE circuits
  ADD CONSTRAINT circuits_confianza_positiva CHECK (service_confidence_minutes > 0);
--> statement-breakpoint
COMMENT ON COLUMN circuits.service_confidence_minutes IS
  'Cuanto tiempo despues de ver una unidad DENTRO DEL CORREDOR se puede seguir afirmando que hay servicio. Pasado esto el circuito cae a SIN SERVICIO y la app deja de prometer cadencia. No se deriva de la frecuencia: son dos perillas con significados distintos.';
--> statement-breakpoint

-- ══════════════════════════════════════════════════════════════════════
-- 3 · El interruptor del rango de llegada
-- ══════════════════════════════════════════════════════════════════════
--
-- Hermana del interruptor de publicación, y por la misma razón marca de tiempo
-- y no booleano: «desde cuándo» sale gratis y encaja con el resto del modelo,
-- donde la vigencia se guarda en vez de deducirse.
--
-- NULL = apagado, y es el default a propósito. Un circuito recién dado de alta
-- no tiene su velocidad calibrada contra la calle: `avg_speed_kmh` arranca en
-- una mediana medida sobre OTRA flota. Con el rango apagado el estado EN VIVO
-- sigue enseñando el camión moviéndose en el mapa —que es verdad observada— y
-- se calla el minuto estimado, que todavía no lo es.
ALTER TABLE circuits ADD COLUMN IF NOT EXISTS arrival_range_enabled_at TIMESTAMPTZ;
--> statement-breakpoint
COMMENT ON COLUMN circuits.arrival_range_enabled_at IS
  'Desde cuando el circuito muestra el RANGO de llegada al pasajero. NULL = apagado: se ve el camion en el mapa pero no el minuto estimado. Se prende cuando la velocidad del circuito ya se calibro contra la calle.';
