-- ═══════════════════════════════════════════════════════════════════
-- Darle a Juárez Bus el mercado de Chihuahua
-- 16 de septiembre de 2026
--
-- Sin mercado, el expediente de cada unidad de Juárez Bus dice «documentos aún
-- no disponibles · la cuenta no tiene mercado»: no hay catálogo que aplicarle.
-- Con el mercado, sus unidades toman el catálogo de Chihuahua (7 papeles). Las
-- reglas siguen sin cargar —llegan con la pantalla del catálogo, el D2—, así
-- que después de esto el cuarto se ve como el escenario «Sin reglas» del
-- prototipo: cada papel dice «sin regla» y no se supone nada.
--
-- Mercado estatal, decidido por ASAV el 16 sep 2026: MX · Chihuahua, sin
-- municipio (la 0038).
--
-- ── Orden ───────────────────────────────────────────────────────────
--   PASO 1 · antes, de lectura (usuario de solo lectura).
--   PASO 2 · asignar (usuario dueño), dentro de BEGIN; tú escribes el COMMIT.
--   PASO 3 · después, de lectura.
--
-- Ensayada el 16 sep 2026 en la rama desechable, dentro de una transacción con
-- ROLLBACK: asignó 1, y una segunda corrida asignó 0 (la guarda de «todavía
-- sin mercado»).
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PASO 1 · ANTES. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT a.name, a.slug, a.type, a.market_id
  FROM accounts a
 WHERE a.type = 'carrier'
 ORDER BY a.name;

SELECT id, country_code, state_code, municipality, name, time_zone
  FROM markets;

-- LO QUE DEBES VER:
--   ASAV        asav        carrier  (null)
--   Juárez Bus  juarez-bus  carrier  (null)
--   un mercado: MX · CHH · (null) · Chihuahua · America/Ciudad_Juarez


-- ───────────────────────────────────────────────────────────────────
-- PASO 2 · ASIGNAR. Con el usuario dueño.
--
-- ⚠ NO PEGUES LA HOJA ENTERA. Corre el BEGIN y el UPDATE, mira el número, y
--   sólo entonces escribe tú el COMMIT o el ROLLBACK. Los dos van comentados.
--
-- Las guardas van en el WHERE: la cuenta es Juárez Bus, es carrier, todavía no
-- tiene mercado, y el mercado es el estatal de Chihuahua.
-- ───────────────────────────────────────────────────────────────────

BEGIN;

UPDATE accounts a
   SET market_id = m.id,
       updated_at = now()
  FROM markets m
 WHERE a.slug = 'juarez-bus'
   AND a.type = 'carrier'
   AND a.market_id IS NULL
   AND m.country_code = 'MX'
   AND m.state_code = 'CHH'
   AND m.municipality IS NULL
RETURNING a.name, m.name AS mercado;

-- LO QUE DEBES VER: una fila → Juárez Bus · Chihuahua  (UPDATE 1)
--
-- Si cuadra:
-- COMMIT;
-- Si no:
-- ROLLBACK;


-- ───────────────────────────────────────────────────────────────────
-- PASO 3 · DESPUÉS. Con el usuario de solo lectura.
-- ───────────────────────────────────────────────────────────────────

SELECT a.name, m.name AS mercado, m.time_zone,
       (SELECT count(*) FROM document_types t WHERE t.market_id = m.id AND t.subject = 'unidad') AS papeles_de_unidad
  FROM accounts a
  LEFT JOIN markets m ON m.id = a.market_id
 WHERE a.type = 'carrier'
 ORDER BY a.name;

-- LO QUE DEBES VER:
--   ASAV        (null)     (null)                 0
--   Juárez Bus  Chihuahua  America/Ciudad_Juarez  4


-- ═══════════════════════════════════════════════════════════════════
-- CAMINO DE REGRESO
--
-- Mientras nadie haya capturado papeles de Juárez Bus:
--
-- BEGIN;
-- UPDATE accounts SET market_id = NULL, updated_at = now()
--  WHERE slug = 'juarez-bus'
--    AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.carrier_account_id = accounts.id);
-- -- esperado: UPDATE 1
-- COMMIT;
--
-- Con papeles capturados no se quita: sus fojas son del catálogo de este mercado.
-- ═══════════════════════════════════════════════════════════════════
