-- Marcha atrás de la 0031.
--
-- ⚠ LO QUE ESTA MARCHA ATRÁS NO PUEDE DESHACER, dicho antes que los pasos:
-- el `UPDATE` que puso las frecuencias en NULL. Esos 20 no se pueden devolver
-- porque no eran un dato — eran el default de la columna, y restituirlos
-- inventaría una declaración que nadie hizo. Volver a poner `DEFAULT 20` y
-- `NOT NULL` sobre filas en NULL fallaría, así que la reversa deja la columna
-- nullable y sin default.
--
-- Es decir: la reversa devuelve el ESQUEMA a algo que el código viejo tolera,
-- no devuelve el estado exacto anterior. Si hace falta una frecuencia, se
-- declara desde la pantalla, que es de donde debió salir siempre.
--
-- El código que lee las columnas nuevas deja de compilar: primero se revierte
-- el despliegue, después la base.

ALTER TABLE circuits DROP COLUMN IF EXISTS arrival_range_enabled_at;
--> statement-breakpoint
ALTER TABLE circuits DROP CONSTRAINT IF EXISTS circuits_confianza_positiva;
--> statement-breakpoint
ALTER TABLE circuits DROP COLUMN IF EXISTS service_confidence_minutes;
