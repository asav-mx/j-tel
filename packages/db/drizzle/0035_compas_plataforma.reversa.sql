-- MARCHA ATRÁS de la 0035 · Compás como conexión de plataforma.
--
-- Sólo regresa el valor por omisión. Las cuentas que ya se crearon con
-- `compas` se quedan así: regresarlas a `umbrella` las dejaría leyendo de un
-- proveedor muerto, que es lo que la 0035 vino a quitar. Si de verdad hay que
-- hacerlo, es a mano y cuenta por cuenta.
--
-- Los cuatro valores del enum `ingest_alert_kind` NO se quitan: Postgres no
-- permite eliminar valores de un enum, y dejarlos no molesta a nadie. Si se
-- revierte el código, las filas con esos tipos quedan como historial.

ALTER TABLE carrier_profiles ALTER COLUMN gps_provider SET DEFAULT 'umbrella';
