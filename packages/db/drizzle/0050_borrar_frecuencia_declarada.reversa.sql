-- Reversa de la 0050: la columna vuelve, VACÍA. Lo que tenía no se recupera
-- (el 21 sep 2026 era NULL en los dos circuitos de producción).
ALTER TABLE circuits ADD COLUMN IF NOT EXISTS declared_frequency_minutes integer;
ALTER TABLE circuits ADD CONSTRAINT circuits_frecuencia_positiva CHECK (declared_frequency_minutes > 0);
COMMENT ON COLUMN circuits.declared_frequency_minutes IS
  'Cada cuantos minutos declara el concesionario que pasa una unidad. NULL = no declarada, y entonces la app dice que hay servicio SIN tiempo estimado. Nunca se inventa una cadencia.';
