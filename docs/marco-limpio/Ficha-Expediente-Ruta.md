# Ficha — Expediente de la ruta

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Cara:** cliente (planta y campus). **Ola:** el grueso hoy; el bloque de métricas espera la compuerta de Ola 2.

---

## 1. Qué es

La ruta es **la segunda de las cinco identidades con expediente propio**. Responde: *¿qué se acordó recorrer, y cómo se ha comportado en el tiempo?*

**Misma forma que los otros expedientes:** migas · cabecera de identidad · navegación entre hermanos · pestañas · historial.

---

## 2. Estructura

### 2.1 Cabecera
Migas (`Rutas y turnos › Riberas 9`) · nombre de la ruta como titular · línea de contexto con contrato y carrier · **navegación entre hermanos** (`‹ anterior · siguiente ›` con el conteo total) · pestañas: Resumen · Historial · Configuración.

### 2.2 Qué es esta ruta — identidad
Turnos que cubre con sus deadlines · destino y su geocerca · tolerancia vigente · recorrido contratado en km · duración esperada · servicios sellados en el periodo.

Con la nota: *"la configuración vigente · cambiarla no reescribe hechos pasados"*.

### 2.3 El trazado contratado
Mapa con el trazado y su corredor a escala. Fondo oscuro en ambos temas (excepción del skill: el lienzo es evidencia).

Capas con su audiencia declarada. Al pie: *"el trazado es política del contrato, no propiedad del producto"*.

### 2.4 Métricas — **BLOQUE RESERVADO, ver §4**
Cumplimiento del periodo · margen mediano y su tendencia · cobertura · duración mediana contra la esperada. Todo en acero con sparklines.

### 2.5 El periodo día por día
Cuadritos clicables, uno por día, con el color del resultado de ese día. Pica un día y abre su servicio.

### 2.6 Últimos servicios
Tabla densa: fecha · turno · llegada · motivo medido · resultado. Cada renglón abre el expediente del servicio.

---

## 3. Contexto de navegación

**Regla 3.b del skill.** El expediente recibe de dónde vienen y qué lista recorrían:
- Las migas reflejan el origen real, no siempre `Rutas y turnos`
- El regreso devuelve a donde estaba el usuario, con sus filtros
- `‹ anterior · siguiente ›` recorre la lista de origen

---

## 4. EL CORTE — qué va hoy y qué espera

**Va hoy (§2.1, 2.2, 2.3, 2.5, 2.6):** identidad, trazado, tira de días e historial. Son configuración del contrato y hechos ya sellados.

**Espera la compuerta de Ola 2 (§2.4):** el bloque de métricas. Los datos existen en `complianceFacts`, pero **mostrar 87.5% de cumplimiento antes de que el árbitro acierte de forma sostenida es publicar un número que no aguanta una discusión.**

**Cómo se muestra mientras tanto:** espacio reservado con la leyenda *"Disponible cuando la verificación alcance su umbral de confianza"*, igual que el widget de Cumplimiento en el inicio. **No se esconde la sección: se declara.**

---

## 5. AUDITORÍA DE DATOS

**Confirmado que existe:**
- `routes` (id, clientAccountId, plantId/plantGroupId, name)
- `routeShifts` liga ruta con turno — los turnos que cubre y sus deadlines
- `routeKmlVersions` (kmlContent, waypoints, validFrom, validTo) — el trazado, versionado
- `routeTraversalMeasurements` (durationMinutes, serviceDate, pointsInCorridor, unitId) — **la duración real medida, con historia**
- `complianceFacts` — los resultados sellados con su motivo
- La política del contrato — tolerancia, corredor, geocerca

**Huecos encontrados — el diseño pedía datos que no están:**

1. **"Activa desde 2024-03-01"** — `routes` solo tiene `createdAt`, que es cuándo se dio de alta en el sistema, no cuándo empezó a operar. **Usar `createdAt` y etiquetarlo como "en el sistema desde", o quitar el dato.** No presentar `createdAt` como fecha de inicio del servicio.
2. **"Recorrido contratado 31.4 km"** — no se guarda la longitud. Se puede **calcular de los `waypoints`**; confirmar si ya hay una función o hay que hacerla. Si no la hay, el dato no se muestra.
3. **"Duración esperada"** — sí se puede derivar de `routeTraversalMeasurements` con el percentil de la política. Confirmar que el lector existe.
4. **Geocerca del destino** — confirmar cómo se resuelve desde la ruta (¿vía `routeShifts`, vía contrato?).

**Si un dato no existe, ese renglón de la identidad no se muestra.**

---

## 6. Lo que NO lleva

- **Métricas de juicio antes de la compuerta.** Ni atenuadas ni con asterisco
- **Nada de la unidad ni del chofer.** Una ruta la cubren distintas unidades; eso vive del lado carrier
- **`createdAt` disfrazado de fecha de inicio de operación**
- **Colores de veredicto en las métricas.** Medición en acero, siempre
