# Handoff: ¿Ontoy? · App del pasajero · versión 1

Lanzamiento: **1 de octubre de 2026**. Repo destino: `asav-mx/j-tel` · `apps/publico` (Next.js + React; componentes en `src/components/ontoy/`).

## Overview
¿Ontoy? es la app para pasajeros de transporte público. Te dice a cuántas paradas viene tu camión, qué ruta te lleva y dónde subirte, con la posición real de J-Telemetry. La app abre en **Inicio** y tiene una barra fija con **Inicio · Mapa · Ir a · Pase**.

**Reglas de la versión 1:**
- **Sin minutos de llegada**, porque la velocidad aún no está medida. Las llegadas se dicen en paradas («Viene a 2 paradas»), siempre con la unidad y la edad del dato.
- **«Ir a» es solo un buscador** de ruta o parada.
- **Sin notificaciones.**
- Todo lo que dice «futuro · cuando se mida» o «futuro · planeador» **no se construye** en la versión 1.

## About the Design Files
Los archivos de `diseno/` son **referencias de diseño hechas en HTML**. Muestran cómo se ve y cómo se comporta cada pantalla; **no son código para copiar**. La tarea es **recrear** estas pantallas en `apps/publico`, con los patrones que ya existen: los componentes `ontoy-*`, la tokenización de `tema.ts` y la lógica de `lib/ontoy/`.

Cada `.dc.html` se abre en el navegador junto a `support.js`. Es un lienzo con teléfonos de 390×844, cada uno etiquetado con `data-screen-label`.

## Fidelity
**Alta fidelidad.** Los colores, la tipografía, los radios, los tamaños y los textos son finales. Los datos de ejemplo no lo son: las rutas 8 y 23, los números de unidad, las calles y los horarios son inventados. El texto de la interfaz (copy) sí es final.

## Reglas que no se rompen (resumen de `diseno/CLAUDE.md` y `diseno/Estandar de pantallas.md`)
1. **El naranja `#F6A15B` es solo de Ontoy.** Nada más en la interfaz lleva naranja.
2. **Color de ruta:**
   - Sale del dato `color_hex`. Se escoge en J-Staff de una lista sin tonos cercanos al naranja y **no se ajusta al dibujar**.
   - `contraste-de-ruta` solo decide si el texto va blanco o carbón.
   - Solo pinta lo que es de una ruta: Tino, Cami, el tótem, la línea del mapa y la franja de la placa. **Nunca** botones, fondos ni la barra.
3. **Un Ontoy por pantalla, como máximo**, y solo si dice algo: un estado, una respuesta o un «no sé».
4. **Una tarjeta carbón y un botón principal por pantalla.**
5. **Cada dato en vivo lleva su edad**, por ejemplo «posición de hace 10 s». Sin edad no se muestra.
6. **Sin dato no se inventa nada:** placa en «—» y Ontoy mira abajo. «Preguntando…» mientras carga.
7. **Nada de alarmas:** sin rojos de error, sin parpadeos, sin vibración y sin ruedita de carga.
8. **Reacciones** solo por dato real o por una acción del usuario. Con `prefers-reduced-motion`, solo cambia la cara.
9. **Frontera:** el lector del lado del operador, J-Staff, planta y carrier van **sin caritas**. Todo lo que ve el pasajero lleva el universo.
10. **Idioma:** español mexicano, en tú. Los títulos van en tipo oración y no se usan emoji.

## Design Tokens
Los valores están en `tokens/colors.css`, `tokens/typography.css` y `tokens/shape.css`. **No se inventan hex.**

**Neutros**
| Token | Hex | Uso |
|---|---|---|
| `--banqueta` | #EDE9E1 | fondo de pantalla y de la barra |
| `--hueso` | #F7F3EC | tarjetas, hoja inferior, buscador y calles del mapa |
| `--arena-clara` | #E2DCD1 | manzanas del mapa |
| `--arena` | #DCD5C8 | bordes (`--ring`: 0 0 0 1px) y separadores |
| `--arena-2` | #C9C1B3 | asa de la hoja |
| `--carbon` | #2A2E37 | texto, tarjeta principal, placas y botón principal |
| `--carbon-2` | #4A4F5A | texto secundario |
| `--gris` | #6B6F78 | contexto y edad del dato |
| `--asfalto` | #3A4150 | separador dentro de la tarjeta carbón |
| `--llanta` | #15171C | placa sobre fondo carbón |

**Marca y barrio**
- `--ontoy` #F6A15B, solo Ontoy.
- Colores de barrio, solo para íconos-objeto e ilustración: maíz #F2C14E, nopal #5FB36B, rosa #E36F8C, agua #2FA6A0, madera #8A6A52, pasto #D3E4C9 y lágrima #7FB8F0.

**Noche**
- Fondo #1E2B4D, superficie #26365E, borde #324673 y texto hueso.
- Las placas siguen en carbón, con borde #324673.

**Rutas de ejemplo (en producción salen del dato):** 51 #4F7FD8 · 8 #8B6CC9 · 23 #A2466E.

**Tipografía**
| Uso | Estilo |
|---|---|
| Títulos y números | Bricolage Grotesque 800, tracking −0.025em |
| Texto | Instrument Sans 400–700 |
| Título de pantalla | 800 28/1 |
| Nombre de parada en la hoja | 800 22/1.05 |
| Sección | 800 20/1 |
| Cifra grande de la tarjeta carbón | 800 48/0.9 |
| Cifra de fila | 800 28 |
| Placa | 800 16, o 19 la grande |
| Cuerpo | 15 |
| Contexto | 13 |
| Edad | 12 |

**Mínimo 12 px.**

**Formas**
- Radios: placa 7, tarjeta 22–26, hoja 26 (solo arriba), pill en botones y buscador.
- Sin sombras ni degradados; los bordes se hacen con `box-shadow: 0 0 0 1px`.

**Espacio**
- Margen lateral 16, gap entre tarjetas 12–14.
- Toques ≥ 44 px; el botón mide 52 de alto.
- Barra: 64 px más zona segura (98 en total).

**Movimiento**
- Curva `--ease` cubic-bezier(.2,0,0,1).
- Duraciones: 0.2 s para toques, 0.45 s para cambios de dato y 0.6 s para hojas y para el color del tótem.
- Cami usa suavizado exponencial entre posiciones del GPS (factor 0.08 por cuadro de 50 ms). Nunca salta.

## Componentes base
| Componente | Especificación | Dónde verlo |
|---|---|---|
| **Barra** | 4 pestañas. Ícono de 26 px dentro de una pastilla de 56×30 más la palabra en 12 px. La activa lleva pastilla carbón, glifo en hueso, peso 700 y mira al frente. **Regla 2b:** las inactivas voltean las pupilas 0.9 px hacia la activa (la variable `--mx` del SVG). De noche la pastilla es hueso y el glifo va en carbón. | `Simbolos` · 2b |
| **Placa** | Carbón, radio 7, alto 30 (36 la grande). Número en blanco y **franja inferior de 3 px del color de la ruta** (`inset 0 -3px 0`). Variante con divisor: número · «3 paradas». Sin dato: «—». Momento de llegada: «¡ya!» en el color de la ruta. | `App Inicio` · 1a |
| **Tarjeta carbón** (tu parada principal) | Fondo carbón, radio 26, padding 18. Lleva Tino de 56, el nombre de la parada (700 17), «Ruta 51 · hacia Centro» (13 #DCD5C8), «Viene a» más la cifra 48 y «paradas» 22, «viene la 2120 / posición de hace N s», un separador #3A4150 y la promesa «Pasa cada 12–15 min · según la concesión». | `App Inicio` · 1b |
| **Tarjeta y fila hueso** | Hueso, radio 22, ring arena. Fila: placa, título y apoyo, dato a la derecha; alto mínimo 60–64. Separador de 1 px arena con margen de 14. | todas |
| **Hoja inferior** | Hueso, radio 26/26/0/0, borde superior arena y asa de 40×5 #C9C1B3. Tiene tres alturas: asomada, media y completa. Sube en 0.6 s `--ease`, sin rebote. Se cierra con el botón, con Escape o tocando fuera. | `App Mapa` · 2a |
| **Botones** | Principal: pill carbón, texto blanco 700 16, alto 52. Secundario: borde inset carbón de 1.5 px. Terciario: texto subrayado arena. Al hover el color baja a #4A4F5A; al presionar **no se encoge**. | `App Inicio` · 1a |
| **Guardar** | Sin guardar: estrella arena con ojos (`g-estrella`) y «Guarda tu parada». Guardada: estrella maíz sonriente (`g-estrella-si`) y «Guardada» en el botón secundario. Al guardar, Tino sonríe y salta 8 px durante 0.45 s. | `App Mapa`, `App Prototipo` |
| **Buscador** | Pill hueso de 52 (56 en Ir a con borde de 2 px carbón), con `g-ira` de 28 y placeholder «Busca una ruta o una parada». | `App Mapa`, `App Ir a` |
| **Aviso** | Tarjeta hueso con «fecha · según la concesión» (600 12), placa, título 700 16 y cuerpo 14. Si no lo has visto lleva un **punto carbón** de 10 px, nunca rojo. | `App Ir a y Avisos` · 3b |

## Pantallas (versión 1)
| Pantalla | Estados | Archivo · sección |
|---|---|---|
| **Inicio** | primera vez (una sola tarjeta de Ontoy: «¿Ontás?», «Usar mi ubicación», «Buscar mi parada»), con paradas, sin dato, cerrada, de noche, preguntando, ubicación buscando / denegada / imprecisa | `App Inicio` 1b · `App Paradas y estados` 5c |
| **Mapa** | asomada, media, completa, tótem central, por arrancar, cerrada, sin dato, sin red, preguntando; día y noche | `App Mapa` 2a/2b |
| **Hoja de Cami** | tocar a Cami abre sus próximas paradas contadas desde donde va; tu parada va resaltada | `App Prototipo` |
| **Ir a** | vacío, escribiendo, con resultados, sin resultados | `App Ir a y Avisos` 3a |
| **Avisos** | lista y vacío | 3b |
| **Pantallas completas** | sin red, 404, sin paradas | 3b/3c |
| **Paradas** | lista, editar (reordenar, quitar y deshacer) | `App Paradas y estados` 5a |
| **QR de un Tino** | abre la hoja de esa parada sin bienvenida, con «Guárdala»; y guardada | 5b |
| **Pase (R&D)** | QR, sin señal y «Pronto podrás pagar con tu teléfono» | `App Pase y Lector` 4a |
| **Lector, cara al pasajero** | listo, leído, no válido (sin rojo, con el porqué) y sin red; cada respuesta dura 1.5 s | 4b |
| **Tira de rutas del mapa** | chips con placa y ojo (`g-ojo` abierto = se ve, `g-ojo-no` = oculta), ruta oculta y panel «Más rutas» | `App Lote 6` 6a |
| **Inicio sin red y de noche** | sin red (dato en pasado con `s-viejo` y Ontoy ondulado), noche con servicio y noche sin dato | 6b |
| **Lector, lado del operador** | **sin caritas ni naranja**: última lectura, conteos del turno, cámara, red, ubicación, últimas lecturas con el porqué; y sin red (se guarda y se valida después) | 6c |

### Detalles clave
- **Escalera sin dato** (`atajo-de-parada.sinLlegada`): cada caso dice lo suyo.
  - No pudimos preguntar.
  - Preguntando…
  - Sin unidad a la vista.
  - Arranca el 1 de octubre.
  - Fuera de horario · abre 5:30.
- **Dato viejo:** va en pasado, sin cifra grande y con el anillo hueco `s-viejo`: «la 2120 iba a 3 paradas · posición de hace 6 min». En el mapa, Cami queda al 40 % de opacidad con una etiqueta «hace 6 min».
- **Tótem central** (2 o más rutas en una parada):
  - Toma el color de la ruta que llega primero y lleva placas apiladas, cada una con la franja de su ruta.
  - Tocar un filtro hace que el color cambie en 0.6 s y que la lista se filtre.
  - Mira arriba con la boca abierta solo si una unidad está **a 1 parada, medido**.
- **Ruta por arrancar:** se dibuja punteada y Tino queda con los párpados a media altura. Cami de frente dice «Pronto me verás en la calle.», con «Arranca el **1 de octubre**» y **sin frecuencia**.
- **Cerrada:** no hay Cami en el mapa y todos los Tino duermen con zzz. La tarjeta dice «Abre a las 5:30» y abajo «De 5:30 a 22:30 · según la concesión».
- **La mirada es señal:**
  - al frente: te habla;
  - de lado: de allá viene;
  - arriba con boca abierta: ¡ya viene!, a 1 parada y medido;
  - abajo con boca en línea: sin dato;
  - abajo con boca ondulada: sin red;
  - ojos cerrados con zzz: cerrado o de noche.
- **Ontoy al tocarlo:** la reacción sube con toques seguidos (guiño → corazones → «¡basta!») y vuelve a su cara en 1.6 s.

## Interacciones y estado (ver `App Prototipo.dc.html`)
Estado mínimo:
- `pantalla`
- `ubicacion` (sin-pedir | buscando | concedida | negada | imprecisa)
- `primeraVez`
- `guardadas` (en el teléfono, sin cuenta)
- `seleccion` (parada | cami | null)
- `q` del buscador
- `vivos` por ruta, con edad

Flujos probados:
1. Primera vez → ubicación → rutas cerca → abrir la 51 → guardar → Inicio muestra la tarjeta carbón.
2. Ir a → «51» → parada → mapa con la hoja.
3. Aviso de desvío → «Ver la parada temporal» → el mapa enseña la obra y la parada alterna.

**Buscador (versión 1):**
- Normaliza acentos y mayúsculas.
- Si escribes un número, busca la ruta exacta y sus paradas.
- Si escribes texto, busca contenido en el nombre de la ruta o de la parada.
- Muestra los resultados mientras escribes, con la lista de la ciudad que ya está en el teléfono.

## Assets
`simbolos/*.svg` son los **30 glifos** en retícula de 24:
- **Objetos, con ojos y color de barrio (`g-*`):** casa, mapa, ira, pase, ubicacion, estrella, estrella-si, aviso, instalar, sol, luna, nube. También carta, maletin y corre; estos tres son futuros.
- **Señales, sin ojos, trazo de calle de 2.6 px (`s-*`):** chev, volver, cerrar, mas, menos, ida (vuelta = volteado con `scaleX(-1)`), reintentar, palomita (solo operador), vivo, viejo y anillo.
- **Caritas de estado de ruta (`e-*`):** vivo, arrancar, cerrado y sinsenal. Toman `currentColor` = color de la ruta; sinsenal va en arena.

Los exporté con tinta carbón. Para noche o para la pestaña activa, la tinta (`--ink`) pasa a hueso. En `Simbolos.dc.html` los trazos con `var(--ink)` y la pupila con `var(--mx)` muestran cómo parametrizarlos.

**Personajes** (Ontoy, Tino, Cami de frente y desde arriba, tótem y pasajero): vienen como `<symbol>` y formas inline dentro de los `.dc.html`. La fuente maestra es `Universo Ontoy.dc.html` del proyecto de identidad. Cópialos de ahí; no hay que redibujarlos.

**QR del pase:** en `App Pase y Lector` ya es un QR real y escaneable (qrcode-generator, corrección M, cuadros de 1 módulo, margen de 4) que se renueva cada 5 s, igual que `components/ontoy/codigo-qr.tsx`. En producción se usa ese componente.

## Pendientes antes del 1 de octubre
- El texto de privacidad lo da la concesión o el abogado.

## Lanzamiento (fuera de la app)
`diseno/Lanzamiento.dc.html` y los PNG listos en `lanzamiento/`:
- `lamina-tino-51.png` y `lamina-totem-8-51.png`: 3600×5400 (40×60 cm a ~230 ppp). El QR es de marca: los módulos van en puntos, las esquinas son ojos y el centro lleva la cabeza de Tino en el color de la ruta, con corrección H. Abre `ontoy.app/p/<parada>`. **Hay que generar una lámina por parada**, cambiando el nombre, las rutas, el color y el número de parada.
- `post-1-ontas.png`, `post-2-busca-a-tino.png` y `post-3-si-no-se.png`: 1080×1350.
- `historia-1-pronto.png` (antes del 1 de octubre) e `historia-2-ya-estamos.png` (el 1 de octubre): 1080×1920.
- Ícono instalado y arranque: sección 9 del mismo archivo. Los archivos del ícono están en `iconos/`.

## Capturas
En `capturas/` hay **83 PNG** (1026×2160), uno por pantalla y estado. Van ordenados por lote y con el nombre del estado:
- `1-inicio/` (5)
- `2-mapa/` (14, día y noche)
- `3-ir-a-avisos-vacios/` (18)
- `4-pase-lector/` (10)
- `5-paradas-qr-ubicacion/` (12)
- `6-prototipo/` (7): un recorrido del prototipo, de la primera vez a la parada temporal, pasando por la hoja de Cami.
- `7-tira-inicio-operador/` (10)

Sirven de referencia rápida. Para medidas exactas y comportamiento, manda el `.dc.html`.

## Files
- `diseno/App Prototipo.dc.html`: prototipo navegable de la versión 1, el más completo para comportamiento.
- `diseno/App Prototipo noche.dc.html`: el mismo prototipo en modo noche.
- `diseno/Lanzamiento.dc.html`: láminas, posts, historias, ícono y arranque.
- `diseno/App Inicio.dc.html`: componentes base (1a) e Inicio en 5 estados (1b).
- `diseno/App Mapa.dc.html`: mapa, hojas, tótem y estados, de día y de noche.
- `diseno/App Ir a y Avisos.dc.html`: buscador, avisos y pantallas completas.
- `diseno/App Pase y Lector.dc.html`: pase R&D y lector cara al pasajero.
- `diseno/App Paradas y estados.dc.html`: paradas, QR de Tino, ubicación y cargando.
- `diseno/App Lote 6.dc.html`: tira de rutas, Inicio sin red y de noche, y lector del operador.
- `diseno/Simbolos.dc.html`: hoja de símbolos y variantes de la barra.
- `diseno/Estandar de pantallas.md`: el estándar por tipo de pantalla, que manda junto con `CLAUDE.md`.
- `diseno/Auditoria App UI.md` y `diseno/Auditoria Iconos.md`: inventario y avance.
- `tokens/*.css` y `styles.css`: los valores.
- `simbolos/*.svg`: los glifos sueltos.
