# Ficha — Unidades (cara transportista)

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Reemplaza la piel de** `carrier/flota` y `carrier/historial`, que hoy son dos puertas a lo mismo.

---

## 1. Qué es, y el hueco que llena

El nivel intermedio de la flota. Responde: *¿cuáles unidades me interesan?*

**Las tres escalas:**
- **Monitoreo** — ¿dónde está todo ahora? (mapa)
- **Unidades** — ¿cuáles trabajan, cuáles cuestan, cuáles fallan? — *esta*
- **Expediente** — ¿qué le pasa a esta? (una unidad a fondo)

**Sin este nivel no se puede comparar.** El mapa muestra dónde; el expediente muestra una. Comparar unidades entre sí —que es lo que un jefe de flota hace todo el día— no tenía dónde ocurrir.

---

## 2. La decisión que la salva de ser una hoja de cálculo

**Arriba no van filtros: van preguntas.** Cuatro lentes, y cada una cambia qué columnas importan y cómo se ordena la tabla:

1. **¿Cuáles trabajan?** — aprovechamiento *(por defecto)*
2. **¿Cuáles me cuestan?** — servicios no cumplidos *(espera Ola 2, ver §5)*
3. **¿Cuáles gastan más?** — diésel y km muerto
4. **¿Cuáles fallan?** — señal y taller

**El orden no es arbitrario:** un activo parado cuesta lo mismo que uno trabajando, y por eso el aprovechamiento va primero.

**La lente no filtra unidades — cambia la pregunta.** Los filtros de estado y rango son aparte.

---

## 3. Estructura

### 3.1 Titular
Contesta la lente activa de una: *"Seis unidades no salieron esta semana."* Con la lente de costo: *"Tres unidades gastan 20% arriba del promedio."*

### 3.2 Lentes, filtros y búsqueda
Las cuatro lentes · búsqueda por unidad, placa o chofer · filtros de estado (todas, activas, en taller, sin salir) · rango de tiempo.

### 3.3 La tabla
Una unidad por renglón. Columnas según la lente. En la de aprovechamiento:

unidad · estado y uso · **días con servicio** (con barra de proporción) · servicios · km · horas en patio · tendencia (barras del periodo).

**Todo en acero.** El ámbar marca lo que necesita atención —cero días, señal intermitente— **nunca una falta.**

Cada renglón abre el expediente de esa unidad.

### 3.4 Selección múltiple
Poder marcar varias y abrir el Workbench con esas unidades cargadas. **Es la puerta principal hacia la comparación.**

---

## 4. Voz

**Sin sujeto.** No *"reportado por el transportista"* en la cara del transportista.

**Las medidas se enuncian, no se juzgan.** *"0 de 24 días con servicio"*, no *"unidad desaprovechada"*. El número dice lo que pasó; la conclusión es del que mira.

---

## 5. EL CORTE

**Va hoy:** las lentes 1, 3 y 4 — aprovechamiento, costo y confiabilidad. Todo sale de hechos y telemetría.

**Espera la compuerta de Ola 2:** la lente 2, cumplimiento. Cuántos servicios no cumplidos carga cada unidad es una cifra de juicio.

**Cómo se muestra mientras tanto:** la lente existe, visible, con su razón escrita — *"se enciende cuando la verificación alcance su umbral de confianza"*. **No se esconde: se declara.**

---

## 6. AUDITORÍA DE DATOS

**Confirmado que existe:**
- `units` (label, plateNumber, active)
- `complianceFacts.observedUnitId` — servicios cubiertos por unidad
- `telemetryPoints` — días con actividad, kilómetros
- `maintenanceRecords` (status, scheduledAt, completedAt) — en taller, sale hoy
- `fuelRecords` (liters, cost, odometerKm) — diésel y rendimiento
- `deviceAssignments` — historial de rastreadores

**Debe confirmar desarrollo:**
1. **"Días con servicio"** — derivable de `complianceFacts` por unidad y fecha. Confirmar que existe un lector eficiente; con 52 unidades × 30 días no puede traer filas para contar.
2. **Horas en patio** — requiere el mismo concepto de "parada" que el Workbench. Si no existe, no se muestra.
3. **Km muerto** — distinguir recorrido en servicio de fuera de servicio.
4. **Rendimiento** — derivable de `fuelRecords` (litros contra odómetro), pero los odómetros llegan por captura manual: confirmar completitud antes de mostrarlo.
5. **Tendencia por renglón** — barras del periodo por unidad. Es agregación por día; medir el costo.

**Si un dato no existe, esa columna no se muestra.** Una tabla con columnas vacías es peor que una tabla más corta.

---

## 7. Lo que NO lleva

- **Colores de veredicto.** Ninguna medida se pinta de verde
- **Cifras de cumplimiento antes de la compuerta**
- **Conclusiones automáticas.** La tabla ordena; no dictamina
- **Nada que llegue al cliente**
