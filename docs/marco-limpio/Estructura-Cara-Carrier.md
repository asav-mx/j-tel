# La cara del transportista — estructura y leyes

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Documento de estructura**, no de pantalla. Ordena las once rutas de `carrier/*` y fija las leyes que las separan.

---

## 1. Por qué existe este documento

La cara del transportista tiene **once pantallas** y hasta ahora ninguna estaba diseñada. Peor: tres de ellas —`flota`, `historial`, `recorrido`— son puertas distintas a preguntas parecidas, y sin una estructura declarada seguirían multiplicándose.

**Y es la mitad del producto.** El transportista es quien paga por saber cómo va su operación; la planta paga por saber si le cumplieron.

---

## 2. Las tres leyes que ordenan la casa

> **1 · Monitoreo mira el ahora. El Workbench mira hacia atrás.**
> El corte es por tiempo, no por objeto. Cualquier pregunta sobre el pasado vive en el Workbench, sea de una unidad, de varias, o de un servicio disputado.

> **2 · Un lienzo, muchas puertas.**
> No hay tres mapas. Hay dos: el de Monitoreo (vivo, todos los contratos) y el del Workbench (histórico, cualquier composición). Al Workbench se entra desde el expediente, desde un servicio, desde Unidades, o directo — siempre es el mismo lienzo con distinto contexto.

> **3 · Lo compartido es idéntico; lo propio va encima.**
> Los números que el transportista comparte con su cliente son los mismos, sin excepción. Si difieren, la discusión deja de ser sobre la operación y pasa a ser sobre el instrumento — y ahí el árbitro perdió. Su capa propia (diésel, taller, km muerto, reservas) va **encima**, nunca **en vez de**.

---

## 3. La estructura, de macro a micro

```
Inicio            lo que necesita atención hoy
  │
  ├── OPERACIÓN
  │     Monitoreo        el ahora · todos los contratos · capa de flota apagable
  │     Sin declarar     unidades que se movieron sin declaración
  │
  ├── RECURSOS
  │     Unidades   ───┐  el explorador: cuáles trabajan, cuestan, fallan
  │     Choferes   ───┤  mismo patrón que unidades
  │     Diésel        │
  │     Taller        │
  │     Rastreadores  │
  │                   ▼
  │              Expedientes: unidad · chofer
  │
  ├── ANÁLISIS
  │     Workbench       el pasado · cualquier unidad, cualquier rango, capas
  │     Cumplimiento    (espera Ola 2)
  │
  └── CLIENTES
        Contratos · Inspecciones
```

**El expediente de la unidad no lleva mapa completo.** Lleva un botón "Ver recorrido →" que abre el Workbench con esa unidad y su rango puestos. El expediente contesta *cómo está*; el Workbench contesta *por dónde anduvo*.

---

## 4. Qué reemplaza a qué

| Ruta actual | Queda como |
|---|---|
| `carrier/` (inicio) | Inicio, revestido |
| `carrier/recorrido` | **Workbench** |
| `carrier/flota` + `carrier/historial` | **Unidades** (se funden: alta y catálogo eran lo mismo) |
| `carrier/historial/[unitId]` | Expediente de la unidad |
| `carrier/combustible` | Diésel |
| `carrier/mantenimiento` | Taller |
| `carrier/gps` | Rastreadores |
| `carrier/cumplimiento` | Cumplimiento — **espera Ola 2** |
| `carrier/servicio/[id]` | Expediente del servicio, cara transportista |
| `carrier/reportes` | Sin diseñar — falta definir qué exporta |

**Ruta nueva:** `carrier/monitoreo`.

---

## 5. La pieza que falta: el vigía

Una sala de control que reemplaza monitoristas necesita **que alguien mire cuando nadie está viendo la pantalla.**

Esa pieza es **Lenore**, y está anclada después de auth-rbac. No se construye ahora.

**Pero Monitoreo debe dejarle su lugar desde el primer día:** la zona de "lo que todavía se puede evitar", arriba de todo, es donde el vigía hablará. Hoy la llena el sistema con lo que mide. Construirla con esa forma no es adelantarse — es no tener que rehacerla.

---

## 6. La puerta de defensa

El Workbench no es solo análisis interno. **Es el instrumento con el que el transportista se defiende.**

Cuando un cliente dispute un servicio, el transportista abre la ventana exacta y ve el recorrido real contra el trazado contratado, dónde hubo huecos de evidencia, y qué resultado se selló — con los mismos datos que vio el árbitro.

**Eso queda declarado en la pantalla, no implícito.** El transportista no va a descubrir solo que esa pantalla lo defiende.

---

## 7. El corte de la geocerca, y su única excepción

En toda la cara del cliente, y en Monitoreo del transportista, **la traza corta al entrar a la geocerca.** Es la frontera de la evidencia.

**El Workbench es la única pantalla del producto donde no se corta.** Es la flota propia del transportista, no evidencia de un cliente, y él puede ver todo lo suyo sin límite de tiempo.

**Esa excepción va declarada en la pantalla**, para que nadie la lea como un descuido.

---

## 8. Lo que sigue sin diseñar

- **Choferes** (catálogo y expediente) — mismo patrón que unidades, y depende del modelo de dos capas
- **Diésel, Taller, Rastreadores** — pantallas de recursos, pendientes
- **Sin declarar** — existe el concepto, falta la pantalla
- **Inspecciones** — zona compartida planta–transportista, nunca se definió qué hace
- **Reportes** — falta definir qué exporta
- **Cumplimiento** — diseñada su lógica, espera Ola 2
