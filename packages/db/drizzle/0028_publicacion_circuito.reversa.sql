-- MARCHA ATRÁS de la 0028.
--
-- ⚠ Revertir esto NO deja el sistema como estaba: deja el endpoint público sin
-- su puerta. Si el código que lee `published_at` sigue desplegado, revienta; y
-- si se revierte también el código, **todos los circuitos quedan visibles**,
-- porque sin la columna no hay nada que filtrar.
--
-- O sea: esta reversa se corre junto con la del despliegue, no sola.
--
-- Anota antes qué estaba publicado, porque el dato no vuelve:
--
--   SELECT name, public_slug, published_at FROM circuits
--    WHERE published_at IS NOT NULL;

DROP INDEX IF EXISTS circuits_publicados_idx;
--> statement-breakpoint
ALTER TABLE circuits DROP COLUMN IF EXISTS published_at;
