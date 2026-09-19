# Ficha de construcción · Expedientes V2 — el archivero

**Qué es esta ficha.** No reemplaza a `docs/Ficha-Expedientes.md` (16-sep): la **extiende**. Todo lo decidido ahí sigue vigente — las cuatro familias de cada expediente, los tres estados de una parte, la vigencia de los papeles, el catálogo por mercado. Esta ficha cambia **la puerta**: cómo se llega a un expediente cuando hay 84 unidades y no tres.

Si las dos fichas parecen contradecirse, gana la del 16-sep en todo lo que es el expediente, y ésta en todo lo que es la puerta. Si la contradicción es real, **pregunta antes de elegir**.

**Referencia visual obligada:** el prototipo (https://claude.ai/artifact/86JeY5fcXyDhh85PHv5iwQ), aprobado por Asav el 19-sep. Lo que esta ficha no diga, lo dice el prototipo. Si los dos callan, pregunta.

**Proceso:** rama propia, PR aparte. Plan antes de código. Checks verdes no son aprobación. El merge es de Asav: esto cambia la puerta de un cuarto que ya rueda.

---

## 1 · El problema que resuelve

Hoy Expedientes es una lista corrida: 84 unidades, luego 7 equipos, luego choferes. Encontrar una cosa es imposible, y la pestaña **Dispositivos** repite el mismo contenido en otro lugar.

Dos defectos, un arreglo: **tablero primero, cajón después.**

Nota de escala, de Asav (19-sep): 84 unidades es una flota **normal**, no grande. El diseño se hace para ese tamaño como caso típico — nada de paginar: densidad y buen orden.

## 2 · Nivel 1 — el tablero

El cuarto abre en una sola pantalla, sin listas largas. De arriba abajo:

**El buscador que atraviesa el archivero.** Una caja que busca en **todos los cajones a la vez**: unidad por número, placa o VIN; equipo por nombre, IMEI o unidad donde está; chofer por nombre o licencia. Mientras hay texto, el tablero se reemplaza por los resultados agrupados por cajón (`Unidades · 3`, `Equipos · 1`). Al borrar el texto, vuelve el tablero. Búsqueda de todas las palabras, como en Vernier.

Esta caja es la vía rápida y va **arriba de todo**: la mayoría de las veces se viene por una cosa concreta.

**«Piden atención».** Las piezas que necesitan algo, **de todos los tipos juntos**: unidades con papeles vencidos, por vencer o faltantes (§4 de la ficha vieja), y equipos sin señal. Es la bandeja del día. Si no hay nada, la sección lo dice y no se esconde (§3 de la ficha vieja: una sección vacía se declara).

**Los cajones.** Tres tarjetas: `Unidades` · `Equipos` · `Choferes`. Cada una con su cifra grande, y debajo su resumen en una línea — lo que pide algo primero (`3 piden algo · 81 al día`, `2 sin señal · 3 en unidad · 4 en bodega`). Un cajón vacío no se esconde: dice `Sin choferes dados de alta`.

## 3 · Nivel 2 — un cajón

Miga de pan de regreso al tablero. Título, subtítulo con la cifra y lo que pide algo, y **el botón de alta arriba a la derecha** (`＋ Dar de alta una unidad`, `＋ Registrar un equipo`, `＋ Dar de alta un chofer`). El alta de unidades ya existe (C4-e): se mueve aquí, no se reescribe.

**Chips de filtro**, con su rótulo `VER` a la izquierda en mono (la lección del filtro de Vernier, #448: una fila de chips sin rótulo no se distingue de otra):
- Unidades: `Todas` · `Piden algo` · `Al día`
- Equipos: `Todos` · `Sin señal` · `En unidad` · `En bodega`

Cada chip lleva su cuenta, y **las cuentas cuentan lo que la lista muestra** con la búsqueda aplicada — la misma ley que Vernier, y el mismo defecto a evitar.

**Buscador propio del cajón**, acotado a él.

**La lista, en filas compactas de una línea.** Glifo del sujeto · nombre en Bricolage · apoyo en tenue · dato a la derecha con su etiqueta en mono. Nada de tarjetas altas: 84 filas compactas son tres pantallas y se recorren; 84 tarjetas son quince y no se recorren.

**Orden dentro del cajón:** dos secciones, `Piden algo` arriba y `Al día` abajo, cada una con su cuenta. Lo que está al día se dibuja con menos peso visual, no escondido.

## 4 · Lo que muere y lo que se muda

- **La pestaña `Dispositivos` desaparece** del menú del transportista. Todo lo que hacía —vincular a una unidad, soltar, dar de baja, ver la última señal— vive en el **cajón Equipos** y en `Ver ‹dispositivo›`, que no cambia.
- Las direcciones viejas de esa pestaña **redirigen** al cajón. No se dejan muertas.
- **Actualizar el Mapa de la Casa** en este mismo PR: Expedientes es archivero con cajones; Dispositivos ya no es lugar del menú.

## 5 · Los lugares (geocercas) — [Marco] por qué NO son un cajón hoy

Asav pidió un cajón de Lugares. **No entra en esta ficha, y la razón es del Marco:** una geocerca tiene dueño —una planta o un transportista— y es **frontera de evidencia**.

- La geocerca de destino de una planta **es de la planta**. Un transportista que pudiera moverla estaría moviendo la frontera contra la que se le juzga. Esas se administran desde J-Staff mientras no exista la cara de planta.
- Las geocercas **propias del carrier** (su base, su taller) sí son suyas y **serán un cuarto cajón** el día que exista la fuente que las alimente. Hoy no la hay: declararlo como cajón vacío sería prometer una puerta que no lleva a ningún lado.

Queda como pendiente con nombre, con su razón escrita.

## 6 · Lo que NO cambia (y no se toca)

- El expediente en sí: `Ver ‹unidad›`, `Ver ‹dispositivo›`, `Ver ‹chofer›` con sus cuatro familias y sus tres estados. Intactos.
- Las reglas de vigencia y el catálogo por mercado (§4 y §5 de la ficha vieja).
- Nada del motor. Esta ficha es puerta y navegación.
- No se construyen los papeles ni el alta de choferes aquí: eso es el PR B/E de la ficha vieja y sigue su camino. El archivero los recibe cuando lleguen, sin rehacerse.

## 7 · Pruebas mínimas

1. El buscador del tablero encuentra en los tres cajones y agrupa por cajón; vacío, vuelve el tablero.
2. Las cuentas de los chips = lo que la lista muestra, bajo cualquier combinación de chip y búsqueda.
3. «Piden atención» contiene exactamente las unidades con papeles vencidos/por vencer/faltantes y los equipos sin señal — ni más ni menos.
4. Un cajón vacío declara su vacío; no se esconde.
5. Las direcciones viejas de `Dispositivos` redirigen al cajón Equipos.
6. Con 84 unidades sembradas, el cajón abre sin listas partidas ni scroll infinito.
7. El alta de unidades sigue funcionando igual desde su nuevo lugar (las pruebas de C4-e siguen verdes).

## 8 · Revisión visual (tuya, no de Asav)

En la desechable, con las 84 unidades sembradas, las dos pieles, 375 y 1280 px. Capturas en el PR: el tablero, el buscador con resultados de dos cajones, el cajón Unidades con sus dos secciones, y el cajón Choferes vacío.

## 9 · Fuera, con nombre

- Cajón de Lugares propios del carrier (§5), cuando exista su fuente.
- Los papeles y el alta de choferes (PR B/E de la ficha vieja).
- Ligar `Ver ‹unidad›` con el acta de Vernier — va en el tramo de pasillos.
