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

**Ley de la simplificación — decidida el 2026-08-02, con los números medidos.**

> **Simplificar es para explorar. La ventana de un servicio va completa, siempre.**

La cadencia real es **un punto por minuto** (mediana y p90 los dos en 60 s), y tres unidades por un mes son **124 396 puntos**. Explorar así no se sostiene: hay que simplificar. Pero un punto por minuto no es telemetría dispersa — **cada punto puede ser el que decide una disputa**, y simplificar ahí sería quitar evidencia sin que nadie lo note.

Dos condiciones, las dos obligatorias:

1. **La vista simplificada lo declara, y visible.** *"Traza simplificada para explorar · abre un servicio para verla completa."* No un asterisco al pie.
2. **Douglas-Peucker, no muestreo por distancia.** Douglas-Peucker conserva los vértices donde la traza cambia de dirección, que es justo donde se ve una desviación. El muestreo por distancia puede saltarse una vuelta entera.

Capas **agrupadas por familia, con su audiencia implícita**:

**Recorrido** — real · contratado (punteado) · paradas
**Evidencia** — huecos de señal · geocercas · ventana verificada

**La traza NO se corta.** Es la única pantalla del producto donde no aplica el corte de geocerca, y va declarado al pie: *"aquí la traza no se corta: es tu flota, no evidencia de un cliente."*

Al final del panel, con borde punteado: *"Más capas y herramientas se agregan aquí."* La puerta abierta, declarada.

### 3.4 Panel de composición y medidas
Las unidades en el lienzo, cada una con su color de identidad (la paleta de 196°–312°, separada 47° de todo veredicto).

Medidas del rango, todas en acero:
recorrido total · huecos de señal con su duración · sus servicios del rango.

**Tiempo detenido y conteo de paradas: fuera, y por medición — 2026-08-02.**

Los rastreadores **reportan las veinticuatro horas**. A las 3 de la mañana, 2 924 de 2 930 puntos están en velocidad cero: 99.8%. Eso no es un camión detenido en ruta, es la flota estacionada con el equipo encendido. Un "tiempo detenido" sobre un rango cualquiera mide sobre todo el estacionamiento nocturno.

Acotarlo a la operación contratada tampoco alcanza: de **53 unidades con traza en 7 días, solo 29 tienen alguna ventana de servicio acreditada**, y la unidad con más traza tiene 11 974 puntos con **196 dentro de ventanas** — el 1.6%. La medida existiría para una fracción de la flota y de su recorrido, y quien la lea no tendría cómo saberlo.

Es el mismo eje del ALCANCE que sacó al kilómetro muerto de Monitoreo, y por eso se decide igual: **el número no va hasta que se pueda distinguir "detenido en operación" de "estacionado fuera de turno".**

**Las paradas sí se dibujan en el mapa**, con su duración, porque ahí el que mira ve dónde ocurrieron y las interpreta — una parada de ocho horas en el patio se lee como lo que es. Lo que no va es **colapsarlas a un número**: "12 paradas" o "6 h detenido" pierden justo el lugar y la hora que las hacían legibles. Es la REDUCCIÓN de §D.

### 3.5 El bloque de defensa
Explícito, con su propósito escrito: *"Cuando un cliente dispute un servicio, esta es la pantalla."*

Una acción en la v1: **abrir un servicio disputado.**

**Por qué está declarado y no implícito:** el transportista no va a descubrir solo que esta pantalla lo defiende. Decírselo es parte del producto.

#### Exportar con evidencia — DECISIÓN ABIERTA, no se construye

**El botón no entra en la v1**, y la razón no es técnica.

Un documento que sirve en una disputa comercial **no es una decisión de diseño: es una decisión legal.** Qué lo hace verificable, si lleva firma o sello, si el cliente puede impugnarlo, y qué pasa cuando las dos partes exportan versiones distintas del mismo servicio. Eso se define con asesoría legal antes de escribirlo, y está en la lista de temas legales pendientes del PO.

Hasta entonces: **un botón sin destino es peor que ningún botón.** Exportar algo que parece un documento probatorio y no lo es le daría al transportista una confianza que el archivo no sostiene — y la primera vez que un cliente lo impugne, el que pierde credibilidad es el árbitro.

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
