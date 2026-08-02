# Ficha — Workbench (cara transportista)

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Reemplaza la piel de** `carrier/recorrido`. **Cara:** transportista únicamente.

---

## 1. Qué es

El instrumento de análisis y de defensa. Responde: *¿qué pasó, y cómo lo pruebo?*

**La ley que lo separa de Monitoreo:**

> **Monitoreo mira el ahora. El Workbench mira hacia atrás.** El corte es por tiempo, no por objeto. Cualquier pregunta sobre el pasado —una unidad el martes, dos comparadas, un servicio disputado— vive aquí.

**Y la que lo hace distinto de un GPS:**

> Un rastreador enseña por dónde pasó el camión. Aquí se pone encima el trazado contratado, la ventana del servicio verificado, dónde hubo huecos de evidencia, y qué resultado se selló. **Esa segunda familia de capas es la que nadie más tiene.**

---

## 2. Un lienzo, muchas puertas

**No es una pantalla más de la navegación: es el destino de varias.** Siempre el mismo lienzo, con el contexto ya cargado:

| Se entra desde | Llega con |
|---|---|
| Expediente de una unidad | esa unidad y su rango |
| Un servicio | esa unidad y la ventana exacta del servicio |
| Unidades, con selección múltiple | esas unidades y el rango del filtro |
| La navegación directa | vacío, listo para elegir |

**Regla 3.b del skill:** el regreso devuelve a donde estaba el usuario, con sus filtros.

---

## 3. Estructura

### 3.1 Titular
Enuncia lo que se está viendo: *"U-214, del lunes al viernes."* Con varias unidades: *"Tres unidades, 20–24 de julio."*

Subtítulo con las medidas gruesas: días, servicios, kilómetros.

### 3.2 La barra de composición — **dos campos, no más**
- **Quién:** las unidades en el lienzo, cada una removible, más "agregar unidad"
- **Cuándo:** un día · un rango · la ventana de un servicio

Y "guardar esta vista" al margen.

**Eso es toda la programabilidad de la v1.** La barra está pensada para que agregar una dimensión después sea agregar un campo, no rehacer la pantalla.

### 3.3 El mapa
Fondo oscuro en ambos temas (excepción del skill: el lienzo es evidencia).

Capas **agrupadas por familia, con su audiencia implícita**:

**Recorrido** — real · contratado (punteado) · paradas
**Evidencia** — huecos de señal · geocercas · ventana verificada

**La traza NO se corta.** Es la única pantalla del producto donde no aplica el corte de geocerca, y va declarado al pie: *"aquí la traza no se corta: es tu flota, no evidencia de un cliente."*

Al final del panel, con borde punteado: *"Más capas y herramientas se agregan aquí."* La puerta abierta, declarada.

### 3.4 Panel de composición y medidas
Las unidades en el lienzo, cada una con su color de identidad (la paleta de 196°–312°, separada 47° de todo veredicto).

Medidas del rango, todas en acero:
recorrido total · sobre trazado contratado con su porcentaje · fuera del corredor · tiempo detenido · paradas · huecos de señal con su duración.

Y sus servicios del rango: verificados · con evidencia completa · quedaron pendientes.

### 3.5 El bloque de defensa
Explícito, con su propósito escrito: *"Cuando un cliente dispute un servicio, esta es la pantalla."*

Dos acciones: abrir un servicio disputado · exportar el recorrido con su evidencia.

**Por qué está declarado y no implícito:** el transportista no va a descubrir solo que esta pantalla lo defiende. Decírselo es parte del producto.

---

## 4. Lo que NO entra en la v1

- **Reproducción.** Ver el recorrido avanzar en el tiempo con play. Es cara de construir bien y la traza quieta con paradas marcadas contesta casi todo. **Anotada para después, no descartada.**
- **Consultas propias.** La programabilidad de verdad —que el transportista arme sus propias preguntas— es horizonte, no v1.
- **Herramientas de medición sobre el mapa** (medir distancia entre dos puntos a mano).

**Los tres se dejan fuera con su razón escrita, no en silencio.**

---

## 5. AUDITORÍA DE DATOS

**Confirmado que existe:**
- `telemetryPoints` (unitId, recordedAt, latitude, longitude, speed) — la traza, con historia
- `routeKmlVersions.waypoints` — el trazado contratado
- `cumulativeRouteFractions` en `@jtel/verification` — medir avance sobre el trazado
- `complianceFacts` — qué resultado se selló, y la ventana de cada servicio
- `SIN_SENAL_MINUTOS` — definir qué cuenta como hueco
- `geofences` — las geocercas

**Debe confirmar desarrollo:**
1. **Volumen.** 360,977 puntos en 7 días para toda la flota. Una unidad × 5 días es manejable; **tres unidades × un mes puede no serlo.** Medir antes de construir, y decidir si se simplifica la traza al dibujar.
2. **Paradas.** No existen como concepto. Se derivan de puntos consecutivos con `speed = 0` o sin desplazamiento — hay que definir el umbral y **que sea configurable, no hardcodeado.**
3. **Tiempo detenido** — depende de lo anterior.
4. **Km sobre trazado contra fuera del corredor.** El árbitro ya distingue puntos en corredor; confirmar si esa medida se puede acumular por rango.
5. **Exportar con evidencia.** Formato por definir. Si va a servir en una disputa, importa qué contiene y qué lo hace verificable — **eso es decisión de producto, no de UI.**

**Si un dato no existe, esa medida no se muestra.**

---

## 6. Lo que NO lleva

- **Nada en vivo.** Si alguien quiere el ahora, va a Monitoreo
- **Colores de veredicto.** Todo acero; el ámbar marca lo que quedó sin ver, no una falta
- **Nada que llegue al cliente.** Es instrumento interno y de defensa
- **Conclusiones.** El mapa muestra lo medido; interpretarlo es del que lo mira
