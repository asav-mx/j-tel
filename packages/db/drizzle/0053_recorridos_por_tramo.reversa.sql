-- Reversa de la 0053. Se pierde el resumen; el cron lo vuelve a calcular de los
-- pasos en su siguiente corrida, así que no se pierde nada que no se pueda
-- recalcular. El planeador se queda sin totales mientras tanto.
DROP TABLE IF EXISTS circuit_leg_times;
