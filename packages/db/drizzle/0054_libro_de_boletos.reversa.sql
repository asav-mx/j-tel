-- Reversa de la 0054.
--
-- ⚠ **Esto sí borra el libro.** No es como las otras reversas de tablas
-- nuevas, donde lo que se pierde se vuelve a calcular: los quemados que
-- entregaron los lectores **no están en ningún otro lado**, y el aparato ya
-- borró su jornada al sincronizar. Correr esto es perder viajes.
--
-- Se deja escrita porque una migración sin marcha atrás es una puerta de una
-- sola dirección, y porque mientras el libro esté vacío —hasta la primera
-- prueba física— deshacerla no cuesta nada. Después, cuesta todo: el PASO 0
-- del runbook cuenta las filas para que quien la corra lo sepa antes.
--
-- El orden importa: los triggers protegen las tablas contra DELETE, no contra
-- DROP TABLE, así que no hay que quitarlos antes — se van con la tabla. La
-- función sí queda suelta y se borra al final.
DROP TABLE IF EXISTS ticket_operations;
DROP TABLE IF EXISTS validator_syncs;
DROP TABLE IF EXISTS validator_assignments;
DROP TABLE IF EXISTS validators;
DROP SEQUENCE IF EXISTS validators_consecutivo_seq;
DROP FUNCTION IF EXISTS rechazar_cambio_en_el_libro();
