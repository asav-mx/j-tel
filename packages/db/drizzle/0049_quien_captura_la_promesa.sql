-- Quién capturó cada versión de la promesa por franja — ADITIVA.
--
-- Se aplica DESPUÉS de la 0048 y **ANTES de desplegar el código** que la lee:
-- la API relacional de Drizzle pide todas las columnas declaradas, y el código
-- nuevo contra una base sin ella revienta al leer la promesa (la lección de la
-- 0016). Al revés no pasa nada.
--
-- ## Por qué una sola columna
--
-- Una versión de la promesa sólo se cierra cuando alguien guarda la siguiente
-- (`savePromiseTable`: cierra y abre en la misma transacción). Quien la cerró
-- es, siempre, quien capturó la que vino después — una columna `cerrada_por`
-- diría lo mismo dos veces, y dos lugares para el mismo dato se separan.
--
-- ## Por qué ahora
--
-- Las franjas son la única fuente de la promesa (decisión de Asav, 21 sep
-- 2026): Ontoy la dice en voz alta y la torre mide contra ella. Una promesa que
-- cambió sin autor es un «cada 10» que nadie sabe quién escribió. El motivo del
-- cierre ya existía; faltaba el quién. Aprobado por Asav el 21 sep.
--
-- Nula en todo lo de antes: escribirle un autor ahora sería inventarlo. Null
-- dice la verdad: «no quedó registrado».

ALTER TABLE circuit_promise_tables ADD COLUMN IF NOT EXISTS capturada_por text;
--> statement-breakpoint
COMMENT ON COLUMN circuit_promise_tables.capturada_por IS
  'Id de usuario que capturo esta version de la promesa. Quien la cerro es quien capturo la siguiente. Nulo en lo anterior a la 0049.';
