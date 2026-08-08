# Ficha — Expediente de la unidad

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Cara:** carrier únicamente. **Ola:** el grueso hoy; dos bloques esperan.

**Reviste:** `carrier/flota/[unitId]`.

> **Por qué esta línea existe:** sin ella, contar cuántas pantallas tienen
> diseño obliga a leer las trece fichas y a interpretar. Con ella el conteo se
> rehace solo. La ruta va **en el encabezado y con acentos graves**, para que
> un `grep` la encuentre. Ver `PLAN.md` §8.

---

## 1. Qué es, y la ley que lo ordena

La unidad es **la tercera identidad con expediente propio**. Responde: *¿cómo se ha portado este camión?*

**Dos leyes lo gobiernan:**

> **El rastreador no es la identidad de la unidad.** Una unidad puede traer varios aparatos a lo largo de su vida; su historia es una sola y no se parte cuando el equipo se cambia.

> **La unidad no tiene resultado propio.** Los servicios que cubrió sí tienen el suyo. Aquí se ve cómo se comporta el camión; si cumplió o no vive en cada servicio.

---

## 2. Estructura

### 2.1 Cabecera
Migas (`Unidades › U-214`) · identificador como titular · línea de contexto · navegación entre hermanos con el conteo de flota · pestañas: Resumen · Servicios · Mantenimiento · Diésel.

### 2.2 Qué es esta unidad — identidad
Estado hoy · kilometraje · rastreador actual con su fecha de instalación · último mantenimiento · próximo servicio.

**Ver §5: varios de estos datos no existen todavía.**

### 2.3 La vida de la unidad
Barra de los últimos meses: en servicio, taller (rayado), fuera. Con los hitos marcados encima: cambios de rastreador, mantenimientos mayores.

### 2.4 Salud de la señal — **la sección más valiosa**
Gráfica de huecos de señal por mes, con **la línea que marca cuándo se cambió el rastreador**.

Al lado, la lista de rastreadores que ha traído con sus periodos.

**Y cuando el patrón lo sostenga, la lectura se declara:** *"cambiar el rastreador en mayo no resolvió los huecos: la unidad los concentra antes y después del cambio, así que el problema no es el aparato."*

Eso le sirve al carrier de verdad — le dice dónde **no** buscar. Y no depende del árbitro: es telemetría cruda.

### 2.5 Métricas del periodo — **BLOQUE PARCIAL, ver §4**
Huecos de señal (va hoy) · servicios cubiertos (va hoy) · kilómetro muerto y rendimiento (dependen de datos que hay que confirmar) · cumplimiento agregado (espera Ola 2).

### 2.6 Quiénes la manejaron — **BLOQUE RESERVADO, ver §4**
Tabla de choferes declarados con su periodo y conteo de servicios, incluyendo el renglón **"sin declarar"** cuando la unidad se movió sin declaración.

---

## 3. Voz — regla del skill

**Los datos se enuncian sin sujeto.** No *"declarado por el transportista"* en la cara del transportista.

- Encabezado de identidad: *"configuración y datos de alta"*
- Encabezado de choferes: *"el chofer se declara · el GPS identifica unidades, no personas"*

**La frontera se menciona una sola vez, al pie:** *"nada de esta pantalla llega a los clientes."*

---

## 4. EL CORTE

**Va hoy:** identidad (lo que exista), vida de la unidad, salud de señal, rastreadores, servicios cubiertos, pestañas de mantenimiento y diésel.

**Espera al modelo de choferes (§2.6):** quiénes la manejaron. No hay tabla de choferes. **Sección con espacio reservado declarado**, no omitida en silencio.

**Espera la compuerta de Ola 2:** el cumplimiento agregado de la unidad, si se decide mostrarlo.

---

## 5. AUDITORÍA DE DATOS

**Confirmado que existe:**
- `units` (id, carrierAccountId, label, plateNumber, active, createdAt)
- `devices` (imei, label) y **`deviceAssignments` (unitId, deviceId, validFrom, validTo)** — los rastreadores con sus periodos, exactamente lo que pide §2.4
- `telemetryPoints` (unitId, recordedAt) — base de la salud de señal
- `maintenanceRecords` (unitId, description, status, scheduledAt, completedAt) — pestaña de mantenimiento y la barra de taller
- `fuelRecords` (unitId, liters, cost, odometerKm, recordedAt) — pestaña de diésel
- `complianceFacts.observedUnitId` — servicios que cubrió

**Huecos encontrados — el diseño pedía datos que no están en `units`:**

1. **Modelo y año ("Sprinter 2019")** — no existe. **No se muestra**, o se agrega como campo de alta en un PR aparte.
2. **Número de asientos ("12 asientos")** — no existe. Igual.
3. **Kilometraje ("318,442")** — no está en `units`, pero **`fuelRecords.odometerKm` sí lo tiene**. Se puede tomar el más reciente y etiquetarlo *"al [fecha de esa carga]"* — nunca presentarlo como kilometraje de hoy.
4. **Verificación vehicular** — no existe. No se muestra.
5. **"Próximo servicio en 1,558 km"** — requiere kilometraje actual y una regla de intervalo. **Confirmar si `maintenanceRecords` guarda el intervalo**; si no, mostrar solo el último mantenimiento.
6. **Kilómetro muerto y rendimiento** — el rendimiento se puede derivar de `fuelRecords` (litros contra kilometraje). **El kilómetro muerto necesita distinguir recorrido en servicio de recorrido fuera de servicio** — confirmar si eso se puede calcular hoy.

**`jrzPassDriverId` no se usa.** Es un campo del predecesor congelado; no es la base del módulo de choferes.

**Si un dato no existe, ese renglón no se muestra.** No se inventa un modelo de camión ni un kilometraje.

---

## 6. Lo que NO lleva

- **Un resultado de la unidad.** No existe "unidad cumplida"
- **Nada que llegue al cliente.** Esta pantalla es del carrier
- **Datos de alta inventados** para llenar la fila de identidad
- **Lenguaje de culpa** en la salud de señal: se reporta el hecho, no se dicta la causa
