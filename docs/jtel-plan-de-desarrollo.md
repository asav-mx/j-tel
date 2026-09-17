# J-Tel — Plan de desarrollo

Dónde vamos y qué sigue. **Fuente única:** cualquier chat nuevo lee esto para
saber el estado. Se actualiza al cerrar cada pieza. Acompaña al Marco
(`docs/marco-limpio/`) y al mapa de la casa (`docs/Mapa-De-La-Casa.md`).
Sustituye a `Plan-Desarrollo-Orden-Frentes.md` (15 de agosto), archivado sin
editar en `docs/archivo/`.

Última actualización: 16 de septiembre de 2026.

## Cómo se trabaja

- Asav decide y revisa; Devin construye. Asav no corre comandos de terminal.
  Lo único técnico que hace Asav es correr SQL en el editor de Neon
  (copiar/pegar lo que Claude le da) y asignar dispositivos en pantalla.
- Todo entra por PR. Asav mergea lo que toca motor, Marco, migración o
  guardias. Devin mergea lo de sólo lectura y presentación tras revisión
  visual de Asav.
- Migración siempre antes del merge. Si un PR trae migración: correr el SQL
  en Neon (paso a paso con Claude), comprobar, y hasta entonces mergear.
- Árbol lado a lado. El UI viejo (`/carrier`, `/cliente`, `/jstaff`) sigue
  vivo mientras la casa nueva (`/casa/…`) se llena cuarto por cuarto. Nada
  nuevo se construye en el lenguaje viejo. Lo viejo se apaga cuando su último
  cuarto tenga versión nueva.
- Modelos: Opus para decisiones de arquitectura, diseño y validación contra
  el Marco; un modelo tipo Fable para tramos largos de construcción, en modo
  «avanza y detente en cada punto de verificación». Devin recomienda el
  modelo al inicio de cada tarea.
- Prototipo antes de construir cualquier pantalla nueva; Asav lo revisa antes
  de que se escriba el código.

## Lo que está en main (hecho)

**El cimiento del rediseño:**

- Identidad visual (cobre con tinta azul, dos pieles), skill `jtel-diseno`,
  mapa de la casa (cinco caras), cascarón con navegación por pestañas.
- Expedientes completo: el cuarto (#421), el catálogo de documentos D2
  (#422), mercado de Chihuahua para Juárez Bus (#420).
- Arreglo del menú que perdía la cuenta al navegar + selector de cuenta
  (#429).

**El cuarto de Compás (en construcción):**

- C1 — recorrido del día con huecos (#424) y corte de traza por modalidad
  (#426).
- C2 — Flota en vivo con mapa (#428).

**Infraestructura / motor:**

- Migración a Compás cerrada; marca de lectura por aparato que arregló la
  pérdida de evidencia (#408 / 0037).
- Los 8 FTC927 configurados; los 7 movidos a Juárez Bus (#419), el 002 en el
  Jeep (ASAV).
- Mejoras de velocidad: consulta de última señal 3.3 s → 1 ms (#423),
  cronómetro de lentitud (#427).

**El Marco: 7 piezas.** Pieza 6 (Compás, el cimiento), enmienda del
expediente (§H, 6.30–6.33), Pieza 7 (la modalidad del servicio).

## Lo que sigue, en orden

### Ahora

1. **Instalar los 7 FTC en camiones de Juárez Bus.** Probar el 005 primero
   (prueba de 5 min al cielo: si no reporta en su ficha, no instalarlo — su
   IMEI empieza raro, 860573…). Asignar cada uno a su unidad el mismo día en
   `/carrier/flota/alta?account=juarez-bus`. En cuanto rueden, Compás acumula
   historia real.
2. **C3 — recorrido y playback.** El renglón «Recorridos y playback» de
   Ver ‹unidad› / Ver ‹dispositivo› se vuelve la puerta al mapa con el
   recorrido de un día y el playback honesto (se detiene en los huecos). Es
   lo que reemplaza a Umbrella del todo. Partir: decisiones de diseño con
   Opus, construcción con Fable. Prototipo antes de construir. Cada cuarto
   nuevo del transportista debe pasarle la cuenta al marco (aprendizaje del
   #429).
3. **C4 — Dispositivos y sus acciones.** El inventario, y asignar / soltar /
   dar de baja desde la pantalla nueva. Reemplaza el alta vieja de
   `/carrier/flota/alta`.

### Después

- Medir la lentitud como la vive el usuario con el cronómetro (#427), y
  quitar las precargas en ráfaga si hace falta.
- Migrar Vernier, Planta y Corporativo a la casa nueva, cuarto por cuarto.
- Migrar el alta de cuentas de J-Staff al UI nuevo — cuando se acerque el
  primer cliente real, no antes.
- **Protomaps auto-hospedado en Cloudflare R2** (extracto regional) antes de
  las 80 unidades — decidido el 16-sep; convierte la mensualidad en
  centavos. Hoy en OpenStreetMap directo.

### Condición, no fecha

**Los 80+ GPS y el alta por lote.** NO es una fecha: se hace SÓLO cuando el
cuarto de Compás funcione y Asav lo haya visto trabajar con los 8. No se
invierte en 80 dispositivos hasta ver funcionar J-Tel. Umbrella se deja
cuando la prueba convenza.

## Pendientes con nombre (no urgentes, anotados para no perderse)

- El estado de una unidad y de un dispositivo debe derivar del lugar (patio,
  taller, en servicio, en bodega) cuando existan Lugares y el mapa en vivo.
  Requiere roles nuevos de geocerca (bodega, patio, taller) que hoy no
  existen. El diseño de los estados ya nace apuntando hacia allá.
- `corredor-prueba` es transporte especial cargado como circuito; se corrige
  cuando la modalidad exista como dato marcable.
- Las alertas viejas de Umbrella (5–11 sep) siguen abiertas y nunca llegan a
  cero; limpiarlas cuando se retire lo viejo (6.17).
- Marcar el lugar activo dentro de «Más» en el menú.
- Las 23 fichas del Marco que apuntaban al skill viejo (revisión de Asav).
- Las 5 reglas candidatas al Marco en `Trampas-De-Medicion.md` §2, sin
  ratificar.
- **La cadencia de reporte por tipo de servicio.** La frecuencia cuesta SIM y
  no todas las unidades necesitan la misma: transporte público con app de
  pasajero pide frecuencia alta; transporte especial puede reportar menos,
  porque al árbitro le bastan las entradas y salidas de geocerca. Se decide
  con la medición real de consumo de los 8 — no antes.
- **Horarios en puerta** (idea de Asav, 16-sep). En el piso de flota /
  monitoreo, el tablero de lo que viene: para especial, la lista de
  servicios por salir con su ventana (como pantalla de aeropuerto); para
  circuito, los circuitos en servicio con sus tablas de horario por parada.
  Un carrier con contrato y concesión ve los dos registros, uno por
  modalidad (Pieza 7). Es un cuarto/parte propio del piso de flota — se
  diseña en su momento, con prototipo; no entra a C3.

## Decisiones grandes pendientes con papá / negocio

- Los valores del catálogo de documentos de Chihuahua (obligatorio, vence,
  periodicidad, días de aviso) — Asav los junta con su papá y los captura en
  la pantalla del catálogo.
- Si Compás·flota se vende solo y a qué precio (6.27).
- Las reglas del contrato Tecma, el estado de cuenta, la matriz de permisos
  (6.29) — sesión con papá.
