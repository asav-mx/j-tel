---
name: j-telemetry-ui
description: Lenguaje visual y reglas de interfaz de J-Telemetry (repo asav-mx/j-tel), el árbitro automático de cumplimiento de transporte de personal. Úsalo SIEMPRE que se diseñe, construya, revise o modifique cualquier pantalla, componente, gráfico, tabla, correo o vista de J-Telemetry — cara cliente/planta, cara carrier, cara J-Staff o el landing j-tel.io. Aplícalo aunque la petición no hable de diseño; vale igual para "agrega una columna", "haz el endpoint y su pantalla", "arregla este componente", "muestra los veredictos", "hazme un gráfico de esto", "dashboard", "tabla de servicios", "vista de jornada", "preventivo", "hallazgos", "expediente", "mapa de evidencia". Si el trabajo produce algo que un humano va a ver dentro de J-Telemetry, este skill aplica.
---

# J-Telemetry — Lenguaje de interfaz

## La tesis: la calma es la competencia

**La calma es la competencia.** Un centro de control aeroespacial no grita aunque
haya una anomalía — la serenidad *es* la señal de que todo está bajo control. Las
superficies de J-Telemetry se sienten así: frías, precisas, sin pánico. El gerente
abre a las 6 de la mañana y la pantalla le dice, sin levantar la voz, "tenemos esto".

El desmadre de la operación ya lo resolvió el motor. El trabajo del diseño no es
**agregar** calma con decoración — es **no estorbarle** a la calma que el producto
ya produjo. Cada elemento que no comunica un hecho, se va.

Si la pantalla grita, está mal.

---

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

En el expediente, "todo número con su lectura" significa la **medición JUNTO a su umbral**, nunca uno sin el otro: "cobertura 94.2% · umbral del contrato 60.0%". Mostrar solo el umbral (la regla) o solo la medición es medio dato. Igual con las etiquetas: no "Temprano" sino "Temprano · 10 min antes". El carrier que se defiende necesita ver por cuánto pasó o falló — esa es la mitad que decide si el árbitro le parece justo.

### Exactitud, no redondeo

Los tableros redondean ("~94%", "unos 7 minutos"). Los instrumentos no.

Escribe **94.2%**, **06:43:11**, **21.1%**, **7:14 min**. La precisión no es un detalle técnico: es la textura que separa medición de opinión. Un número redondeado se lee como estimación, y una estimación se discute.

**Fechas completas en evidencia.** En cualquier contexto que sirva de evidencia (expediente, bitácora, historia del sello, lectura de hechos), toda hora lleva su fecha completa: `2026-07-24 05:40`, nunca solo `05:40`. Un turno nocturno cruza la medianoche, y una hora sin fecha no sostiene un caso.

**Las duraciones se escriben como duraciones, nunca con formato de hora.** Un delta dice `10 min antes`, `2 h 14 min de retraso` — jamás `10:00 antes`, que se lee como hora del día. La regla completa: los instantes llevan fecha; los intervalos llevan unidad.

---

## Las leyes (del Marco Maestro — no se negocian)

Cualquier propuesta que rompa una de estas está mal por definición, sin importar qué tan bien se vea.

1. **Tres veredictos de cara al cliente y nada más:** `cumplido` · `no cumplido` · `pendiente por evidencia`. Nunca un cuarto estado, nunca "cumplido parcial". Todo detalle fino (tarde, excusable, hueco de GPS) va como **motivo debajo** del veredicto, jamás como estado nuevo ni como color distinto del chip.
2. **El hecho se calcula una vez y se congela.** Nada en la UI puede sugerir que un veredicto se recalcula al abrir una pantalla. La única forma de que cambie es una **re-verificación explícita y auditada**, con nombre de quién la pidió y hora.
3. **Confidencialidad entre cuentas, absoluta.** Una planta jamás ve otra planta. Un carrier jamás ve otro carrier. **El cliente jamás ve la operación interna del carrier** — candidatas evaluadas, flota completa, diagnósticos, sugerencias de calibración. Si una unidad entra a la geocerca de otro cliente, el ledger registra solo `arrivalOutsideContractGeofence: true`; el nombre del otro cliente no entra a ningún expediente. (En mapas esto se hace cumplir por capa — ver "Mapas · Audiencia declarada por capa".)
4. **La geocerca es la frontera de la evidencia.** Las trazas se cortan en `observedArrivalAt`. Lo que la unidad hizo después de llegar no se muestra a nadie, en ninguna cara. Protege al carrier y al chofer.
5. **El auditado no edita el veredicto.** El carrier aporta calibración y defensa; su input nunca cambia lo que ve el cliente.
6. **Todo umbral y tolerancia es configurable por contrato.** La UI **guarda** el acuerdo, no lo decide. Nunca hornees un número en un componente.
7. **Sin evidencia ≠ incumplimiento.** Un hueco de GPS es `pendiente`, jamás `no cumplido`. Dilo en voz alta en la interfaz cuando aplique — es lo que vuelve creíble al árbitro ante el auditado.
8. **El código nunca conoce nombres.** Ni de clientes, ni de plantas, ni de rutas, ni de calles. Los documentos y mockups sí los usan como ejemplo para comunicar. Un componente recibe cuenta, alcance y fecha; nunca sabe qué es "Planta 47".
9. **Cualquier caso real es una instancia, no una categoría.** Si una operación concreta motiva un cambio, el cambio se diseña genérico y esa operación es simplemente la primera donde disparó.

### La maquinaria de identificación no se enseña

Hay que separar dos clases de número, porque el original las confundía:

**Medición del hecho — Sí va en cara cliente.** Cobertura de la ventana, margen contra el deadline, hueco máximo de señal: son evidencia del servicio, y van junto a su umbral. Un resultado sin su medida es una acusación sin prueba.

**Maquinaria de identificación — NUNCA va en cara cliente.** Los puntajes de candidatas (`A—82 / B—39`), el razonamiento de eliminación, las unidades que se consideraron y se descartaron. Eso es cómo el motor decidió qué unidad era — y además revela la flota del carrier, así que también lo prohíbe la Ley 3 del Marco.

La distinción: **qué se midió del servicio** es evidencia; **cómo se decidió qué unidad era** es cocina. La evidencia se muestra; la cocina vive en la bitácora técnica del expediente, y del lado carrier.

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

### La leyenda de la torre

Toda superficie en vivo lleva esta leyenda **permanentemente visible**, no como disclaimer chico al pie:

> **Vista en vivo. El resultado se emite al cierre.**

Es lo que impide que una unidad que "llegó" a las 06:40 se lea como un resultado cuando el árbitro todavía no cierra. La torre reporta hechos en curso; el acta emite resultados. Esa frontera se declara en pantalla, siempre.

---

## La arquitectura de la plataforma

J-Telemetry no es un conjunto de páginas: es una plataforma sobre la que se van a
montar más cosas. Eso tiene que sentirse al abrirla, y se logra con tres piezas
estructurales que no son negociables.

### 1 · Navegación lateral permanente

Toda superficie interna (cliente, carrier, J-Staff) lleva una columna de navegación
fija a la izquierda, de 230px, siempre presente. No barras de botones arriba, no
menús que aparecen y desaparecen.

De arriba abajo lleva, en este orden:

1. **Identidad del producto** — el logotipo.
2. **Selector de cuenta** — qué planta, campus o carrier estás viendo, en una caja
   propia. Responde "dónde estoy parado" antes de cualquier otra cosa.
3. **Las secciones, agrupadas por naturaleza** con encabezados en mono tenue
   (`Operación` · `Contrato` · `Vistas`). El grupo comunica de qué está hecha la
   plataforma.
4. **Identidad de quién eres** — abajo, fija: avatar, nombre y rol. Mientras no
   exista autenticación, el rol; con `auth-rbac`, el nombre propio, sin cambiar el
   componente.

Reglas de la navegación:

- La sección actual se marca con fondo tenue **y una barra de acero de 2px pegada
  al borde izquierdo**. Nunca solo con negritas.
- Los módulos **no contratados se muestran atenuados con su candado**, jamás se
  esconden. El usuario debe saber de qué es capaz la plataforma aunque no lo tenga.
- Un contador —pendientes abiertos, por ejemplo— va como pastilla ámbar a la
  derecha del renglón. Es el único adorno permitido en la navegación.

En pantallas menores a 720px la columna se colapsa; qué la reemplaza se decide
cuando se diseñe móvil, que es requisito y no extra.

### 2 · Jerarquía: una grande y el resto chico

**Prohibido que todo pese lo mismo.** Una pantalla donde todos los bloques tienen
el mismo tamaño y el mismo tono es un directorio, no un producto.

Cada vista declara **una zona dominante** —lo que el usuario vino a ver— y el resto
la acompaña, más chico y más callado.

| Vista | Domina | Acompaña |
|---|---|---|
| Inicio | La bandeja de lo que te necesita hoy | Widgets de sección, un renglón |
| Cumplimiento | La retícula ruta × día | Métricas arriba, desgloses abajo |
| Expediente | El veredicto y su razón medida | Mapa, cronología, identidades |

**La regla que protege la tesis:** en el inicio, la bandeja manda y los widgets
acompañan. Si los widgets crecen más que la bandeja, la pantalla se convierte en un
tablero de monitoreo — que es exactamente lo que el producto existe para eliminar.

### 3 · De macro a micro, y siempre comprobable

Toda vista se organiza en tres escalones, de arriba hacia abajo:

- **Macro** — la respuesta en una cifra. `95.4%`
- **Medio** — el patrón: dónde y cuándo. La serie diaria, la retícula, la línea de vida.
- **Micro** — el hecho individual con su evidencia. Un servicio y su expediente.

**Y la regla dura: el camino hacia abajo tiene que existir y ser visible.** Ninguna
cifra puede quedarse cerrada. Un porcentaje que no se puede descomponer hasta el
hecho sellado que lo sostiene es exactamente lo que J-Telemetry vino a reemplazar —
un número que hay que creer porque sí.

Esto no significa llenar la pantalla de enlaces: significa que en cada escalón se ve
cómo bajar al siguiente. En la práctica:

- Las celdas de una retícula son clicables y lo parecen (crecen al pasar encima).
- Al elegir un elemento aparece un **puente**: un panel que confirma qué elegiste,
  con sus medidas clave y los botones para entrar al expediente completo.
- El expediente es **pantalla propia**, no un cajón. Necesita el ancho completo para
  el mapa, la cronología y el sello.
- Dentro del expediente, cada identidad mencionada —ruta, unidad, contrato, turno—
  es a su vez puerta a su propio expediente. La cadena se vuelve red.

### 3.b · El contexto de navegación viaja con el enlace

Una pantalla de detalle debe saber **desde dónde la abrieron y qué lista estaba recorriendo el
usuario** — no solo qué registro mostrar. El contexto se pasa en la dirección de la página, como
cuando una búsqueda recuerda sus filtros al volver.

Con eso, tres cosas salen solas:

- Las migas dicen la verdad: `Cierre del turno › Sierra Vista 3 › 2026-07-23`, y no siempre el
  mismo camino inventado.
- El regreso devuelve **a donde estabas**, con los filtros puestos.
- Aparece `‹ anterior · siguiente ›` para recorrer los hermanos de esa lista sin volver al índice.

Es barato al construirse y caro de retrofitear: una pantalla de detalle nacida sin contexto
obliga a tocar después todas las que llevan a ella.

### 3.c · Lo resuelto se marca, no se borra

Una lista de trabajo muestra **el conjunto completo**, no solo lo que falta. Los elementos
atendidos se quedan, con su marca y su dato — *"Llegó 14:06"* — en la parte de arriba.

Borrarlos deja al usuario sin saber si algo se resolvió o si nunca existió, y le quita la
referencia de cuánto lleva del total. La bandeja del inicio es la excepción deliberada: ahí
llegar a cero **es** la meta, y el vacío tiene su propia forma.

### 4 · El control de tiempo cambia la forma, no solo el contenido

Cualquier vista con rango de fechas ofrece: **Hoy · 7 días · Mes · Personalizado**
(con dos campos de fecha). Aplica igual a cara cliente y cara carrier.

Y lo que se dibuja cambia con el rango:

- **Un día** no se dibuja como retícula: es la **lista** de sus servicios, con hora
  y margen. Una retícula de una columna no dice nada.
- **7 días** son columnas anchas con todos los días rotulados.
- **Un mes** son columnas angostas, rotulando de cinco en cinco.

**Todas las cifras de la pantalla se recalculan con el rango.** Si el porcentaje de
una ruta dice lo mismo en "mes" que en "7 días", está mintiendo sobre lo que muestra.

Los filtros —periodo, turno, resultado, ruta, búsqueda— viven juntos en una barra
bajo el encabezado, y **acotan la vista completa a la vez**: métricas, gráficas y
retícula. Nunca un filtro que solo afecte a un bloque.

### 5 · Densidad con aire

El registro es Linear y Vercel: denso pero respirado. Concretamente:

- Paneles con `border-radius: 10px`, borde de 1px, sobre `--panel`.
- El panel dominante puede llevar un degradado sutil hacia `--panel2` para ganar
  peso sin usar color.
- Espaciado interno generoso (17–22px); entre secciones, 26px.
- Las cifras grandes en Archivo 800, con `letter-spacing:-.03em` y
  `font-variant-numeric: tabular-nums`.
- **Sparklines permitidas** bajo una cifra: son medición, van en acero, y muestran
  la historia del número sin ocupar una gráfica entera.

### 6 · Las métricas sí se muestran, y siempre en acero

Un instrumento sin números no es un instrumento. Métricas, series, sparklines,
barras de distribución y porcentajes **van todos en acero**, porque son medición.

Los tres colores de veredicto aparecen **únicamente** donde hay un resultado de un
servicio: el chip del expediente, las celdas de la retícula, el punto de un renglón
de bandeja. Nunca en una métrica agregada, por más que un 95.4% "se sienta" bueno.

Un agregado no es un veredicto: es un promedio de veredictos, y pintarlo de verde
mentiría sobre qué clase de cosa es.

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

### Los dos temas

El producto tiene **tema oscuro** (el canónico, el de arriba) y **tema claro**. Son
el mismo idioma con otra luz: mismos roles, mismos nombres de token, distintos
valores. Ninguna regla de color cambia entre temas.

El tema claro se activa con `[data-tema="claro"]` en `<html>`:

```css
[data-tema="claro"]{
  --fondo:#F4F6F8;   --panel:#FFFFFF;  --panel2:#F0F3F6;  --nav-bg:#ECEFF3;
  --linea:rgba(16,26,36,.11);          --linea-fuerte:rgba(16,26,36,.20);
  --rejilla:rgba(16,26,36,.06);
  --texto:#111820;   --tenue:#5A6874;  --acero:#3D6A8F;
  --verde:#1B8A54;   --ambar:#9A6A05;  --rojo:#B4262B;    --azul:#2A6FB5;
}
```

`--rejilla` no tenía gemelo claro: en oscuro vale `rgba(255,255,255,.05)`, que sobre
un panel blanco es blanco sobre blanco — rejilla invisible. Su valor claro está
**derivado, no validado en mockup**: sale de la misma proporción que en oscuro (≈½ de
`--linea`). Se ajusta cuando alguien vea `microscopio-ruta.tsx` en tema claro.

**Por qué los colores de veredicto cambian de valor.** El verde `#34C77B` y el ámbar
`#E3A81F` son luminosos: sobre fondo blanco pierden contraste y dejan de leerse. Las
versiones claras son más oscuras y saturadas para sostener el contraste, pero siguen
siendo reconociblemente verde, ámbar y rojo — la ley de color depende de que un
verde se lea como verde en cualquier tema.

Lo mismo con el acero: `#7A9CB8` en oscuro, `#3D6A8F` en claro. Sigue siendo el
color de "esto es medición".

### Tokens derivados — la regla que hace esto barato

Además de los colores base, hay tokens para **tintes de fondo, bordes suaves y
tramas**. Existen porque un `rgba(255,255,255,.05)` escrito a mano funciona en
oscuro y desaparece en claro.

```
--t-acero    fondo tenue de acero (chips activos, avatares, sparklines)
--t-acero2   fondo de acero más presente (barras, segmentos llenos)
--t-ambar    fondo tenue de ámbar (pastillas, marcas de pendiente)
--t-rojo     fondo tenue de rojo (marcas de no cumplido)
--t-verde    fondo tenue de verde (chip de cumplido, marcas de resultado)
--b-acero    borde suave de acero
--b-ambar    borde suave de ámbar
--b-rojo     borde suave de rojo
--b-verde    borde suave de verde
--linea-tenue  separador apenas insinuado (la mitad de --linea)
--hover      fondo de hover y zonas neutras (patio, pistas vacías)
--rayado     franja de las tramas diagonales (unidad en taller)
--nav-bg     fondo de la navegación lateral
```

**Regla dura: ningún componente escribe un color a mano.** Ni `#hex`, ni
`rgba(255,255,255,…)`, ni `rgba(122,156,184,…)`. Todo sale de un token.

Si un componente necesita un tinte que no existe, **se agrega el token a las dos
paletas** — nunca se resuelve con un valor literal. Un solo color a mano rompe el
tema claro en ese punto y nadie lo nota hasta que alguien cambia de tema.

**Cada token existe en las dos paletas, sin excepción.** Un token definido en un solo
tema produce un color que desaparece o se invierte al cambiar — blanco sobre blanco,
borde negro sobre fondo negro. Es un error silencioso: no rompe la compilación, solo
hace ilegible una pieza en un tema, y nadie lo nota hasta verlo.

Se verifica en automático: **cada token de color debe aparecer exactamente dos veces
en el CSS.**

```bash
for t in fondo panel panel2 nav-bg rejilla linea linea-tenue linea-fuerte texto tenue \
         acero verde ambar rojo azul t-acero t-acero2 t-verde t-ambar t-rojo \
         b-acero b-verde b-ambar b-rojo hover rayado; do
  n=$(grep -cE -- "--$t:" apps/web/src/app/globals.css)
  [ "$n" = "2" ] || echo "DESPAREJO: --$t aparece $n vez/veces"
done
```

### El interruptor

- Vive **abajo en la navegación lateral, junto al usuario y el engrane**. Es
  preferencia personal, no una acción de la pantalla.
- Arranca siguiendo la preferencia del sistema operativo
  (`prefers-color-scheme`), y una vez que el usuario elige, se recuerda por usuario.
- La transición entre temas es sobria: `transition: background .18s` en la raíz.
  Nada de animaciones elaboradas.

### Qué NO cambia entre temas

- **Los roles de color.** Verde sigue siendo solo cumplido; acero sigue siendo solo
  medición; azul jamás es un veredicto.
- **La jerarquía.** La zona dominante domina igual en los dos.
- **Los mapas y superficies de evidencia oscuras** conservan su fondo profundo en
  ambos temas: una traza sobre mapa necesita fondo oscuro para leerse, y ese lienzo
  es evidencia, no interfaz.

**El acero separa medición de juicio.** Un dato es acero; un veredicto es verde/ámbar/rojo. Así el color nunca miente sobre qué clase de cosa estás viendo.

**Cuando una medición se compara contra su umbral, la medición va en acero y el color de estado
marca únicamente la brecha.**

En la barra de cobertura de un pendiente: lo observado (48.9%) es **acero sólido**, porque es
medición; lo que faltó para llegar al mínimo es **ámbar rayado**, porque esa carencia es la
razón del estado. La línea del umbral marca dónde estaba la exigencia del contrato.

Pintar la barra completa de ámbar confunde el dato con el fallo: la cobertura no es un veredicto,
es lo que el instrumento alcanzó a ver. Aplica igual al margen contra el deadline, al hueco de
señal y a cualquier medida futura con umbral.

**Los estados operativos (activa/legacy, encendido/apagado, conectado/sin señal) usan acero y tenue. Verde, ámbar y rojo jamás marcan estados operativos — solo veredictos y sus consecuencias.**

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
Verificado y sellado · 2026-07-24 06:50:00
Verificado de nuevo · 2026-07-24 09:14:22 · a petición de J-Staff
```

Mono, tenue, borde punteado. Es la ley 2 hecha visible, y es el diferenciador contra el sistema anterior que recalculaba la verdad al abrir la pantalla.

### La historia del sello

Un resultado puede verificarse más de una vez. Cuando genera versión, el expediente lo cuenta — nunca lo esconde. Dos formas:

- **Verificado y sellado** (lo normal, la mayoría): marca gris punteada con su fecha, sin cajón. El silencio es el mensaje.
- **Verificado de nuevo** (hubo versión): marca **azul**, con la causa. Se abre un cajón "Historia del sello · N versiones" con la vigente arriba (con su firma y motivo) y la anterior tachada pero legible.

**Quién y por qué son dos datos distintos, y el motor guarda ambos:**

- **Quién** (el actor): una persona, o un proceso del sistema.
- **Por qué** (la intención): una decisión, o mantenimiento.

La pantalla lee la intención guardada — NUNCA la adivina del nombre del actor. El caso que lo demuestra: un script que corre un operador a mano es nombre de proceso con intención de decisión. Si la pantalla dedujera del nombre, mentiría.

Cómo se muestra cada combinación en la versión:

| Actor | Intención | En pantalla |
|---|---|---|
| Persona | Decisión | La causa + la firma ("tras aceptar IN-0312 · J-Staff") |
| Proceso | Decisión | La causa + el nombre del proceso ("re-verificación manual · CLI") |
| Proceso | Mantenimiento que CAMBIÓ el resultado | El nombre del proceso como firma |

(Mantenimiento que no cambia el resultado no genera versión — no aparece aquí.)

**La regla:** lo que decide o cambia el resultado se ve; lo que solo lo mantiene se registra en el ledger y no aparece en pantalla. La distinción NO es humano/máquina — es decidió/mantuvo. **Ninguna versión del sello se borra jamás.**

**Realidad pre-autenticación:** hasta que exista auth-rbac, el sistema sabe que fue una persona pero no cuál — el identificador viaja vacío. La firma honesta mientras tanto es el rol ("J-Staff"), nunca un nombre inventado ni un campo que finja precisión. Cuando auth-rbac exista, la firma se completa sola con el nombre real. Ningún mockup ni ejemplo del skill debe mostrar nombres propios de firmante hasta entonces.

Miniatura: dondequiera que aparezca un resultado verificado de nuevo fuera del expediente (tabla de Cumplimiento, Cierre del turno), un punto azul junto al chip lo indica sin abrir nada.

---

## La voz — cómo se nombran las cosas en pantalla

Dos verbos son de la casa y todo cuelga de ellos: **verificar** (lo que hace el sistema) y **sellar** (lo que congela el hecho). Nada de lenguaje de juzgado en las caras de cliente y carrier.

| No se escribe en pantalla | Se escribe | En la marca |
|---|---|---|
| Veredicto | **Resultado** | cumplido · no cumplido · pendiente por evidencia |
| "Sellado, nadie lo ha tocado" | **Verificado y sellado** | Verificado y sellado · 2026-07-24 06:50:00 |
| Re-verificado / re-juicio | **Verificado de nuevo** + la causa | Verificado de nuevo · 2026-07-24 09:14:22 · tras aceptar IN-0312 · J-Staff |
| Sustituido / vigente | **anterior / vigente** | Historia del sello · 2 versiones |

**"Veredicto" sigue siendo el término del motor y del Marco** — es correcto en código, en el schema y en la lógica del árbitro. Simplemente no se escribe en una pantalla que ve el cliente o el carrier. La interfaz habla llano; el motor conserva su jerga.

El silencio es mensaje: si la marca solo dice "Verificado y sellado" con su fecha, la ausencia de más texto significa que no hubo más. No hace falta prometer que nada cambió.

### La pantalla no le explica al usuario quién es

Escribir *"declarado por el transportista"* en la cara del transportista lo pone en posición de
vigilado dentro de su propia casa. Y *"el cliente nunca ve el recorrido posterior"* en la cara
del cliente le habla de sí mismo en tercera persona.

**Los datos se enuncian sin sujeto.**

| No | Sí |
|---|---|
| "datos declarados por el transportista" | "configuración y datos de alta" |
| "declarado por el transportista, no medido" | "el chofer se declara · el GPS identifica unidades" |
| "el cliente nunca ve movimiento posterior" | "la traza corta al entrar a la geocerca" |
| "Tus clientes" / "Mis clientes" | "Clientes" |

**La frontera de confidencialidad se menciona una sola vez por pantalla, al pie**, y describe el
sistema, no a las partes: *"nada de esta pantalla llega a los clientes"*. Repetirla en cada
sección la convierte en una advertencia y sugiere que hay algo que ocultar.

**Excepción: los correos sí hablan en segunda persona.** Un correo es un mensaje dirigido a
alguien, no un instrumento — ahí *"tus clientes no ven tus asignaciones"* es correcto.

---

## Anatomía de un hallazgo

Todo lo que la interfaz señala — un servicio con consecuencia, un patrón que se está formando — se arma con estas cuatro partes. **Si le falta una, vuelve a ser dato crudo.**

1. **La afirmación** — qué pasa, en una frase, como hecho. No "revisar ruta X" sino "llega cada semana un poco más tarde; lleva 4.7 minutos de deriva".
2. **La evidencia** — densa y exacta, con su gráfico propio y sus umbrales al lado.
3. **La consecuencia** — qué cuesta: dinero, servicios, un escalón de contrato. Sin esto es una alerta, no un hallazgo.
4. **La acción** — una sola, con el rol que la ejecuta al lado.

**La lectura no dictamina.** Cuando el sistema adjunta evidencia a algo que las partes van a disputar (una queja, una defensa), adjunta hechos y **declara explícitamente qué NO responde**. Formato obligatorio: lo que la evidencia dice (medido, exacto) + lo que la evidencia no responde. El sistema hace imposible mentir; no falla a favor de nadie.

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

### Lo inferido no se presenta como declarado

Identificar qué unidad cubrió una ruta es una **inferencia que acumula confianza**, no un dato
que alguien declaró. Mientras el turno corre, esa asociación se está formando.

- **En vivo:** la unidad se marca `probable`, con la etiqueta visible junto al identificador.
  La pantalla declara además, en una línea: *"el sistema infiere qué unidad cubre cada ruta a
  partir de su recorrido; se confirma al cierre"*.
- **Al cierre:** la unidad pasa a `confirmada`, congelada junto con el resultado.

Escribir "U-208" a secas en la torre afirma como hecho algo que el motor todavía está
resolviendo. Es la misma falta que pintar un veredicto antes del cierre.

### Llegar es un hecho medido; cumplir es un veredicto

Cuando una unidad entra a la geocerca, eso **se puede afirmar**: se midió. Pero no es un
resultado — el resultado necesita el deadline, la cobertura y el cierre.

Por eso la etiqueta de llegada en vivo dice **"Llegó 14:06" y va en acero**, nunca en verde ni
con la palabra "cumplido". El verde llega al cierre, o no llega.

### El instrumento no dice más de lo que ve, y lo dice cuando no ve

Si una unidad lleva veinte minutos sin señal, su llegada estimada se muestra como `—`, no como
una hora calculada sobre datos viejos. **Un hueco declarado vale más que un número inventado.**

---

## Dos ritmos, un idioma

Mismos chips, mismos colores, mismo mono. Cambia el aire según para qué es la pantalla:

- **Aireado** — resúmenes, jornada, hallazgos. El punto es que casi nada te necesita.
- **Denso** — tablas de revisión de decenas de filas. Apretado, columnas alineadas, números en mono.

Ambos son correctos. Lo incorrecto es mezclarlos en una sola vista sin razón.

---

## Mapas

**Todo mapa se construye como capas apagables, nunca como dibujo fijo.** Cada tipo de data es una capa independiente que se prende y apaga: recorridos, trazados contratados, resultados con consecuencia, huecos de señal, quejas, geocercas, kilómetro muerto. Un mapa que dibuja todo junto y fijo se vuelve ilegible en cuanto crece.

**Excepciones por default.** El mapa arranca mostrando solo lo que requiere atención; lo que cerró limpio se enciende a demanda. Catorce rutas encimadas no son un mapa, son un espagueti — y el problema no se resuelve dibujando mejor, se resuelve no dibujando lo que ya está bien. Mismo principio que la lista: excepciones primero, lo limpio en cajón.

**Las capas se agrupan por pregunta, no por tipo de dato** (la operación · los resultados · lo cualitativo · el territorio), para que el usuario piense "qué quiero saber" y no "qué archivo prendo".

**Las capas de fase futura se muestran apagadas con su requisito** ("Demanda por zona · requiere conteo"). El instrumento enseña lo que va a poder hacer.

Colores: cada capa obedece la regla general — medición en acero, resultados en verde/ámbar/rojo, avisos del sistema en azul. Por eso las capas se pueden mezclar sin volverse ruido: el color siempre dice qué clase de cosa se está viendo.

### El mapa solo aparece cuando lo que muestra es confiable

Un mapa comunica "esto es lo que está pasando ahora". Cuando eso deja de ser cierto, el mapa
miente aunque cada píxel sea correcto.

- **Con operación en curso:** mapa completo, unidades sobre sus rutas.
- **Sin turno activo:** mapa **quieto** — ciudad, geocerca del destino, rutas del siguiente turno
  insinuadas. Da continuidad y anticipa lo que viene, con su etiqueta: *"sin unidades en ruta"*.
- **Cuenta nueva:** **sin mapa.** No hay geocercas ni rutas que dibujar; el espacio lo ocupa el
  camino a la primera verificación.
- **Sistema sin señal:** **sin mapa, ni siquiera con la última posición conocida.** Un camión
  dibujado cerca de la planta se lee como "va llegando" aunque el dato sea de hace dos horas.
  La ausencia del mapa es la declaración más honesta de que no hay nada que ver.

La pantalla conserva su estructura en los cuatro casos: lo que cambia es qué ocupa el lugar del
mapa, no el esqueleto de la vista.

### Audiencia declarada por capa (ley del Marco, no preferencia)

**Cada capa declara su audiencia: carrier · planta · corporativo · J-Staff.**

Un mapa por capas apagables es un multiplicador de riesgo de confidencialidad: si las capas se prenden y apagan, tarde o temprano alguien prende una capa de carrier en una vista de planta. El Marco es tajante — el cliente jamás ve la operación interna del carrier, y el trazo se corta en la llegada.

- **La audiencia la hace cumplir el código, no el diseño.** No es un filtro visual ni una decisión de quien arma la pantalla: la capa no existe para quien no le corresponde.
- **Una capa sin audiencia declarada no se construye.**
- Ejemplo: kilómetro muerto es capa de carrier y solo de carrier. Recorrido posterior a la geocerca no es capa de nadie del lado cliente.

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
- **La lista de enlaces disfrazada de inicio.** Un menú de secciones apilado en
  renglones cumple todas las reglas de color y voz y aun así no es un producto:
  es un directorio. Si una vista no tiene zona dominante, navegación lateral ni
  camino visible hacia la evidencia, está mal aunque cada regla suelta se cumpla.
- **El color escrito a mano.** Un `rgba(255,255,255,.05)` de fondo funciona en
  oscuro y desaparece en claro; un `#0C0F13` deja la navegación negra sobre un
  producto blanco. Cada valor literal es un punto donde el tema claro se rompe sin
  que nadie lo note. Si falta un tinte, se agrega el token a las dos paletas.
- **La certeza prestada.** Presentar como hecho algo que el sistema todavía está infiriendo: la
  unidad de una ruta antes del cierre, una llegada estimada calculada sobre señal vieja, una
  posición de hace dos horas dibujada en un mapa en vivo. Cada una es correcta en sus datos y
  falsa en lo que comunica. Si el motor no ha terminado de decidir, la pantalla lo dice.

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
