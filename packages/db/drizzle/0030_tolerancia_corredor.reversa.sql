-- Marcha atrás de la 0030.
--
-- Quitar la columna devuelve el comportamiento anterior: el endpoint vuelve a
-- publicar toda unidad asignada con dato fresco, esté donde esté. Es una
-- regresión conocida, no un efecto secundario — se acepta a cambio de dejar la
-- base como estaba.
--
-- El código que lee la columna deja de compilar, así que la marcha atrás va
-- acompañada de revertir el despliegue. En ese orden: primero el código, luego
-- la columna.

ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_corredor_positivo;
--> statement-breakpoint
ALTER TABLE circuits DROP COLUMN IF EXISTS corridor_tolerance_meters;
