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
3. *¿Entró a la geocerca del destino?* — sí/no, a qué hora exacta **(sin radio — ver abajo)**
4. *¿Llegó dentro del plazo acordado?* — deadline, margen, tolerancia del contrato

**Cada paso enuncia el umbral contra el que se comparó**, no solo el valor. Un "97.4%" sin el "mínimo 80%" no dice si pasó.

**Cuando un paso falla, ahí se ve** — con lo que faltó, no con una etiqueta genérica.

#### Lo que la cara cliente recibe es una proyección, no el ledger

**El ledger crudo no cruza a la planta, y no debe cruzar.** Sus pasos `candidata` traen el IMEI de cada unidad que *no* sirvió la ruta: eso es flota del transportista, y Pieza 4 del Marco lo prohíbe. La compuerta que hoy existe en el cargador se queda intacta.

Lo que cruza es una **proyección armada en el servidor**:

- los cuatro pasos con sus umbrales y sus porcentajes
- la unidad ganadora **con su etiqueta legible**, nunca su IMEI
- **cero candidatas perdedoras, cero IMEIs**

**Por qué se construye la proyección en vez de dejar §2.2 solo del lado transportista:** el argumento entero del producto es que el veredicto aguanta una discusión. Una planta que no puede ver cómo se midió tiene que creer el resultado por fe — y eso es exactamente lo que J-Telemetry existe para no pedir. **Puede saber cómo se midió sin ver la flota de quien la sirve.**

#### Cada paso declara su procedencia

Los cuatro pasos no salen todos del mismo lugar, y la pantalla no finge que sí:

| Paso | De dónde sale |
|---|---|
| 1 · Qué unidad | `ledgerEntries.steps` — `candidata` y `decision`, con sus umbrales |
| 2 · Evidencia suficiente | `ledgerEntries.steps` — `cobertura_evidencia` |
| 3 · Geocerca | La hora, del hecho sellado. **Sin radio** — ver abajo |
| 4 · Plazo | `complianceFacts.expectedDeadline` + la **política congelada**, no el ledger |

**El método de identificación no se cita como etiqueta guardada, porque no se guarda una.** Se muestra *cómo* se midió — coincidencia de trazado y precisión de corredor, cada una contra su mínimo. Es más honesto y más útil que un nombre.

**Y cuando la ruta no tiene trazado contratado, el paso 1 no muestra porcentajes.** El motor deja 100 de relleno y no emite mínimos, porque no comparó contra nada. Enseñar "coincidencia con el trazado 100.0%" de una ruta sin trazado es un número correcto sosteniendo algo falso. Se dice lo que sí pasó: la unidad se acreditó por su entrada a la geocerca.

#### El paso 3 va sin radio, y esa es la decisión

**No existe un radio de geocerca que mostrar.** Una geocerca se archiva como polígono, no como radio. El único "radio" configurable es el del **corredor del trazado**, que sirve a las medidas del paso 1 y no tiene nada que ver con la geocerca del destino — etiquetarlo como tal sería mentir con un número correcto.

**Y aunque existiera, no se podría recuperar el histórico.** La geocerca no se versiona y el hecho la referencia viva, así que lo que se dibujara sería la forma de hoy, no contra la que se midió ese día. Un expediente que no se recalcula no puede enseñar una regla que sí cambió.

**Entonces el paso 3 afirma solo la hora de entrada**, que sí quedó congelada con el hecho, y dice por qué no muestra la forma. La hora sola sigue siendo verdad.

**Cuando un paso no se registró, se declara.** Los hechos sellados antes de que existiera la medición de cobertura no traen el paso 2. Ese renglón dice que no se registró para ese servicio. **No se deriva a la callada ni se deja un hueco mudo:** un paso inferido y uno medido no pueden verse igual.

### 2.3 La evidencia
Mapa con el trazado contratado (punteado) y el recorrido medido (sólido), los puntos de evidencia, el origen con su hora y el destino con su geocerca.

Fondo oscuro en ambos temas. **La traza termina al entrar a la geocerca** — el recorrido posterior del transportista no se muestra a ningún cliente.

### 2.4 Las medidas
Tabla de medición pura, toda en acero: llegada observada · plazo acordado · margen · coincidencia con el trazado · cobertura con su mínimo · puntos en la ventana · hueco de señal más largo **con el máximo que permite el contrato**.

El hueco más largo **ya está medido** — no se recalcula desde los puntos de evidencia. Vive en el paso `cobertura_evidencia`, junto al máximo contra el que se comparó.

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

**Confirmado contra el código — lo que guarda `ledgerEntries.steps`:**

El árbitro emite cinco pasos (`inicio`, `evidencia`, `cobertura_evidencia`, `candidata` — uno por IMEI —, `decision`), con la forma `{step, result, details}`. La capa de servicios agrega `llegada_fuera_ventana` y `multi_variante`.

1. **Las cuatro preguntas no salen todas del ledger.** La 1 y la 2 sí; la 3 solo en su hora; la 4 no. La procedencia de cada una está en §2.2 y **se declara en pantalla**.
2. **El método de identificación no se persiste con nombre.** Se infiere de si hubo trazado contratado. Por eso §2.2 muestra las dos medidas contra sus mínimos en vez de citar una etiqueta que no existe.
3. **El hueco de señal más largo ya se calcula** y viene con su máximo permitido. **No se deriva de `evidencePoints`.**
4. **El paso de cobertura falta en los hechos viejos** — solo se emite cuando hay ventana de cobertura. Ya existe el lector que devuelve nulo cuando el paso no aparece; ese es el contrato. Renglón declarado, nunca callado.
5. **Chofer declarado** — no existe el modelo. Ese renglón espera el módulo de choferes.

**El ledger no cruza a la cara cliente.** La compuerta es de Pieza 4 y no se toca. Lo que la planta ve es la proyección de §2.2.

**Si un dato no existe, ese renglón no se muestra.** Y en esta pantalla más que en ninguna: **un paso inventado destruye la credibilidad de todo el expediente.**

---

## 5. Lo que NO lleva

- **Recálculo.** Nunca se recalcula lo mostrado
- **La política vigente hoy.** Solo la congelada con el hecho
- **Color de veredicto fuera del sello.** Las medidas van en acero
- **Traza después de la geocerca**
- **Lenguaje de culpa.** Se reporta lo medido; el enforcement es otra cosa
- **El ledger crudo en la cara cliente.** Ni IMEIs, ni las unidades candidatas que no sirvieron la ruta. La planta ve cómo se midió, nunca la flota de quien la sirve
- **Un paso inferido con la misma cara que uno medido.** Lo que no se registró se dice
