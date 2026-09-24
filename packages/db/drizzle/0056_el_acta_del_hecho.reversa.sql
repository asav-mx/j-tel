-- Reversa de la 0056 · quita el acta
--
-- ⚠ **Esto SÍ borra.** La columna guarda lo único congelado que tiene un hecho
-- de su acta, y lo que se pierde **no se puede volver a calcular**: la ventana,
-- los nombres y las placas de entonces ya no existen en ninguna otra parte, y
-- la huella de la evidencia menos.
--
-- No se revierte «por si acaso». Sólo si la columna estuviera impidiendo una
-- operación legítima — y entonces lo que hay que arreglar es esa operación.

ALTER TABLE compliance_facts
  DROP COLUMN IF EXISTS acta_snapshot;
