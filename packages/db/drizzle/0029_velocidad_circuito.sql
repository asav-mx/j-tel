-- Velocidad efectiva y color del circuito — ADITIVA, dos columnas.
--
-- Se aplica DESPUÉS de la 0028.
--
-- ## Qué resuelve
--
-- El rango de llegada de la app del pasajero necesita una velocidad, y en el
-- modelo no existía ninguna. La del contrato —`routeAvgSpeedKmh`— es de la
-- modalidad especial: otro producto, otro público, y afinar una movería la otra
-- sin que nadie se enterara. Misma razón por la que el umbral de dato viejo no
-- reutiliza `SIN_SENAL_MINUTOS`.
--
-- ## Es velocidad EFECTIVA, no instantánea
--
-- Desplazamiento entre tiempo, **con las paradas y los semáforos adentro**. Es
-- lo que responde «en cuánto llega», que es la única pregunta que el pasajero
-- hace. La velocidad instantánea de un camión detenido es 0 y la de uno en
-- avenida es 50: ninguna de las dos contesta nada.
--
-- ## De dónde sale el 20.5, y de dónde NO
--
-- Medido el 27 de agosto de 2026 contra `telemetry_points`: **9 118 ventanas de
-- diez minutos sobre 35 aparatos**, catorce días, solo en horario de servicio y
-- solo ventanas donde la unidad avanzó más de 500 m. Mediana **20.5 km/h**,
-- p25 13.3, p75 29.7.
--
-- ⚠ **Su alcance, declarado, porque el número miente sin él:** se midió sobre la
-- flota que SÍ reporta, **no sobre el circuito 1**, cuyas unidades asignadas
-- llevan sin reportar desde el 9 de julio. Son camiones urbanos de la misma
-- ciudad y el mismo proveedor de GPS, así que sirve para arrancar — y por eso es
-- CAMPO y no constante: se calibra en la calle.
--
-- ⚠ **La primera medición dio 0.0 km/h de mediana**, con 74.7% de los pares bajo
-- 1 km/h. Era correcta como consulta y falsa como afirmación: medía la flota
-- entera, con las unidades paradas en el patio adentro. Si alguien vuelve a
-- medir esto, que acote el universo a las unidades que corren, o le va a volver
-- a pasar.
--
-- ## El ancho del rango NO vive aquí
--
-- El rango es esta velocidad ± `arrival_range_floor_seconds`, y nada más. La
-- varianza de tráfico que se sumaría encima **no está medida** y no se inventa:
-- sale de la prueba de campo de los días 11-13.

ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS avg_speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 20.5;
--> statement-breakpoint
-- ## El color, y por qué es columna y no una constante
--
-- El color identifica la ruta en el mapa y en la app: cuando entren más
-- circuitos, cada uno con el suyo, y el pasajero los distingue por eso antes
-- que por el nombre. Un color dentro del código convertiría el alta de un
-- concesionario nuevo en un despliegue — la misma regla que la frecuencia y el
-- horario.
--
-- Hexadecimal de siete caracteres, comprobado por la base: un valor inválido
-- aquí no revienta nada, pinta una ruta invisible, que es peor.
ALTER TABLE circuits
  ADD COLUMN IF NOT EXISTS color_hex TEXT NOT NULL DEFAULT '#7C5CE0';
--> statement-breakpoint
ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_velocidad_positiva;
--> statement-breakpoint
ALTER TABLE circuits
  ADD CONSTRAINT circuits_velocidad_positiva CHECK (avg_speed_kmh > 0);
--> statement-breakpoint
ALTER TABLE circuits
  DROP CONSTRAINT IF EXISTS circuits_color_valido;
--> statement-breakpoint
ALTER TABLE circuits
  ADD CONSTRAINT circuits_color_valido CHECK (color_hex ~* '^#[0-9a-f]{6}$');
--> statement-breakpoint
COMMENT ON COLUMN circuits.avg_speed_kmh IS
  'Velocidad EFECTIVA de avance declarada del circuito, en km/h: desplazamiento entre tiempo, con paradas y semáforos dentro. Es el punto de partida del rango de llegada; el teléfono la corrige con lo que mide. Default 20.5 = mediana medida sobre la flota que reporta (9 118 ventanas, 35 aparatos, 14 días), NO sobre este circuito. Se calibra en la calle.';
--> statement-breakpoint
COMMENT ON COLUMN circuits.color_hex IS
  'El color con que se identifica la ruta en el mapa y en la app del pasajero. Por circuito, no en el codigo: con mas rutas cada una lleva el suyo.';
