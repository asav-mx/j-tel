-- Tolerancia del corredor — ADITIVA, una sola columna.
--
-- Se aplica DESPUÉS de la 0029. No toca ninguna fila existente.
--
-- ## Qué resuelve
--
-- El endpoint público publica la posición de toda unidad ASIGNADA al circuito
-- que traiga dato fresco — esté donde esté. Una unidad asignada que va al
-- taller, al patio o a otra ruta sale dibujada en el mapa del pasajero como si
-- viniera en camino.
--
-- Medido el 27 de agosto de 2026 contra el circuito `corredor-prueba`: el
-- endpoint devolvió **4 unidades y las 4 con `sentido: null`**, es decir las
-- cuatro fuera del corredor. Cuatro camiones regados por Juárez presentados
-- como si vinieran en la ruta.
--
-- Es la misma ley que el dato viejo: si el sistema no puede afirmar que la
-- unidad va en la ruta, no la dibuja. Y como el dato viejo, cae al modo «Por
-- horario», que ya cubre las tres causas con un solo modo.
--
-- ## Por qué una columna nueva y NO `stop_snap_tolerance_meters`
--
-- Reusar la que ya existe era la salida obvia y es la equivocada: mide otra
-- cosa. Su propio comentario lo dice — «a partir de cuántos metros del trazado
-- el pegado de una PARADA deja de ser obvio y la pantalla avisa» — y su default
-- de 25 m se escogió como «el ancho de una avenida con camellón», para que una
-- persona coloque una parada a mano sobre un mapa quieto.
--
-- Un camión en movimiento es otro problema: trae error de GPS, va por el carril
-- de la orilla de una avenida ancha, y el trazado que lo juzga tiene sus propios
-- huecos entre vértices. Con 25 m, Oasis-Centro publicaría casi nada y la app se
-- quedaría en «Por horario» para siempre — que es mentir por el otro lado.
--
-- Meter dos conceptos en una columna es cómo se pierde uno de los dos, y esa
-- lección ya está escrita en el encabezado de la 0028 sobre `active`.
--
-- ## De dónde sale el 150, y de dónde NO
--
-- Es el valor que el dominio ya venía usando y razonando:
-- `CORREDOR_METROS_POR_DEFECTO` en packages/domain/src/publico.ts, con su
-- argumento —a media cuadra de una avenida ancha un camión sigue estando sobre
-- su recorrido— y con su nota de que el día que un corredor pida otra cosa «se
-- vuelve columna del circuito como los demás umbrales». Esta migración es ese
-- día. El número no cambia: cambia de dónde se lee.
--
-- ⚠ **Lo que NO está medido, dicho antes que el número.** No hay medición del
-- umbral correcto para un KML declarado, y no la hay por una razón concreta:
-- **ninguna unidad recorre Oasis-Centro**, así que no existe el dato con el que
-- se mediría. Lo que sí se midió (27 de agosto, corredor-prueba, 545 puntos de
-- la única unidad que NO aportó a construir ese trazado) dice que entre 25 y
-- 250 m sólo cambia de 79.1% a 86.8% de puntos conservados — pero ese trazado
-- se ajustó a esas mismas trazas, así que **no generaliza a un KML declarado** y
-- no se presenta como si lo hiciera. El 150 sigue siendo un argumento, no una
-- medición, y se calibra en la calle con la prueba de campo.

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS corridor_tolerance_meters DOUBLE PRECISION NOT NULL DEFAULT 150;
--> statement-breakpoint
ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_corredor_positivo;
--> statement-breakpoint
ALTER TABLE circuits
  ADD CONSTRAINT circuits_corredor_positivo CHECK (corridor_tolerance_meters > 0);
--> statement-breakpoint
COMMENT ON COLUMN circuits.corridor_tolerance_meters IS
  'A cuántos metros del trazado deja de poderse afirmar que una unidad va en la ruta. Mas alla de esto NO se publica al pasajero: es la misma ley que el dato viejo. No confundir con stop_snap_tolerance_meters, que es para colocar una parada a mano y por eso es mucho mas estrecha.';
