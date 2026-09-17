# Ficha de construcción — Compás C3 · Recorridos y playback

Entregada el 16 de septiembre de 2026. Decisiones ratificadas por ASAV ese día,
en sesión de diseño con prototipos. Esta ficha entra al repo por PR (en
`docs/`) junto con el primer PR de C3.

**Qué es.** El renglón «Recorridos y playback» de Ver ‹unidad› / Ver
‹dispositivo› se vuelve la pantalla: el mapa con el recorrido de un periodo y
su playback honesto. Es lo que reemplaza a Umbrella del todo.

**Prototipo aprobado (referencia visual obligada):**
https://claude.ai/artifact/A9QgcfdRt9i86SPp1Rp7FB (v5). La pantalla construida
debe poder ponerse junto al prototipo sin que ASAV note diferencias de
comportamiento. Gobierna `.claude/skills/jtel-diseno/SKILL.md`; sobre él, el
Marco (en particular Pieza 1 §D/§E y Pieza 7).

---

## Las decisiones ratificadas (16-sep-2026)

1. **El filtro es una ventana de tiempo, no un día.** Desde/hasta con fecha y
   hora. La medianoche no corta nada: un turno nocturno se ve completo en una
   sola línea de tiempo. «El día» es sólo la ventana por omisión. Las flechas
   ‹ › mueven el tamaño de la ventana vigente, no «un día».

2. **Atajos en dos familias, ninguno horneado.**
   - De tiempo llano: **Hoy** (00:00 → ahora) · **Ayer** · **Últimos 7 días**
     · **Este mes**.
   - De la operación: **los servicios de esta unidad en el periodo visible**,
     no el catálogo de turnos de la cuenta. Los miles de servicios de un
     carrier grande viven en el piso de flota, no aquí: esta pantalla ya está
     parada sobre una unidad, y una unidad sirve un puñado al día.
     - **La sección es reservada** (ratificado 16-sep): sólo se dibuja si el
       carrier está ligado a al menos un contrato de especial o una
       concesión de circuito. Un carrier sin ninguno de los dos **no ve la
       sección**, ni vacía ni con mensaje — simplemente no existe para él.
     - Dos tipos de botón, uno por modalidad (Pieza 7), y un carrier con las
       dos ve ambos mezclados en la misma lista del día:
       · **Especial:** la ocurrencia del servicio — `Tecma · Poniente` con
         su ventana `06:00–14:00 · especial`. Los que cruzan medianoche se
         arman como ventana de dos días.
       · **Circuito:** el horario de servicio declarado del circuito para
         ese día — `Circuito Centro · 14:00–22:00 · circuito` (apertura a
         cierre). Un botón por circuito, no uno por vuelta ni por parada:
         la tabla de horarios por parada es material de la puerta de
         monitoreo, no de este panel.
     - ⚠ **Las horas salen de lo declarado para ESE día, nunca del perfil
       o circuito vigente hoy.** Las políticas cambian hacia adelante y el
       pasado no se reescribe (Marco): aplicar el horario de hoy a un día de
       hace tres meses produciría una ventana falsa.
     - En un carrier que sí tiene contratos, si esta unidad no tuvo
       servicios declarados ese día, se dice en corto: «Sin servicios
       declarados este día». Ahí la ausencia sí es información.
     - Cada botón debe atribuir su fuente: la ventana es **declarada por el
       contrato o la concesión**, no medida por el sistema. El código no
       conoce ningún cliente, ruta ni circuito: los lee.
   - La pantalla acepta la ventana **por URL** (p. ej. `?desde=…&hasta=…`),
     porque el atajo más valioso llega después: entrar desde un veredicto con
     la ventana del servicio ya puesta. Ese enlace se construye cuando Vernier
     se mude a la casa; la puerta queda lista desde ahora.

3. **La brocha.** Arrastrar sobre un tramo de la cinta acota la ventana a esas
   horas/minutos. Chip «Acotado a hh:mm–hh:mm» con su Quitar (regresa al día
   que contiene el inicio). Un clic sin arrastre busca (seek), no acota.

4. **La cinta de pedazos.** La barra contiene sólo tiempo medido, cada tramo
   con ancho proporcional a su duración. El hueco es una muesca fija con el
   glifo de sin señal (círculo hueco). La noche entre dos días es el mismo
   hueco con el mismo glifo — **no** es un estado nuevo.

5. **El playback se detiene en los huecos.** Al llegar al fin de un tramo con
   otro adelante: alto automático, el marcador se vuelve círculo hueco, y el
   aviso dice rango y duración («sáb 14 sep 10:18:30 → 11:00:10 · 41:40») con
   «La línea no se dibuja: nadie la midió» y el botón «Continuar en hh:mm».
   Nada cruza el hueco en el mapa, ni punteado: sólo los dos puntos huecos en
   los extremos.

6. **El cobre es del ahora, no del recuerdo.** Todo el recorrido histórico va
   en tinta (marcador incluido). El cobre aparece en el chip del estado
   actual de la unidad, y en un solo cruce: si la ventana incluye el ahora y
   el playback alcanza el último punto medido, el marcador cambia al glifo de
   estado actual en cobre y el aviso dice «Alcanzaste el ahora — esto ya no
   es grabación», con la edad corriendo de verdad.

7. **Velocidad automática con el multiplicador a la vista.** Cualquier
   ventana se reproduce en ~90 s de tiempo medido: el multiplicador se
   calcula (`tiempo con señal / 90`, mínimo ×1) y **siempre se muestra**
   («auto ×403») porque es lectura de instrumento. Tocar el botón cicla a
   manual (×30 · ×60 · ×180 · ×600) y de vuelta a auto; cambiar de ventana
   regresa a auto. Los huecos no consumen playback (son altos), así que sólo
   se comprime tiempo medido.

8. **La cámara no persigue.** El recorrido se encuadra completo una vez y la
   cámara no sigue al marcador. Es ley doble: de calma (skill) y de costo —
   un playback sin movimientos de cámara no pide un solo azulejo nuevo al
   mapa. Acercarse es decisión del usuario (pinch/zoom o la brocha).

9. **Simplificación al dibujar, jamás al guardar.** La base conserva todos
   los puntos siempre; la evidencia no se toca. Para pintar, el servidor
   simplifica por **forma** (Douglas-Peucker o equivalente), nunca por
   conteo, con esta lista de **puntos intocables** que jamás se eliminan:
   - los dos extremos de cada hueco;
   - las entradas y salidas de geocerca (horas que el árbitro ya usó);
   - el primer y el último punto de cada tramo;
   - las paradas largas (quieta más de N minutos; N en configuración, no
     horneado).
   Cuando se simplificó, la respuesta lo declara y la pantalla muestra el
   chip «Trazo simplificado para dibujarse · acota para el detalle completo».
   Acotar con la brocha vuelve a pedir el detalle real de esa ventana.

10. **Caché inmutable para lo cerrado.** Un periodo cuyo fin ya pasó de hoy
    no cambia nunca (los hechos se congelan), así que su respuesta se sirve
    con caché de larga vida/immutable. Sólo la ventana que toca hoy
    revalida. Ojo con la frontera: la clave de caché incluye la ventana y el
    grado de simplificación.

11. **La ventana vacía se dice, no se maquilla.** «Sin recorrido en este
    periodo — no hay puntos medidos entre esas dos horas. No es una falla: es
    que no se observó nada.» Sin esqueletos, sin promedios, sin ceros
    fingidos. Ojo con el peso que esto tiene dentro de la ventana de un
    servicio declarado: ahí esa frase significa que durante el servicio
    contratado la unidad no fue medida en ningún lado.
    - ⚠ **Vacío no es «no trabajó»: es «no lo vimos».** Una ventana sin
      puntos admite dos lecturas contrarias —la unidad no salió, o salió y
      nadie la midió— y la pantalla no puede dejar que se confundan (Pieza 1
      §D). Así que el vacío viene acompañado del **estado del dispositivo en
      esa ventana**, leído de las asignaciones vigentes entonces:
      · sin dispositivo asignado ese día → «esta unidad no traía dispositivo
        en ese periodo: no hay con qué saber qué hizo»;
      · con dispositivo asignado que no reportó → se dice, y se ofrece ir a
        Ver ‹dispositivo› (¿estuvo callado sólo aquí, o también en otras
        unidades?);
      · con dispositivo que sí reportó fuera de la ventana → eso ya es
        información: acota o amplía para verlo.
      Ninguna de las tres afirma que la unidad trabajó o no trabajó. Dicen
      qué se pudo medir y qué no.

13. **Lo declarado fija la ventana y nada más; no se dibuja.** Ratificado
    16-sep. El botón del servicio sirve para acotar las horas y después
    desaparece: la etiqueta del periodo muestra la ventana
    (`dom 14 sep · 06:00–14:00`), **no** el nombre del servicio, y el mapa
    no recibe ni un trazo declarado. Todo lo que se dibuja —traza, tramos,
    huecos, visitas, cifras— es medido. La pantalla nunca emite veredicto:
    Vernier dicta, Compás enseña la evidencia; el usuario compara.
    - **Pendiente con nombre, NO entra a C3:** dibujar el trazado declarado
      del contrato encima del recorrido medido, para comparar a ojo. Se deja
      fuera porque mezcla en el mismo lienzo lo observado con lo escrito en
      un contrato (la trampa del Marco), y porque esa comparación ya es el
      trabajo del árbitro — dos lugares comparando lo mismo terminan
      contradiciéndose. Si algún día entra: interruptor apagado por omisión
      y tratamiento visual imposible de confundir con lo medido. Lo decide
      Asav con la pantalla ya en uso y datos reales.

12. **Cifras del periodo:** km recorridos (sólo dentro de tramos, con la
    regla de saltos del censo), tiempo con señal, huecos (cuántos · cuánto
    suman), tramos medidos. Formatos exactos, sin redondeos con «~».

## Lo que ya existe y se reutiliza (no se reescribe)

- `recorridoDelDia`, `visitasALugares`, `lugaresDelPunto`, huecos con
  `SIN_SENAL_MINUTOS` (#424) y `cortarPorModalidad` (#426). **La
  generalización necesaria:** la lógica pura debe aceptar una ventana
  `[desde, hasta]` en lugar de una fecha — el día pasa a ser un caso de
  ventana. Misma regla, mismos umbrales, cero cambios de comportamiento para
  la ventana de un día; pruebas nuevas para ventana que cruza medianoche.
- El corte por modalidad aplica igual dentro de la ventana (Pieza 7):
  especial corta en destino, circuito no; `modalidadEn(instante)` se pregunta
  a la hora de entrada de cada visita.
- La pantalla vive dentro de Ver ‹unidad› (y Ver ‹dispositivo›, leyendo por
  las asignaciones vigentes en cada instante — un dispositivo que cambió de
  unidad a media ventana muestra cada pedazo con su unidad).
- **Aprendizaje del #429, obligatorio:** todo enlace que la pantalla emita
  arrastra la cuenta (`conCuenta`); el cuarto resuelve la cuenta y se la
  pasa al marco.

## Orden de PRs sugerido (una rama por PR, uno a la vez)

1. **PR C3-a · lógica pura, sin pantalla** — `recorrido por ventana`
   (generaliza el del día), huecos y visitas cruzando medianoche, pruebas con
   turno nocturno y con ventana acotada a minutos. *Mergea Asav (toca
   services/domain).*
2. **PR C3-b · el dato servido** — endpoint de recorrido por ventana con:
   simplificación por forma + intocables + bandera «simplificado», y caché
   inmutable para ventanas cerradas. Pruebas de que los intocables
   sobreviven cualquier simplificación. *Mergea Asav.*
3. **PR C3-c · la pantalla** — Ver ‹unidad› → Recorridos y playback según el
   prototipo v5: panel de periodo con atajos de tiempo y con los servicios de
   la unidad en el periodo (leídos de sus ocurrencias, con las horas de ese
   día), brocha, cinta, playback con altos, velocidad auto, cruce al ahora,
   las dos pieles, 375/768/1024/1440. *Revisión visual de Asav contra el
   prototipo; mergea según la regla (presentación → Devin tras visto bueno).*
4. **Aparte, otro frente (no bloquea C3):** mapa propio con **Protomaps**
   auto-hospedado en Cloudflare R2 (extracto regional), decidido 16-sep en
   lugar de MapTiler/Stadia. Va antes de las 80 unidades; C3 mientras corre
   sobre el mapa actual.

## Puntos de alto (modo «avanza y detente»)

- Al terminar C3-a: enseñar las pruebas del turno nocturno antes de seguir.
- Antes de C3-c: confirmar contra el prototipo v5 cualquier duda visual, no
  interpretarla.
- Antes de cada merge: lo de siempre — `pruebas` y `esquema` en verde, y
  ningún nombre de cuenta, cliente o turno horneado en el código.

## Enmiendas al plan (`docs/jtel-plan-de-desarrollo.md`)

Si el PR del plan aún no se mergea, van en ese mismo PR; si ya entró, en un
commit del PR C3-a:

- La línea del proveedor de mapas cambia a: «**Protomaps auto-hospedado en
  Cloudflare R2** (extracto regional) antes de las 80 unidades — decidido el
  16-sep; convierte la mensualidad en centavos. Hoy en OpenStreetMap
  directo.»
- Nuevo pendiente con nombre: «**La cadencia de reporte por tipo de
  servicio.** La frecuencia cuesta SIM y no todas las unidades necesitan la
  misma: transporte público con app de pasajero pide frecuencia alta;
  transporte especial puede reportar menos, porque al árbitro le bastan las
  entradas y salidas de geocerca. Se decide con la medición real de consumo
  de los 8 — no antes.»
- Nuevo pendiente con nombre: «**Horarios en puerta** (idea de Asav,
  16-sep). En el piso de flota / monitoreo, el tablero de lo que viene: para
  especial, la lista de servicios por salir con su ventana (como pantalla de
  aeropuerto); para circuito, los circuitos en servicio con sus tablas de
  horario por parada. Un carrier con contrato y concesión ve los dos
  registros, uno por modalidad (Pieza 7). Es un cuarto/parte propio del piso
  de flota — se diseña en su momento, con prototipo; no entra a C3.»
