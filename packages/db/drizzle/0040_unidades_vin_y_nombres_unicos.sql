-- La unidad gana su VIN, y ningún nombre se repite dentro de una cuenta (C4-e).
-- ADITIVA.
--
-- Se aplica ANTES de desplegar el código que la lee: la API relacional de
-- Drizzle pide TODAS las columnas declaradas, y el código nuevo contra una base
-- sin `units.vin` revienta en cada pantalla que lee unidades (la lección de la
-- 0016). Al revés no pasa nada: el código de hoy ignora la columna.
--
-- Sin enums: todo corre en una sola transacción. El runbook está en
-- docs/correcciones/2026-09-18-aplicar-0040-unidades-vin-y-nombres-unicos.sql,
-- con la lectura de ANTES que decide si se puede aplicar.
--
-- ══════════════════════════════════════════════════════════════════════
-- 1. El VIN (decisión de Asav, 18 sep 2026)
-- ══════════════════════════════════════════════════════════════════════
--
-- Opcional: ninguna unidad de hoy lo tiene, y escribirles uno sería
-- inventarlo. Se guarda como lo normaliza el código —mayúsculas, sin espacios
-- ni guiones— para que «1hgcm8263 3a004352» y «1HGCM82633A004352» sean el
-- mismo. El formato (17 caracteres, sin I, O ni Q) lo exige el código.
--
-- **Único por cuenta, no en toda la plataforma.** Que el aviso no delate lo que
-- existe en otras cuentas pesa más que la simetría con el IMEI: el IMEI es
-- fierro de J-Tel en toda la plataforma; el camión es del transportista.
--
-- ══════════════════════════════════════════════════════════════════════
-- 2. Ningún nombre repetido en una cuenta
-- ══════════════════════════════════════════════════════════════════════
--
-- El 18 sep 2026 juarez-bus tenía dos «2101»: se dio de alta una unidad nueva
-- en lugar de usar la del camión, y el selector de asignar mostraba dos
-- renglones iguales. Se corrigió con `corregir-2101-duplicada.ts`; esto evita
-- la siguiente. El código lo revisa primero, para decirlo en palabras; la base
-- lo garantiza aunque alguien se salte el código (el alta vieja de
-- /carrier/flota/alta sigue viva hasta C4-d).
--
-- «El mismo nombre» es sin mayúsculas, sin espacios a los lados y con los de
-- en medio contados como uno: «2101», « 2101 » y «ab 1»/«AB  1» chocan. La
-- expresión es la misma que usa `nombreComparable` en @jtel/domain.
--
-- Dispositivos: sólo los que están en servicio. Los 77 de Umbrella de
-- juarez-bus se llaman todos «umbrella» y están de baja: su nombre es historia,
-- no compite. Si uno se reactivara con un nombre que ya usa otro en servicio,
-- el candado lo diría — que es justo lo que tiene que decir.
--
-- ⚠ LOS ÍNDICES ÚNICOS FALLAN SI YA HAY DUPLICADOS. El PASO 1 del runbook los
-- cuenta, y si no es cero se para.
--
-- Sin CONCURRENTLY: `units` y `devices` son chicas (cientos de filas) y sólo
-- las escriben humanos.

ALTER TABLE units ADD COLUMN IF NOT EXISTS vin text;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS units_nombre_unico_por_cuenta
  ON units (carrier_account_id, (regexp_replace(lower(btrim(label)), '\s+', ' ', 'g')));
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS units_vin_unico_por_cuenta
  ON units (carrier_account_id, vin) WHERE vin IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS devices_nombre_unico_en_servicio
  ON devices (carrier_account_id, (regexp_replace(lower(btrim(label)), '\s+', ' ', 'g')))
  WHERE label IS NOT NULL AND retired_at IS NULL;
--> statement-breakpoint

COMMENT ON COLUMN units.vin IS
  'Numero de identificacion vehicular (VIN), normalizado: mayusculas, sin espacios ni guiones, 17 caracteres. Opcional. Unico por cuenta, no en la plataforma (0040).';
