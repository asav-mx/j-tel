# ¿Ontoy? · Sistema de diseño

¿Ontoy? es la app para **pasajeros** de transporte público: te dice cuándo pasa tu camión, qué ruta te lleva y en qué parada subirte. Usa los datos reales de J-Telemetry (repo en `github.md`). Dominio: **ontoy.app**.

**Frontera:** J-Staff, planta y carrier (el árbitro) NO usan este universo ni llevan caritas. ¿Ontoy? vive del lado del pasajero: app, landing, impresos de calle y redes.

## Índice
- `styles.css` → importa `tokens/colors.css`, `tokens/typography.css`, `tokens/shape.css`
- `guidelines/` → tarjetas de colores, tipografía, formas, placas, botones y tarjetas
- `assets/` → íconos de la app (`icono.svg`, `icono-noche.svg`, `icono-mascara.svg`, PNGs)
- `Universo Ontoy.dc.html` → hoja maestra: personajes, paradas, Cami, barrio, reacciones, mapa
- `Ontoy Landing v2.dc.html` (+ `Ontoy hero 3D.html`) → landing aprobada
- 3D: Ontoy, Tino (antes Paradito), Cami y Tótem central
- `Ontoy QR.dc.html` → QR con marca (sticker, parada, Cami, mínimo)
- `CLAUDE.md` → reglas aprobadas (mandan sobre este documento)

## Personajes
- **Ontoy** es el protagonista: un blob naranja con forma de piedra, pies y manos flotantes y smartphone en la mano derecha. Es el único naranja.
- **Tino** (id interno `paradito`) es la parada oficial, un poste. Toma el color de su ruta.
- **Cami** es el camión. Tiene ojos ovalados y un letrero con el número de ruta (51 de ejemplo). Toma el color de su ruta y en la hoja 01 va morado.
- **Tótem central** es la parada donde llegan varias rutas. Toma el color de la ruta.
- **Pasajero** es un personajito con linterna y marca «Tú estás aquí».

Todos llevan dos ojos blancos con pupila carbón y manos flotantes. La versión original va **sin boca**; la boca solo aparece en las reacciones: sonrisa, abierta, línea, triste y ondulada. La enojada es solo para redes.

**La mirada es una señal:**
- al frente: te habla
- de lado: de allá viene
- arriba: ¡ya viene!
- abajo: revisando o esperando
- al otro lado: se va
- cerrados: descansando

## Contenido y tono
- Español mexicano, de barrio y cálido: «¿Ontás?», «Suban, suban», «¡Ya viene!». Se tutea siempre.
- Frases cortas y concretas. Se promete solo lo que hay dato para cumplir: «Si no hay dato, te lo dice: nunca adivina».
- Nada de alarmas. Los avisos van con fecha y dicen quién los emitió («según la concesión»).
- El wordmark es **¿Ontoy?**, pegado y con signos. Los títulos van en tipo oración, sin mayúsculas completas.
- No se usan emoji. Los minutos se escriben con prima: 3′.

## Fundamentos visuales
**Color.** El 90% de todo son neutros: banqueta de fondo, hueso en superficies, carbón en texto y placas, arena en bordes. El resto se reparte así:
- **Naranja:** solo Ontoy.
- **Color de ruta:** se escoge en J-Staff de una lista sin tonos cercanos al naranja (más «otro color») y se guarda en `color_hex`. Es uno solo y no se ajusta al dibujar. `contraste-de-ruta.ts` solo decide si el texto va blanco o carbón. Siempre va con su placa.
- **Barrio** (maíz, nopal, rosa, agua, madera, pasto): solo para objetos sin ruta, nunca para la interfaz.
- **Noche:** para el modo oscuro y el ícono de noche.

**Dos mundos que no se mezclan:** los colores de **Ontoy** (neutros, naranja, noche, reacciones y pasajeros) son de la marca y no cambian. Los colores de **ruta** son de la concesión y solo pintan lo que pertenece a una ruta: Tino, Cami, el Tótem, las líneas del mapa y las placas. Nada de la interfaz o de Ontoy usa un color de ruta.

**Nunca inventes un hex.** Si falta un color, sale de `tokens/colors.css` o se agrega ahí primero.

**Tipografía.**
- Bricolage Grotesque 800 para títulos, placas y números, con tracking −0.025em.
- Instrument Sans 400–700 para el texto.
- Tamaños: lead 18, cuerpo 15, pie 13. Mínimo 12.

**Formas.** Todo es redondo y amable. Radios:
- placa 7
- botón de tienda 12
- tarjeta 22–26
- teléfono 44
- pill en botones principales y etiquetas

Sin sombras: los bordes son de 1px arena (`--ring`). Sin degradados ni blur.

**Fondos.** Planos, sin fotos. Las escenas son ilustración vectorial plana: calle carbón con líneas hueso y banqueta arena.

**Movimiento.** Suave y con inercia: suavizado exponencial y `cubic-bezier(.2,0,0,1)`.
- Las reacciones solo pasan por un dato real o por una acción del usuario.
- Los estados que dependen de medición («Cami lleno», «¡ya viene! <2 min») no se encienden sin dato.
- Nada parpadea como alarma.
- Con reduced-motion solo cambia la cara.
- Cada reacción baja de ritmo antes de volver a su estado original; nunca se corta de golpe.

**Interacción.**
- Hover: el texto baja a Carbón 2.
- Press: sin encogimiento.
- Los ojos siguen al cursor.
- Solo Ontoy reacciona al click, y la reacción sube con clicks seguidos.

**Layout.**
- Ancho máximo de 1200 y márgenes laterales de 24.
- Las secciones se separan con 64–88 de espacio.
- Cabecera fija color banqueta con línea arena.

## Iconografía
- El ícono de la app es la cara de Ontoy «¡Ya viene!», con la boca abierta, sobre fondo claro. Hay versión de noche y versión de máscara.
- Los objetos del mundo (paradas, Cami, tiendita, obra, lugares) son ilustraciones propias en SVG con la misma construcción: formas planas, ojos blancos y sin contornos. Viven en la hoja maestra; cópialos de ahí, no dibujes nuevos sin aprobación.
- No se usa ninguna fuente de íconos genérica. Todo ícono de la app sale de `Simbolos.dc.html`:
  - **Objetos** (barra, guardar, avisos, ubicación): con ojos y en color de barrio. Es la única excepción a «el barrio no va en la interfaz».
  - **Señales** (flechas, cerrar, más/menos): sin ojos, en trazo de calle carbón.
  - Si falta alguno, se genera con esa misma construcción.

## Pendientes
- Componentes en React (Button, RoutePlate, Card) si se pasa a código de producción.
- Fuentes: Bricolage Grotesque e Instrument Sans (OFL, gratis). Se cargan desde Google Fonts; para producción, alojarlas localmente (fontsource).
