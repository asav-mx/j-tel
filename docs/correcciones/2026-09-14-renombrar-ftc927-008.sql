-- ═══════════════════════════════════════════════════════════════════
-- Renombrar el FTC927 de prueba de Juárez Bus a TK-FTC927-008
-- 14 de septiembre de 2026
--
-- La flota no tiene cómo renombrar un aparato (la API sólo crea). Este es el
-- último pendiente del alta de los ocho FTC927; el #403 ya lo soltó de
-- PRUEBA-ESCRITORIO.
--
-- Nomenclatura: marca + modelo + consecutivo GLOBAL de la plataforma. El
-- consecutivo no se reinicia por cliente ni se reutiliza. Del 001 al 007 ya
-- están tomados; a éste le toca el 008 porque se dio de alta primero pero se
-- nombró al final. No se renumera nada.
--
-- Las guardas van DENTRO del WHERE: mismo id, mismo IMEI, misma cuenta y
-- todavía con el nombre viejo, y que nadie más se llame TK-FTC927-008.
-- Revisa los tres números ANTES de hacer COMMIT.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

WITH renombrado AS (
  UPDATE devices d
     SET label = 'TK-FTC927-008'
    FROM accounts a
   WHERE d.id = 'cbd1a6cc-9431-4966-89a5-e019401ecbc3'
     AND d.imei = '860693082402380'
     AND d.label = 'FTC927 (Prueba)'
     AND a.id = d.carrier_account_id AND a.name = 'Juárez Bus'
     AND NOT EXISTS (SELECT 1 FROM devices otro WHERE otro.label = 'TK-FTC927-008')
  RETURNING d.id
)
SELECT (SELECT count(*) FROM renombrado) AS renombrados;
-- esperado: renombrados = 1

SELECT
  (SELECT count(*) FROM devices WHERE label = 'FTC927 (Prueba)') AS con_el_nombre_viejo,
  (SELECT count(*) FROM devices WHERE label = 'TK-FTC927-008')   AS con_el_008;
-- esperado: con_el_nombre_viejo = 0, con_el_008 = 1

-- Si los tres números cuadran (1, 0, 1):
COMMIT;
-- Si no:
-- ROLLBACK;
