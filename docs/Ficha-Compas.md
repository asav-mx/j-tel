# Compás — la telemetría propia

**Qué es.** El camino propio de telemetría: equipos Teltonika nuestros hablando
contra un servidor Traccar nuestro, y de ahí a las tablas de siempre.

**Por qué es camino único, con su fecha.** Umbrella cortó la transmisión el
**5 de septiembre de 2026 a las 09:20 hora de Juárez** y es definitivo. La
renovación de octubre de las 80+ unidades **ya no se firma con nadie: se
construye.** Decisión de Asav, 10 de septiembre de 2026.

---

## Los equipos, confirmado

**Teltonika FTC927**, comprados a Teltonika México.

| Qué | Valor | Cómo se confirmó |
|---|---|---|
| Transporte | **TCP** | Confirmado por Asav contra el equipo |
| Protocolo en Traccar | **`teltonika`** | Confirmado por Asav |
| Puerto | **5027** | Confirmado por Asav |

**No aparece en la lista publicada de dispositivos de Traccar**, y eso no es lo
que decide. Se comprobó en el fuente del decodificador, no en la lista:

- **Despacha por códec, no por modelo.** Latitud, longitud, hora, velocidad y
  rumbo salen de `decodeLocation()`, que sólo mira si el códec es 8, 8 Extendido
  o 16. El modelo no entra en esa decisión.
- **La familia FTC sí está reconocida** para los atributos de entrada/salida:
  `Predicate<String> ftXXX = (m) -> m != null && m.matches("FT[A-Z]\\d{3}")`, que
  `FTC927` cumple.
- La familia FTC **numera sus entradas distinto que los FM** — la potencia va en
  `io800` y no en `io66`. Para lo que se toma hoy —posición, hora y rumbo— da
  igual. Importa el día que alguien quiera ignición o voltaje.

---

## ⚠ La regla del firmware, y no se negocia

> **Se prueba UN equipo antes de configurar ochenta. Primero con el firmware de
> fábrica, y sólo si falla se actualiza.**

**Por qué.** Hay reportes en el foro de Traccar de una versión reciente de
firmware del FTC927 en la que **el equipo dejó de actualizar posición** — no
dejó de conectarse: dejó de reportar dónde está, que es el único dato por el que
existe todo esto.

**Y por qué el orden es ése y no el contrario.** El reflejo de fábrica al montar
equipos nuevos es actualizar todo antes de empezar, porque «lo nuevo está mejor».
Aquí lo nuevo es exactamente lo que hay reporte de que falla. Actualizar primero
convierte un problema conocido en el estado inicial de las ochenta unidades, y
descubrirlo después cuesta desmontar.

**Qué cuenta como probado**, y no es que el equipo aparezca en línea:

1. El equipo conecta al servidor y sale en el catálogo de Traccar.
2. **Llega una posición con `valid: true`** y coordenadas que corresponden a
   dónde está de verdad.
3. Esa posición **llega hasta `live_positions`** por el proveedor del repo, con
   su IMEI correcto.
4. Se mueve, y las posiciones siguen llegando con su hora avanzando.

Un equipo que conecta y no manda posición pasa el punto 1 y falla el 2, que es
exactamente el modo de falla del que hay reporte. **Por eso el punto 1 no
cuenta.**

---

## El puente, del lado del repo

Ya está construido: `packages/gps-traccar`, los cuatro métodos de `GpsProvider`
contra la API REST de Traccar, registrado en `buildProvider`. El recolector y el
archivador pasan los dos por ahí, así que un carrier cambia de fuente de
evidencia moviendo `carrier_profiles.gps_provider`, **sin desplegar nada**.

**Tres diferencias con Umbrella que se pagan si se ignoran**, cada una con su
prueba que se cae al romperla:

| | Qué |
|---|---|
| **1** | **La velocidad de Traccar viene en NUDOS.** Umbrella manda km/h. Pasarla tal cual metería dos unidades en la misma columna, con el mismo nombre, sin que nada truene |
| **2** | **Su `deviceId` no es el IMEI.** Es un entero de su base; el IMEI vive en `uniqueId`. Confundirlos envenena el índice único de `telemetry_points` |
| **3** | **Las posiciones marcadas inválidas se tiran.** `valid: false` es el equipo diciendo que reportó sin fijar satélites |

**Lo que el puente NO hace, a propósito:** resolver aparato → unidad. Eso ya vive
en el archivador (`resolveUnitAtTime`) con la asignación vigente **al instante
observado**, que es la ley de la Pieza 1.

---

## Lo que falta, y depende de la máquina

| # | Pieza | Estado |
|---|---|---|
| 1 | **Dónde vive el servidor.** Pide dirección estable y el 5027 abierto. **Traccar no puede vivir en Vercel**: los equipos se quedan conectados a un puerto TCP, y eso pide un proceso de larga vida | Asav contrata |
| 2 | Levantar Traccar con su base propia y su certificado | Bloqueado por 1 |
| 3 | **Un equipo apuntado y un punto que llegue** — la compuerta de verdad, y la regla del firmware manda aquí | Bloqueado por 2 |
| 4 | El proveedor en el repo | ✅ Hecho |
| 5 | Registrar el caso y las credenciales por carrier | ✅ Hecho — migración `0034` |
| 6 | Alta de los aparatos nuevos. IMEI nuevos, `devices` nuevos, `device_assignments` nuevas. El modelo ya lo soporta | Captura, tras 3 |

---

## Lo que todavía NO está probado, y va dicho

Las 17 pruebas del proveedor corren contra respuestas **con la forma que declara
el OpenAPI de Traccar**, no contra un servidor real ni contra un equipo en la
calle. Lo que sostienen es que el mapeo respeta el contrato publicado.

**La comprobación de verdad es la del punto 3 de la tabla**, y no existe
todavía. Un verde de 17 pruebas no es un camión reportando.
