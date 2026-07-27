# Pieza 3 — El expediente que sí defiende · Contenido canónico

**Qué es este documento:** la definición de QUÉ dice el expediente de un servicio. Diseño decide CÓMO se ve. Los dos convergen aquí — un solo expediente, no dos.

**Estado:** definición de desarrollo, validada contra el Marco. Falta el visto de Asav al mockup de dos caras; este texto no lo sustituye, lo alimenta.

---

## 1. Propósito

El expediente es donde el resultado se defiende. Un chip rojo sin expediente es una acusación; con expediente es un caso. Todo lo que contiene existe para contestar una sola pregunta del que lo lee: **"¿por qué debería creerle a este resultado?"**

## 2. Las dos caras — mismo expediente, distinta altura

No son dos productos. Es el mismo caso visto desde dos lugares:

- **Planta:** ve el servicio contratado y su evidencia. Jamás ve la operación interna del carrier: ni su flota completa, ni lo que la unidad hizo después de cruzar la geocerca (el trazo se corta en la llegada), ni las candidatas descartadas.
- **Carrier:** ve todo lo de la planta MÁS su propio contexto: qué unidad se acreditó, la etiqueta de calibración si existe, y su vista de defensa (la autopsia con sus unidades).

Regla de construcción: la cara de planta es un subconjunto estricto de la del carrier. Nada aparece del lado planta que no aparezca del lado carrier.

## 3. Contenido obligatorio, por bloque

### 3.1 El resultado y su marca
- Chip del resultado (cumplido / no cumplido / pendiente por evidencia) — colores reservados de resultado.
- La marca de sellado con fecha completa, según la regla de la historia del sello (skill, sección 4): "Verificado y sellado · fecha" o "Verificado de nuevo · fecha · causa · firma".
- Si hubo versiones: el cajón "Historia del sello · N versiones", vigente arriba, anterior tachada pero legible.

### 3.2 Esperado vs. Observado
- **Esperado:** deadline con fecha completa, tolerancia del contrato, ventana de evidencia usada en el viaje (congelada), márgenes, unidad de referencia si existe.
- **Observado:** unidad acreditada, llegada observada con fecha completa, puntualidad como delta ("Temprano · 10 min antes" — nunca la etiqueta sola, nunca formato de hora para duraciones), cobertura GPS de la ventana.
- Todo par medición/umbral va JUNTO: "cobertura 94.2% · umbral del contrato 60.0%". Mostrar solo uno es medio dato.

### 3.3 La calidad de la ventana (decisión de diseño 26-jul, validada)
En un `no cumplido`, la planta ve por default la calidad de la evidencia de la ventana: % de cobertura temporal y hueco máximo continuo, con fechas completas. Es dato sobre la ventana del servicio, no sobre la flota del carrier — no toca la Ley 3.

Razón de fondo: por ley del Marco, sin evidencia suficiente el resultado es `pendiente_evidencia`, jamás `no_cumplido`. Por lo tanto, un `no_cumplido` legítimo SIEMPRE tiene ventana bien cubierta — y mostrarla es lo que separa un rojo confiable de uno arbitrario. Si alguna vez un `no_cumplido` mostrara ventana pobre, eso es un bug del motor, no un caso de diseño.

### 3.4 El motivo
- El motivo bajo el chip, con su número: "Llegada tarde · 4 min", "Sin servicio detectado en la ventana". (Deuda conocida: el número de minutos se perdió desde el PR #50; se restaura en la construcción de esta pieza.)
- Si el motivo es excusable según el contrato, se dice y se nombra la causa excusable.

### 3.5 La evidencia GPS
- Mapa con el trazo de la unidad acreditada, cortado en `observedArrivalAt` (la llegada). Lo posterior no existe para la planta.
- El trazado contratado (KML) como referencia.
- Sin unidad acreditada: el trazado esperado y la geocerca destino como referencia, y la leyenda honesta de que no se identificó unidad.

### 3.6 Consecuencias (compuerta de enforcement)
- Solo si la bandera de enforcement del contrato está encendida.
- Formato: la consecuencia atribuida a su cláusula — "aplica penalización · cláusula 7.2". Nunca "no se paga" a secas.
- Bandera apagada: este bloque no existe. El expediente muestra el resultado verificado y nada más.

### 3.7 La bitácora técnica
- Cajón colapsado (auditoría). Cada paso del razonamiento del motor, cada uno traceable a un hecho.
- Aplica "la lectura no dictamina": lo que la evidencia dice + lo que la evidencia NO responde, declarado.

## 4. La vista de ruta — "¿qué pasó con esta ruta?"

La segunda mitad de la Pieza 3. Una vista por ruta (identidad = destino) que junta sus servicios en un rango de fechas sin ir uno por uno:

- Racha de resultados por día/turno (chips), con miniatura de punto azul donde hubo re-verificación.
- Sus números agregados: % cumplido del rango, deltas típicos de llegada, servicios sin unidad acreditada.
- Acceso directo al expediente de cada servicio.
- Es una consulta sobre hechos sellados — no recalcula nada, no re-juzga nada.

Este es el primer "expediente por identidad" que se construye; el patrón (expediente = consulta, no tabla) es el mismo que luego usan unidad, chofer y contrato en Flota.

## 5. Lo que el expediente NO muestra — nunca

- Nada de la flota del carrier del lado planta (Ley 3): ni inventario, ni candidatas, ni sugerencias de calibración.
- Nada posterior al cruce de la geocerca del lado planta.
- Nombres propios de firmante antes de auth-rbac — la firma honesta es el rol ("J-Staff").
- Consecuencias económicas con la bandera de enforcement apagada.
- Empalme/consolidación como afirmación: son inferencias, no hechos probados. Si se mencionan, se mencionan como lectura ("compatible con servicio consolidado"), jamás como dictamen.

## 6. Reglas del skill que gobiernan esta pieza

Fechas completas en evidencia · duraciones con unidad, no formato de hora · medición junto a su umbral · la historia del sello (dos formas, actor e intención por separado) · la lectura no dictamina · la voz ("resultado", nunca "veredicto" en pantalla).
