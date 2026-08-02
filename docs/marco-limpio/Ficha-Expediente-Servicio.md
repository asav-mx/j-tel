# Ficha — Expediente del servicio

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Reviste** `cliente/servicio/[id]`. **Cara:** cliente. Existe también del lado transportista (`carrier/servicio/[id]`) con la misma estructura.

---

## 1. Qué es, y por qué es la pantalla más importante del producto

La primera de las cinco identidades con expediente propio, y **el destino de casi todas las listas**: del cierre, de cumplimiento, de la bandeja, del expediente de una ruta o una unidad.

Responde: *¿qué se juzgó, cómo se midió, y con qué reglas?*

> **Aquí el árbitro se explica.** Un veredicto que no puede mostrar cómo llegó a serlo no es defendible — y todo el valor del producto es que el veredicto aguante una discusión.

---

## 2. Estructura

### 2.1 Cabecera y sello
Migas que reflejan el origen real · ruta y turno como titular · fecha, planta y transportista · navegación entre hermanos.

**El sello** es el bloque más visible: el chip del resultado con su color, la frase que lo enuncia en palabras (*"Llegó 06:52, ocho minutos antes del deadline"*), cómo se midió, y al margen cuándo se selló y con qué versión de política.

**El color del resultado vive solo aquí.** Todo lo demás de la pantalla es acero.

### 2.2 Cómo se midió — **el corazón**
Los pasos que siguió el árbitro, en forma de preguntas con su respuesta medida:

1. *¿Qué unidad prestó el servicio?* — cuál, por qué método, con qué porcentaje
2. *¿Hubo evidencia suficiente para juzgar?* — puntos, cobertura, mínimo del contrato
3. *¿Entró a la geocerca del destino?* — sí/no, a qué hora exacta, radio
4. *¿Llegó dentro del plazo acordado?* — deadline, margen, tolerancia del contrato

**Cada paso enuncia el umbral contra el que se comparó**, no solo el valor. Un "97.4%" sin el "mínimo 80%" no dice si pasó.

**Cuando un paso falla, ahí se ve** — con lo que faltó, no con una etiqueta genérica.

### 2.3 La evidencia
Mapa con el trazado contratado (punteado) y el recorrido medido (sólido), los puntos de evidencia, el origen con su hora y el destino con su geocerca.

Fondo oscuro en ambos temas. **La traza termina al entrar a la geocerca** — el recorrido posterior del transportista no se muestra a ningún cliente.

### 2.4 Las medidas
Tabla de medición pura, toda en acero: llegada observada · plazo acordado · margen · coincidencia con el trazado · cobertura con su mínimo · puntos en la ventana · hueco de señal más largo.

### 2.5 Qué se juzgó — identidad
Ruta, turno, fecha, contrato, unidad observada, chofer declarado. **Cada uno enlaza a su propia identidad.**

### 2.6 La política congelada
Versión y desde cuándo rige, tolerancia, cobertura mínima, corredor, estrictez de ruta.

Con la ley escrita: *"la política mostrada es la congelada con el hecho, no la vigente hoy."*

### 2.7 Historia del sello
Las formas por las que pasó, con su hora y quién la produjo. **Dos formas, no tres.**

---

## 3. La ley que la gobierna

> **Este expediente no se recalcula.** Lo que muestra es lo que se selló ese día con la política vigente entonces. Si la tolerancia cambia mañana, este servicio conserva la suya.

> **Cada medida trae de dónde salió.** No dice "cumplió": dice a qué hora entró a la geocerca, contra qué plazo, y cuánta evidencia había.

---

## 4. AUDITORÍA DE DATOS

**Confirmado que existe:**
- `complianceFacts` con todo lo que la pantalla necesita: `observedArrivalAt`, `expectedDeadline`, `observedRouteMatchPct`, `status`, `timing`, `lateExcusable`, `excusableReason`, `routeStrictnessApplied`, **`contractPolicySnapshot`** (la política congelada), `materializedAt`
- **`ledgerEntries`** (`action`, `steps`, `metadata`) — **los pasos del razonamiento del árbitro ya se guardan.** Es la base de §2.2
- `evidencePoints` (latitude, longitude, speed, recordedAt) — el mapa y el conteo
- `complianceFactHistory` (`status`, `timing`, `factSnapshot`, `actorKind`, `replacedAt`) — §2.7
- `routeKmlVersions.waypoints` — el trazado contratado

**Debe confirmar desarrollo:**
1. **Qué guarda `ledgerEntries.steps` exactamente.** §2.2 depende de eso. Si los pasos guardados no cubren las cuatro preguntas, se muestran los que sí y se declara.
2. **El método de identificación** ("coincidencia de trazado") — confirmar que se persiste cuál se usó, no solo el resultado.
3. **Hueco de señal más largo** — derivable de `evidencePoints`, confirmar si ya se calcula o hay que hacerlo.
4. **Chofer declarado** — no existe el modelo. Ese renglón espera el módulo de choferes.

**Si un dato no existe, ese renglón no se muestra.** Y en esta pantalla más que en ninguna: **un paso inventado destruye la credibilidad de todo el expediente.**

---

## 5. Lo que NO lleva

- **Recálculo.** Nunca se recalcula lo mostrado
- **La política vigente hoy.** Solo la congelada con el hecho
- **Color de veredicto fuera del sello.** Las medidas van en acero
- **Traza después de la geocerca**
- **Lenguaje de culpa.** Se reporta lo medido; el enforcement es otra cosa
