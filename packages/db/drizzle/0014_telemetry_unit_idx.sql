-- Índice por unidad sobre telemetry_points.
--
-- Hoy toda lectura de telemetría entra por (carrier_account_id, recorded_at) y
-- el filtro por unidad se hace después, en memoria: para devolver los 744
-- puntos de una unidad en un día, la base lee los 58 464 del carrier y tira
-- 57 720 (medido en producción el 2026-07-31 con EXPLAIN ANALYZE).
--
-- ⚠️ CONCURRENTLY NO CORRE DENTRO DE UNA TRANSACCIÓN.
-- El migrador de Drizzle envuelve cada archivo en una transacción, así que
-- esta migración NO se aplica con `pnpm db:migrate`: se ejecuta la sentencia
-- suelta contra la base. Se hace así a propósito — telemetry_points recibe
-- telemetría en vivo y un CREATE INDEX normal la bloquearía para escritura
-- durante toda la construcción.
--
-- Aplicada a producción el 2026-07-31 (2 400 591 filas, 704 MB).

CREATE INDEX CONCURRENTLY IF NOT EXISTS "telemetry_points_carrier_unit_recorded_idx"
  ON "telemetry_points" ("carrier_account_id", "unit_id", "recorded_at");
