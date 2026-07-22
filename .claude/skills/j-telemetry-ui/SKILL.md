---
name: j-telemetry-ui
description: Lenguaje visual y reglas de interfaz de J-Telemetry (repo asav-mx/j-tel), el árbitro automático de cumplimiento de transporte de personal. Úsalo SIEMPRE que se diseñe, construya, revise o modifique cualquier pantalla, componente, gráfico, tabla, correo o vista de J-Telemetry — cara cliente/planta, cara carrier, cara J-Staff o el landing j-tel.io. Aplícalo aunque la petición no hable de diseño; vale igual para "agrega una columna", "haz el endpoint y su pantalla", "arregla este componente", "muestra los veredictos", "hazme un gráfico de esto", "dashboard", "tabla de servicios", "vista de jornada", "preventivo", "hallazgos", "expediente", "mapa de evidencia". Si el trabajo produce algo que un humano va a ver dentro de J-Telemetry, este skill aplica.
---

# J-Telemetry — Lenguaje de interfaz

## El producto en un párrafo

J-Telemetry es un **árbitro automático**. Recibe telemetría GPS y emite un veredicto vinculante sobre si cada servicio de transporte de personal se cumplió. Empresas usan ese veredicto para decidir pagos a sus transportistas.

**El activo no es el dato: es que el veredicto sea creíble.** Una interfaz que haga dudar del veredicto destruye el producto aunque el motor sea perfecto. Todo lo que sigue existe para proteger esa credibilidad.

El sistema no acelera el trabajo de monitoreo: **lo elimina**. Lo que queda no es vigilar, es administrar lo que el sistema encontró — correctivo (lo que ya pasó y trae consecuencia) y preventivo (lo que se está formando y todavía no explota).

---

## La tesis: instrumento, no tablero

Un tablero da **señales** y el humano interpreta. J-Telemetry da **hallazgos**: ya interpretados, con su consecuencia.

De ahí sale la regla que gobierna todo:

> **Densa, sí. Cruda, jamás.**

Mostrar mucha información es correcto — el usuario administra, y para administrar necesita ver. Lo prohibido es mostrar un dato que obligue al usuario a sacar conclusiones por su cuenta. Ese dato todavía trae el puesto de monitoreo pegado.

La métrica de una pantalla no es cuántos datos tiene, sino **cuántos obligan a pensar**. La respuesta correcta es cero.

Regla práctica: **todo número va acompañado de su lectura.** Cobertura 74.2% no va solo — va junto a "umbral del contrato: 70.0%". Una llegada 06:52:14 va junto a "deadline + tolerancia: 06:50:00". El usuario lee, no calcula.

### Exactitud, no redondeo

Los tableros redondean ("~94%", "unos 7 minutos"). Los instrumentos no.

Escribe **94.2%**, **06:43:11**, **21.1%**, **7:14 min**. La precisión no es un detalle técnico: es la textura que separa medición de opinión. Un número redondeado se lee como estimación, y una estimación se discute.

---

## Las leyes (del Marco Maestro — no se negocian)

Cualquier propuesta que rompa una de estas está mal por definición, sin importar qué tan bien se vea.

1. **Tres veredictos de cara al cliente y nada más:** `cumplido` · `no cumplido` · `pendiente por evidencia`. Nunca un cuarto estado, nunca "cumplido parcial". Todo detalle fino (tarde, excusable, hueco de GPS) va como **motivo debajo** del veredicto, jamás como estado nuevo ni como color distinto del chip.
2. **El hecho se calcula una vez y se congela.** Nada en la UI puede sugerir que un veredicto se recalcula al abrir una pantalla. La única forma de que cambie es una **re-verificación explícita y auditada**, con nombre de quién la pidió y hora.
3. **Confidencialidad entre cuentas, absoluta.** Una planta jamás ve otra planta. Un carrier jamás ve otro carrier. **El cliente jamás ve la operación interna del carrier** — candidatas evaluadas, flota completa, diagnósticos, sugerencias de calibración. Si una unidad entra a la geocerca de otro cliente, el ledger registra solo `arrivalOutsideContractGeofence: true`; el nombre del otro cliente no entra a ningún expediente.
4. **La geocerca es la frontera de la evidencia.** Las trazas se cortan en `observedArrivalAt`. Lo que la unidad hizo después de llegar no se muestra a nadie, en ninguna cara. Protege al carrier y al chofer.
5. **El auditado no edita el veredicto.** El carrier aporta calibración y defensa; su input nunca cambia lo que ve el cliente.
6. **Todo umbral y tolerancia es configurable por contrato.** La UI **guarda** el acuerdo, no lo decide. Nunca hornees un número en un componente.
7. **Sin evidencia ≠ incumplimiento.** Un hueco de GPS es `pendiente`, jamás `no cumplido`. Dilo en voz alta en la interfaz cuando aplique — es lo que vuelve creíble al árbitro ante el auditado.
8. **El código nunca conoce nombres.** Ni de clientes, ni de plantas, ni de rutas, ni de calles. Los documentos y mockups sí los usan como ejemplo para comunicar. Un componente recibe cuenta, alcance y fecha; nunca sabe qué es "Planta 47".
9. **Cualquier caso real es una instancia, no una categoría.** Si una operación concreta motiva un cambio, el cambio se diseña genérico y esa operación es simplemente la primera donde disparó.

---

## Las caras y su registro

Cada una es su propio subdominio y acceso. La misma información base, presentaciones distintas — **no es la misma pantalla con permisos apagados.**

| Cara | Quién | Registro visual |
|---|---|---|
| **Cliente — corporativo** | Ve todas sus plantas | Panorama y agregado. Pantalla propia, no la de planta con filas apagadas. |
| **Cliente — planta** | Vive la operación diaria | Detalle por servicio. Instrumento denso. |
| **Carrier** | La empresa auditada | Mismo lenguaje; ve su flota y aporta calibración. |
| **J-Staff** | El operador de la plataforma | Puede ser más cruda: aquí el usuario es experto y sí quiere el razonamiento completo. El ledger completo vive aquí. |
| **Landing (j-tel.io)** | Público | **Excepción total.** No trata datos ni veredictos. Puede ser todo lo expresivo que quiera: animación, shaders, componentes de catálogo. Nada de este skill aplica ahí salvo la identidad. |

Corporativo y planta comparten **idioma** (chips, colores, tipografía, tono) pero son **pantallas distintas**, porque sus necesidades de información son distintas.

Roles funcionales dentro de la cara cliente, para etiquetar quién ejecuta cada acción: Coordinación de rutas, Cumplimiento (acepta incidentes y aprueba variantes), Inspecciones, Contrato y escalaciones.

---

## El vocabulario

### Color

Fondo de tinta, paneles de papel oscuro. La regla dura:

**Los tres colores de veredicto no se usan para nada más.** Ni botones, ni enlaces, ni gráficas, ni decoración. Si hay verde en pantalla, es un cumplido.

```
--fondo    #0A0D10   fondo de la app
--panel    #0F1318   paneles y tarjetas
--rejilla  rgba(255,255,255,.05)   rejilla de fondo de gráficos
--linea    rgba(255,255,255,.10)   separadores
--texto    #EAEEF2   lo que importa leer
--tenue    #71808F   apoyo, etiquetas, datos secundarios
--acero    #7A9CB8   TODO LO MEDIDO — trazas, líneas de tendencia, cifras de métrica
--verde    #34C77B   cumplido — nada más
--ambar    #E3A81F   pendiente por evidencia, y motivos con costo
--rojo     #E5484D   no cumplido — nada más
--azul     #4C9AE0   enlaces, avisos del sistema, acciones. Jamás un veredicto
```

**El acero separa medición de juicio.** Un dato es acero; un veredicto es verde/ámbar/rojo. Así el color nunca miente sobre qué clase de cosa estás viendo.

### Tipografía

Tres papeles, sin excepción:

- **Archivo** (600/700) — lo que se afirma: cifras grandes, títulos, la tesis de la pantalla.
- **IBM Plex Sans** (400/500) — lo que se lee de corrido.
- **IBM Plex Mono** (400/500) — todo lo que es medición: horas, unidades, porcentajes, folios, etiquetas de sección. Usa `font-variant-numeric: tabular-nums` para que las columnas de números alineen.

El mono es deliberado: hace que el dato se lea como lectura de instrumento, no como texto de aplicación.

### El chip de veredicto

Borde marcado, hueco adentro, versalitas espaciadas, mono. Se lee como una **impresión sobre papel**, no como una pastilla de colores.

```html
<span class="chip k-verde">Cumplido</span>
```
```css
.chip{ display:inline-block; border:1.5px solid currentColor; border-radius:2px;
  padding:3.5px 10px 2.5px; font-family:"IBM Plex Mono",monospace;
  font-size:10.5px; font-weight:500; letter-spacing:.13em; text-transform:uppercase }
.k-verde{ color:var(--verde); background:rgba(52,199,123,.07) }
```

**El color del chip dice el veredicto y solo el veredicto.** Un cumplido que llegó tarde va **verde**; el "tarde" vive en el motivo de abajo, en ámbar. El servicio sí se cumplió — que no se pague es consecuencia del contrato, no otro veredicto. Pintarlo ámbar mezcla verificación con enforcement.

### La marca de sellado

Va donde se muestre un veredicto. Dice cuándo se decidió y que nadie lo tocó desde entonces.

```
Sellado 06:50:00 · nadie lo ha tocado desde entonces
Re-verificado 09:14:22 · a petición de M. Ríos
```

Mono, tenue, borde punteado. Es la ley 2 hecha visible, y es el diferenciador contra el sistema anterior que recalculaba la verdad al abrir la pantalla.

---

## Anatomía de un hallazgo

Todo lo que la interfaz señala — un servicio con consecuencia, un patrón que se está formando — se arma con estas cuatro partes. **Si le falta una, vuelve a ser dato crudo.**

1. **La afirmación** — qué pasa, en una frase, como hecho. No "revisar ruta X" sino "llega cada semana un poco más tarde; lleva 4.7 minutos de deriva".
2. **La evidencia** — densa y exacta, con su gráfico propio y sus umbrales al lado.
3. **La consecuencia** — qué cuesta: dinero, servicios, un escalón de contrato. Sin esto es una alerta, no un hallazgo.
4. **La acción** — una sola, con el rol que la ejecuta al lado.

### El gráfico se elige por el dato, no por el formato

Nunca repitas la misma tarjeta para todo. El dato manda:

- **Deriva en el tiempo** — línea de tiempo: medido sólido, proyección punteada, umbral como raya, marca en el punto de cruce.
- **Proporción** — barras comparadas (31 de 44 por aquí, 13 por allá).
- **Escalón de contrato** — casillas por pasos (2 de 3 llenas, la tercera punteada).
- **Llegadas de un turno** — marcas sobre una regla de tiempo con la banda de tolerancia.

Un formato repetido para datos distintos se lee como plantilla generada. Formatos distintos para datos distintos se leen como pensado.

### Orden por horizonte, no por gravedad

En lo preventivo, ordena por **cuándo revienta** — "Ahora", "3 semanas", "2 retrasos para el escalón". Eso es lo que ningún monitorista humano podía dar: él veía hoy, el sistema ve el calendario.

Nunca numeres secciones 01/02/03 salvo que el número signifique algo real. Un número decorativo delata plantilla.

---

## Cada cosa nombra solo lo que su evidencia sostiene

Esta regla evita inventar evidencia que el árbitro no selló.

- Un `no_cumplido` **nunca tiene unidad acreditada** — por diseño, el motor solo persiste la unidad observada cuando el veredicto salió `cumplido`. Entonces una tarjeta construida sobre `no_cumplido` **no puede nombrar unidad**.
- Los hallazgos sobre **rutas** (camino candidato, catálogo desalineado, deriva) hablan de servicios, trazos y proporciones. No necesitan nombrar unidad, y no deben.
- Los hallazgos sobre **unidades** (huecos de GPS recurrentes) sí la nombran, porque vienen de cumplidos sellados donde la unidad sí está acreditada y ahí la unidad es el sujeto.

Cuando dudes si puedes mostrar un dato: pregunta si el árbitro lo selló. Si no lo selló, no lo muestres.

---

## Dos ritmos, un idioma

Mismos chips, mismos colores, mismo mono. Cambia el aire según para qué es la pantalla:

- **Aireado** — resúmenes, jornada, hallazgos. El punto es que casi nada te necesita.
- **Denso** — tablas de revisión de decenas de filas. Apretado, columnas alineadas, números en mono.

Ambos son correctos. Lo incorrecto es mezclarlos en una sola vista sin razón.

---

## Anti-patrones (esto la regresa a genérica)

Si aparece cualquiera de estos, el instrumento se disolvió de vuelta en tablero:

- Chips como pastillas rellenas de color en vez de impresiones con borde.
- Verde/ámbar/rojo usados en botones, enlaces, iconos o gráficas decorativas.
- Números redondeados o con "~".
- Un dato sin su umbral, su deadline o su comparación al lado.
- Secciones numeradas 01/02/03 sin que el número signifique algo.
- La misma tarjeta genérica repetida para cuatro clases de dato distintas.
- Componentes de catálogo (heroes, tarjetas prehechas, iconos decorativos) dentro del producto. En el landing sí; en el producto no.
- Un veredicto con animación de entrada. El movimiento solo se justifica para continuidad: una línea de proyección dibujándose, un cajón abriendo, una transición de alcance. Nunca sobre un veredicto.
- Emojis como iconos.
- Jerga técnica en las caras cliente y carrier. Los usuarios son coordinadores de transporte y HR de planta, no ingenieros. Español mexicano de operación.

---

## Antes de entregar

- [ ] ¿Solo aparecen los tres veredictos, con el detalle como motivo debajo?
- [ ] ¿Cada número tiene su lectura al lado (umbral, deadline, comparación)?
- [ ] ¿Nada sugiere que el veredicto se recalcula al abrir?
- [ ] ¿Los colores de veredicto están reservados solo para veredictos?
- [ ] ¿Cada hallazgo tiene sus cuatro partes?
- [ ] ¿Ningún nombre de cliente, planta o ruta está horneado en el componente?
- [ ] ¿La cara cliente está libre de operación interna del carrier?
- [ ] ¿Las trazas se cortan en la llegada a geocerca?
- [ ] ¿Todo umbral viene de la política del contrato, no de una constante?
- [ ] Oficio: foco visible con teclado, contraste ≥ 4.5:1, `prefers-reduced-motion` respetado, responsivo en 375 / 768 / 1024 / 1440, cursor de mano en lo clickeable, iconos SVG (Lucide) y no emojis.

---

## Cómo se trabaja este repo

- Repo `asav-mx/j-tel`. Una rama por tarea, todo entra por Pull Request, nunca directo a `main`.
- Si dos asistentes trabajan a la vez, se reparten **por área y no por archivo**.
- Antes de tocar lógica del árbitro o escrituras al ledger: **parada obligatoria** para aprobación humana explícita.
- El repo congelado `jrz-drone-os` es fuente de datos históricos únicamente. Nunca referencia de código ni de diseño.
- El `Marco-Limpio-J-Telemetry-MAESTRO.md` manda sobre este skill. Si algo aquí choca con el Marco, gana el Marco.
