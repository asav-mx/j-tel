-- La marca de lectura del archivador, por aparato. ADITIVA.
--
-- Se aplica DESPUÉS de la 0036 y **ANTES de desplegar el código** que la usa.
-- El archivador nuevo lee y escribe esta tabla en cada corrida: desplegado
-- contra una base sin ella, cada corrida del cron truena al leer las marcas y
-- no archiva nada. Al revés no pasa nada: el código de hoy no la conoce.
--
-- No toca ninguna fila existente ni siembra nada aquí. La siembra la hace el
-- archivador al empezar cada corrida: todo aparato sin marca queda anotado en
-- la marca de agua de su cuenta TAL COMO ESTÁ ANTES DE LEER A NADIE. Así el
-- primer despliegue no vuelve a leer la historia, y un aparato que falla en su
-- primera corrida no hereda la marca que los demás ya empujaron a «ahora».
--
-- ══════════════════════════════════════════════════════════════════════
-- Por qué existe
-- ══════════════════════════════════════════════════════════════════════
--
-- Hasta aquí el archivador llevaba UNA marca por cuenta y la avanzaba por
-- tandas de cinco aparatos, antes de leer las tandas que faltaban. Si un
-- aparato no contestaba, o Vercel cortaba la corrida a los 300 s, la marca ya
-- estaba en «ahora» y los aparatos sin leer perdían su ventana para siempre.
-- Medido el 15 de septiembre de 2026 en la desechable: con UN aparato mudo de
-- 100, 70 perdieron ~10 minutos. Y el relleno de huecos no lo ve, porque sólo
-- persigue huecos de más de 15 minutos. Esa pérdida es evidencia: la
-- verificación lee `telemetry_points`.
--
-- Esta marca dice «ya se le preguntó al proveedor por este aparato hasta esta
-- hora, y contestó». No es el último punto: un aparato estacionado que
-- contestó sin puntos también avanza. Y sólo avanza cuando de verdad se leyó.
--
-- ⚠ No es `telemetry_imei_watermarks`, a propósito: ésa la mueve el relleno de
-- huecos hasta el FINAL de cada hueco revisado, y el último hueco termina en
-- «ahora». Si el archivador leyera de ahí, el relleno le brincaría la ventana
-- y volvería la pérdida.

CREATE TABLE IF NOT EXISTS telemetry_archive_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  imei text NOT NULL,
  read_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS telemetry_archive_marks_carrier_imei_idx
  ON telemetry_archive_marks (carrier_account_id, imei);
--> statement-breakpoint

COMMENT ON TABLE telemetry_archive_marks IS
  'Hasta que hora ya se le pregunto al proveedor GPS por cada aparato, y contesto. La escribe solo el archivador, y solo avanza (0037).';
--> statement-breakpoint
COMMENT ON COLUMN telemetry_archive_marks.read_until IS
  'Fin de la ultima ventana leida con exito para este aparato. No es su ultimo punto: una ventana leida sin puntos tambien cuenta (0037).';
