-- Marcha atrás de la 0032.
--
-- Ésta sí deshace del todo lo que hizo la ida: la 0032 es puramente aditiva y
-- no escribió en ninguna fila existente, así que quitar la columna devuelve la
-- tabla al estado exacto anterior.
--
-- ⚠ LO QUE SÍ SE PIERDE: las fechas de arranque que se hayan capturado desde
-- que se aplicó. No son un default que se pueda reconstruir — las declaró un
-- concesionario. Antes de correr esto, léelas y anótalas:
--
--   SELECT public_slug, service_launch_date FROM circuits
--    WHERE service_launch_date IS NOT NULL ORDER BY public_slug;
--
-- El código que lee la columna deja de compilar: primero se revierte el
-- despliegue, después la base. Con el código nuevo desplegado y la columna
-- fuera, el endpoint del pasajero revienta para todos los circuitos, no sólo
-- para los que tengan fecha.

ALTER TABLE circuits DROP COLUMN IF EXISTS service_launch_date;
