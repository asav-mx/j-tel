# Lista de alta — un aparato FTC927, de la caja a la tabla

**Para qué.** Que con los equipos en la mano sea **seguir la lista, no pensar**.
Escrita el 11 de septiembre de 2026, antes de tener los equipos enfrente.

**Cada aparato se toca en tres lugares distintos y ninguno se puede saltar:**
Traccar, nuestro sistema, y la asignación que los une. Los tres están abajo con
sus campos exactos.

⚠ **El primer equipo NO sigue esta lista: sigue el paso 7 del runbook.** Un
equipo, firmware de fábrica, y hasta que una posición válida aterrice en la
tabla no se toca el segundo. Ver [`Ficha-Compas.md`](Ficha-Compas.md).

---

## Antes de tocar nada: la hoja de papel

**Esto va primero y no es burocracia.** Lo único que después nadie puede
reconstruir es **qué IMEI quedó físicamente en qué camión**. La base guarda la
relación; el papel es lo que la comprueba si alguien la capturó mal.

Por cada equipo, antes de instalarlo:

| Qué | De dónde sale |
|---|---|
| **IMEI** | de la etiqueta del equipo, y de la caja |
| **Número económico de la unidad** | del camión |
| **Placas** | del camión |
| **Fecha y hora de instalación** | el reloj |
| **Quién lo instaló** | la persona |

**Foto de la etiqueta del IMEI pegada al número económico.** Un IMEI son quince
dígitos y se teclea mal; la foto es lo que resuelve la discusión sin bajar a
nadie del camión a leer una etiqueta otra vez.

---

## Paso A · Alta en Traccar

Por el panel, entrando **por el túnel SSH** (`http://localhost:8082`), que es la
única puerta al panel.

| Campo de Traccar | Qué se pone | Cuidado |
|---|---|---|
| **Name** | el número económico | Es lo que se va a leer en el panel. No pongas «FTC927»: todos son FTC927 |
| **Identifier** | **el IMEI, tal cual** | Es lo que Traccar llama `uniqueId`, y es **lo único que liga el equipo con nuestra base.** Un dígito mal aquí y el aparato reporta a un fantasma |

**Nada más hace falta.** Grupo, teléfono, modelo y contacto son opcionales y no
los usa nuestro puente.

**Comprobación de este paso:** el equipo aparece en la lista del panel. Todavía
gris, porque no ha conectado.

---

## Paso B · Alta en nuestro sistema

Pantalla: **`/carrier/flota/alta`**. Tiene los tres formularios que hacen falta,
en orden.

### B1 · La unidad, si no existe ya

Sólo para camiones que el sistema no conoce. Los 82 de hoy ya están.

| Campo | Qué se pone |
|---|---|
| `label` | el número económico |
| `plateNumber` | las placas — opcional, y conviene ponerlo |

### B2 · El aparato

| Campo | Qué se pone |
|---|---|
| `imei` | **el mismo IMEI del paso A**, dígito por dígito |
| `label` | opcional; sirve «FTC927» aquí, porque este campo describe el aparato y no la unidad |

⚠ **El IMEI de Traccar y el de aquí tienen que ser idénticos.** No hay nada que
lo compruebe: si difieren, Traccar recibe posiciones y nuestro puente las
descarta calladas, porque no encuentra el aparato en el catálogo. **Se ve como
«no llega nada», no como un error.**

### B3 · La asignación

| Campo | Qué se pone |
|---|---|
| `unitId` | la unidad del B1 |
| `deviceId` | el aparato del B2 |

**Lo que hace por dentro, y conviene saberlo:** cierra automáticamente cualquier
asignación abierta de esa unidad **o** de ese aparato antes de abrir la nueva.
O sea reasignar un GPS a otro camión no deja dos vigentes. La fecha de inicio es
**ahora**, salvo que se indique otra.

**Y por qué importa la fecha:** el archivador resuelve aparato → unidad **por la
asignación vigente en el instante observado**, no por la de hoy. Si el equipo
lleva horas reportando antes de que lo asignes, esos puntos quedan **sin
unidad** — guardados, pero sin dueño. Por eso B3 va el mismo día de la
instalación, no «cuando haya tiempo».

---

## Paso C · Que de verdad llegó

**Esto es lo único que cuenta como aparato dado de alta.** Los pasos A y B son
captura; éste es evidencia.

1. En el panel de Traccar, el equipo pasa a **verde / en línea**.
2. Llega una **posición válida**, y las coordenadas corresponden a dónde está de
   verdad el camión.
3. La posición aparece en **`live_positions`** con su IMEI.

La tercera es la que cierra, porque es la nuestra y no la de Traccar:

```sql
SELECT imei, recorded_at, latitude, longitude, unit_id
  FROM live_positions
 ORDER BY recorded_at DESC
 LIMIT 10;
```

⚠ **Que aparezca en línea no es que esté dado de alta.** Es el modo de falla del
firmware nuevo: el equipo conecta, se ve verde, y no manda posición. **El punto
1 no cuenta.**

---

## La tabla del día

Una fila por equipo. Se llena conforme se avanza, no al final.

| # | Económico | IMEI | A · Traccar | B1 · unidad | B2 · aparato | B3 · asignación | C · posición en la tabla | Hora |
|---|---|---|---|---|---|---|---|---|
| 1 | | | ☐ | ☐ | ☐ | ☐ | ☐ | |
| 2 | | | ☐ | ☐ | ☐ | ☐ | ☐ | |
| 3 | | | ☐ | ☐ | ☐ | ☐ | ☐ | |

**Un equipo no se da por terminado con la columna C vacía.** Si al final del día
hay filas con A, B y C sin palomear, ésas son las que hay que mirar mañana — y
está bien que se vean, que para eso está la columna.

---

## Los tres errores que va a haber, y cómo se ven

| Error | Cómo se ve | Dónde se arregla |
|---|---|---|
| **IMEI distinto entre Traccar y nuestro sistema** | Traccar recibe, `live_positions` no crece. **Sin ningún error a la vista** | Corregir el que esté mal. Comparar contra la foto, no contra la memoria |
| **Falta la asignación (B3)** | La posición **sí** llega, pero con `unit_id` en nulo | Hacer B3. Los puntos viejos se quedan sin unidad: la asignación no reescribe el pasado, y eso es la ley, no un defecto |
| **Dos equipos con el mismo IMEI capturado** | El segundo choca contra el índice único de `telemetry_points` | Uno de los dos está mal tecleado. La foto decide |

---

## Lo que esta lista NO cubre

- **La instalación física** en el camión: alimentación, ignición, dónde se monta.
  Eso es del instalador y no de este documento.
- **Los 80+ de golpe.** Esta lista es por aparato, a mano. Si el volumen la hace
  impráctica, la alternativa es una carga masiva — y ésa **no existe hoy**, ni en
  Traccar ni en nuestro lado, así que habría que construirla y no está planeada.
- **Qué hacer si el firmware de fábrica falla.** Está en el paso 7 del runbook:
  se actualiza **ese** equipo y se repite. Nunca antes de probar, nunca sobre
  más de uno.
