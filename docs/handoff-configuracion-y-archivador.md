# Hand-off — Módulo de configuración + Archivador de telemetría

> Documento para continuar el trabajo en un chat nuevo con contexto completo.
> Fecha: 2026-07-08. Repo: `j-tel` (deploy: `https://j-tel-web.vercel.app`).

## Cómo usar este documento en el chat nuevo

Empieza el chat nuevo diciendo algo como:
"Lee `docs/handoff-configuracion-y-archivador.md` y sigamos con **[Tarea A / Tarea B]**."

---

## 1. Estado actual (qué ya funciona)

- **Desplegado en Vercel** (proyecto `j-tel-web`, prod). Base de datos **Neon Postgres** conectada (`DATABASE_URL`).
- **Monorepo** pnpm + Turborepo. Stack: Next.js 16 (App Router), TypeScript, Drizzle ORM, shadcn/Tailwind.
- **Integración GPS Umbrella funcionando de verdad.** Se probó de punta a punta con un IMEI real y produjo veredictos reales (un CUMPLIDO y un NO_CUMPLIDO). Ver cliente demo real en `/cliente?account=prueba-real`.
- **Credenciales GPS por carrier**, cifradas (AES-256-GCM con `JTEL_SECRET_KEY`). Pantalla: `/carrier/gps`. Juárez Bus ya tiene guardadas `A1339`.
- **Multi-cuenta por slug**: casi todas las pantallas resuelven la cuenta con `?account=<slug>` y `apps/web/src/lib/account-context.ts`.

### Variables de entorno relevantes (ya en Vercel y en `.env` local)
`DATABASE_URL`, `UMBRELLA_GPS_URL` (=`http://gps2.umbrellasoluciones.com/openapi`), `UMBRELLA_GPS_USERID`, `UMBRELLA_GPS_PASSWORD`, `CRON_SECRET`, `JTEL_SECRET_KEY`.

---

## 2. Modelo de datos (memoria propia = Neon)

Jerarquía (tablas en `packages/db/src/schema/index.ts`):

- `accounts` (type: carrier | client | jstaff) → `carrier_profiles` / `client_profiles`.
- Cliente corporativo: `plant_groups` → `plants` → `geofences` (role `destino`, polígono).
- Carrier/flota: `units` → `devices` (imei) → `device_assignments` (unidad↔GPS con vigencia).
- Operación: `routes`, `shifts`, `route_shifts` (con `deadline_time` y KML opcional en `route_shift_kml_versions`).
- Comercial: `service_contracts` (política JSON: tolerancia, gracia, strictness, excusables, enforcement, márgenes) → `service_profiles` (contrato + routeShift + geofence + unidades) → `service_occurrences` (día concreto) → `trips` (ventana de evidencia).
- Evidencia y verdad: `evidence_points` (puntos GPS copiados por viaje), `compliance_facts` (veredicto = fuente única de verdad), `ledger_entries` (bitácora de auditoría).

**Clave:** una vez ingerida la evidencia de un viaje, el veredicto vive en Neon para siempre; no se vuelve a consultar a Umbrella para ese viaje.

### Repos y métodos ya disponibles
`packages/db/src/repositories/index.ts` expone `createRepositories(db)` con:
`accounts, carriers, clients, geofences, fleet, routes, contracts, profiles, occurrences, compliance, evidence, memberships, inspections, notifications, demos`.
En web se usan vía `getRepos()` (`apps/web/src/lib/db.ts`).

---

## 3. Lo que se arregló recientemente (GPS)

Bugs corregidos en `packages/gps-umbrella/src/index.ts` (commit `aa1356c`):
1. `Limit` de historial: Umbrella rechaza >100 por página → se pagina de a **100**.
2. Ya **no** se descartan puntos con `gps_valid=false` (traen coordenadas reales de vehículo detenido / reporte por celda). Solo se descartan `(0,0)`.
3. Espaciado ~**1 req/seg** para respetar la cuota de Umbrella.

### Gotchas de la API Umbrella (importante)
- Todo viene envuelto en `{state, message, value}`.
- Login: `/openapi/api/Login?userid=&password=` → token en `value`.
- Historial: `/openapi/api/HistoryLocation?Token=&BeginGMT=&EndGMT=&StartIdx=&Limit=&Imeis=` — **Limit máx 100**, fechas ISO (`...Z`), cuota **1/seg**, campos `sn_imei_id`, `gps_info.{latitude,longitude,speed,l_datetime}`, fechas GMT tratadas como UTC.
- `Imeis` acepta lista separada por comas, pero el tope de 100 registros es por página (con muchos equipos hay que paginar más).

### Script de prueba real (referencia útil)
`packages/services/src/real-e2e.ts` → `pnpm --filter @jtel/services run real-e2e`.
Arma la cadena completa con un IMEI real y verifica. Es idempotente (limpia la corrida anterior del cliente `prueba-real`). Buen ejemplo de cómo crear toda la cadena por código.

---

## 4. TAREA A — Módulo de configuración (UI) [prioridad del usuario]

**Objetivo:** que se pueda operar de verdad **sin scripts ni seed**, capturando todo desde la UI, multi-cuenta. Hoy varias piezas solo existen como API JSON o métodos de repo usados por el seed.

### Qué YA existe (reutilizar)
- Crear cuentas (J-Staff): UI `/jstaff/cuentas` + `POST /api/jstaff/accounts`.
- Plantas y grupos (cliente): UI `/cliente/plantas` + `POST /api/cliente/plantas`.
- Flota (carrier): UI `/carrier/flota` + `/api/carrier/{units,devices,assign}`.
- Credenciales GPS (carrier): UI `/carrier/gps` + `/api/carrier/gps`.
- Contratos: **solo API JSON** `POST /api/contracts` (`createContractSchema`). Falta UI.
- Perfiles de servicio: **solo API JSON** `POST /api/profiles` (`createServiceProfileSchema`). Falta UI.

### Qué FALTA construir (huecos)
1. **Geocercas de destino por planta.** `/cliente/plantas` crea plantas pero **no** su geocerca. Repo: `repos.geofences.create({ownerType:"plant", ownerPlantId, role:"destino", name, polygon})`. UI sugerida: capturar centro (lat,lng) + radio y generar un polígono (box), o un mapa para dibujar. Sin geocerca no hay verificación.
2. **Rutas / turnos / route-shifts.** Repos: `repos.routes.createRoute`, `createShift(name, startTime)`, `createRouteShift({routeId, shiftId, deadlineTime, kmlContent?, waypoints?})`. UI para el catálogo del cliente + subir KML/waypoints (opcional, para `routeStrictness = kml_full`).
3. **Formulario de contrato (política).** UI amigable sobre `POST /api/contracts` para capturar: `toleranceMinutes`, `verificationGraceMinutes`, `routeStrictness` (destino_only | kml_full), `excusableReasons[]`, `enforcementRules[]` (no_pago_viaje | rebate_escalonado | reembolso), `evidenceMarginMinutesBefore/After`. Contrato liga cliente↔carrier + `plantId` **o** `plantGroupId`.
4. **Formulario de perfil de servicio.** UI sobre `POST /api/profiles`: contrato + routeShift + geofence + `possibleUnitIds[]` + `referenceUnitId` + `activeDays[]`.
5. **Generar ocurrencias.** Ya existe `repos.occurrences.generateForProfile(profileId, fromDate, toDate)` (crea ocurrencias + trips por día activo). **Falta** un endpoint `POST /api/profiles/[id]/generar` + botón "generar semana/mes".

### Convenciones a respetar
- Multi-cuenta con `?account=<slug>` y helper `withAccount` (`apps/web/src/lib/account-context.ts`).
- Server Actions o rutas API con `formData` y redirect `303` con `?created=`/`?error=` (patrón de `/api/cliente/plantas`).
- Validación con Zod (`@jtel/domain`).
- Sin hardcodes de cuentas demo.

### Orden sugerido de implementación
Geocerca por planta → rutas/turnos/route-shift → contrato → perfil → generar ocurrencias. (Así, al final, se puede armar un servicio real completo desde la UI y verificarlo.)

---

## 5. TAREA B — Archivador continuo de telemetría ("nuestra memoria")

**Objetivo (pedido del usuario):** desde ya, guardar **todo el historial de cada unidad** en nuestra base, de forma continua, para NO depender del histórico del proveedor. Hoy solo guardamos evidencia **por viaje** al verificar.

### Viabilidad: SÍ. Diseño propuesto

1. **Tabla nueva `telemetry_points`** (archivo crudo, independiente de trips):
   - `id`, `carrierAccountId`, `deviceId?`, `imei`, `latitude`, `longitude`, `speed?`, `recordedAt`, `source` (default `umbrella`), `createdAt`.
   - Índice único `(imei, recordedAt)` para **deduplicar**. Índice `(imei, recordedAt)` y `(carrierAccountId, recordedAt)` para consulta.
   - Migración con `drizzle-kit generate` + `pnpm --filter @jtel/db migrate` (aplicar a Neon).
2. **Watermark por equipo:** guardar el último `recordedAt` archivado por imei (tabla chica `telemetry_watermarks` o `MAX(recordedAt)` sobre `telemetry_points`). Así cada corrida solo pide lo nuevo.
3. **Cron `/api/cron/archive`** (proteger con `CRON_SECRET`, igual que `/api/cron/verify`):
   - Para cada carrier con credenciales GPS: construir su provider (reusar la lógica de `VerificationService`; conviene exponer un método público para obtener el provider por carrier, hoy es privado `getProviderForCarrier`).
   - Traer historial desde el watermark (o `now - N min` la primera vez) hasta `now` con `provider.getHistoryLocations({imeis, beginGmt, endGmt})`. Ya respeta Limit=100 + throttle.
   - Guardar puntos en `telemetry_points` con `onConflictDoNothing` (dedupe). Resolver `unitId`/`deviceId` con `repos.fleet.resolveUnitAtTime`.
   - Actualizar watermark.
   - Añadir el cron a `apps/web/vercel.json` (`crons`), p. ej. `*/10 * * * *`.
4. **Consideraciones de cuota/tiempo:** Umbrella 1 req/seg + 100 registros/página. Con ~80 equipos y ventanas cortas (cada 10 min) son pocos registros por corrida → factible dentro del timeout. Ojo con el **límite de crons del plan de Vercel** (confirmar que el plan permite la frecuencia; ya hay un cron cada minuto para verify).
5. **Sinergia (fase 2):** una vez que el archivo cubra las ventanas, el **verificador puede leer evidencia desde `telemetry_points`** (nuestra base) en vez de llamar a Umbrella en vivo, cayendo a Umbrella solo si falta un tramo. Esto reduce aún más la dependencia del proveedor y las llamadas.
6. **Futuro hardware propio:** cuando los trackers reporten directo a JTEL, el archivador se alimenta de esa ingesta en vez de Umbrella; el modelo de almacenamiento no cambia.

### Archivos a tocar (Tarea B)
- `packages/db/src/schema/index.ts` (+ relations) y migración en `packages/db/drizzle/`.
- `packages/db/src/repositories/index.ts` (nuevo `TelemetryRepository`: `savePoints`, `getWatermark`, `getForImei`).
- `packages/services/src/` (nuevo `ArchiverService` o método) + exponer provider por carrier.
- `apps/web/src/app/api/cron/archive/route.ts` (nuevo) y `apps/web/vercel.json`.

---

## 6. Comandos útiles

```bash
pnpm install
pnpm --filter "@jtel/services^..." build   # construir librerías (deps de services)
pnpm --filter @jtel/db run generate         # generar migración Drizzle
pnpm --filter @jtel/db run migrate          # aplicar migración a Neon
pnpm --filter @jtel/services run real-e2e   # prueba real de verificación (IMEI real)
pnpm --filter @jtel/db run seed             # (re)sembrar datos demo (¡borra todo!)
```

Deploy: push a `main` dispara Vercel. Estado con MCP Vercel (`list_deployments` / `get_deployment`, teamId `team_nRTwUwhtju8zcbMKPg89XTRr`, projectId `j-tel-web`).

---

## 7. Notas / decisiones del usuario
- No hardcodear demo como si fuera producto; todo debe ser escalable multi-cliente/multi-carrier.
- Cada carrier tendrá su propio proveedor GPS (no uniformes); a futuro hardware propio.
- Datos `PRUEBA REAL` en Neon son de prueba (etiquetados); se pueden borrar.
- El usuario no es desarrollador: explicar simple y evitar pasos manuales frágiles.
