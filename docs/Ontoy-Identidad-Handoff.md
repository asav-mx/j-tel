# Ontoy — Identidad visual y universo (handoff v1)

Fecha: 2026-09-23 · Repo: asav-mx/j-tel · App: apps/publico (NEXT_PUBLIC_APP_NOMBRE=Ontoy)

## 1. Reglas aprobadas (no negociables)
- **Naranja #F6A15B es solo de Ontoy.** Ningún otro objeto lleva naranja.
- **Tino, Cami y el Tótem central toman su color de `color_hex` de la ruta** (dato del circuito). Los colores de muestra son solo ejemplos.
- Ruta de ejemplo principal: **51**.
- Placa de ruta: fondo carbón #2A2E37, texto blanco. En el estado «¡ya!» el texto va en el color de la ruta.
- Todos los personajes: dos ojos blancos con pupila carbón, manos flotantes (no unidas al cuerpo).
- **Versión original sin boca.** Las reacciones agregan boca (sonrisa, línea, abierta).
- Objetos sin ruta usan colores de la paleta, nunca naranja.
- **Frontera:** J-Staff, planta y carrier (el árbitro) **no llevan caritas**. El universo vive del lado del pasajero, en lo impreso de la calle y en redes.
- **«Tú estás aquí» = el pasajero** (personajito con linterna, no Ontoy). Ontoy no señala datos en vivo; el pin de Ontoy es solo para marketing.
- Estados que dependen de medición («Cami lleno», «¡ya viene! <2 min») existen como pieza pero **no se encienden sin dato**.
- En el mapa en vivo el barrio va solo con referencias reales; las marcas ficticias son para escenas y redes.

## 1b. Color de ruta: se escoge una vez, de una lista
**Enmienda (a) de Asav, 23-sep-2026.** Reemplaza la regla anterior —«la concesión elige
cualquier color y el sistema lo ajusta lo mínimo»— que corría el tono al rojo o al ámbar y
le movía la luz al dibujar.

- **Lo escoge J-Staff al capturar la ruta, de una lista.** Los tonos parecidos al naranja de
  Ontoy **no aparecen en la lista**: el naranja es de Ontoy y nada más, y la única forma de
  sostenerlo es no ofrecer un tono que pelee con él.
- **Se guarda uno solo,** el `color_hex` del circuito, y es **el mismo en la lámina del poste,
  en la app y pintado en el camión**. Un color que se ve distinto en la calle que en la
  pantalla no es identidad, es ruido.
- **Nada se corrige al dibujar.** Ni corrimiento de tono, ni luz, ni saturación. Lo que se
  capturó es lo que se pinta.
- Lo que **sí** sigue, porque no toca el color de nadie:
  - Texto **sobre** el color: blanco o carbón según contraste ≥ 3:1 (`contraste-de-ruta.ts`).
    «¡ya!» en placa carbón: color de ruta si contrasta, si no blanco.
  - El **halo** de la traza sobre el mapa (8.8c): una orilla del color del lienzo, que separa
    la línea del fondo sin cambiarle el color a la ruta.
  - El color **nunca va solo**: siempre con el nombre o el número de la ruta.
- Construcción: la lista en J-Staff todavía no existe —hoy el color se captura con un
  selector libre— y es un frente aparte. Referencia interactiva: Universo sección 12. Los
  colores de este documento son solo muestras.

## 1c. La mirada y la boca (código común)
- **Mirada = señal:** al frente (te habla a ti) · de lado (de allá viene; en el mapa apunta al camión real) · arriba (¡ya viene!) · abajo (revisando/esperando) · al otro lado (se va) · cerrados (descansando).
- **Boca = emoción, solo en reacciones:** sin boca (original) · sonrisa (contento) · abierta (¡sorpresa!/¡ya!) · línea (paciente) · triste (algo no salió) · ondulada (confundido) · enojada (solo redes y stickers).
- Referencia: Universo sección 14.

## 2. Paleta
| Nombre | Hex | Uso |
|---|---|---|
| Naranja Ontoy | #F6A15B | Solo Ontoy |
| Carbón | #2A2E37 | Pupilas, postes, placas, texto |
| Banqueta | #EDE9E1 | Fondo del ícono (día) y de la marca |
| Hueso | #F7F3EC | Detalles claros (franjas, faros, letreros) |
| Muestra ruta azul | #4F7FD8 | Ejemplo (ruta 51) |
| Muestra ruta verde | #5FB36B | Ejemplo (C4) |
| Muestra ruta rosa | #E36F8C | Ejemplo (38) / toldo tiendita |
| Muestra ruta turquesa | #2FA6A0 | Ejemplo (T1) / carrito de tacos |
| Amarillo aviso | #F2C14E | Avisos de la concesión, estrella |
| Morado | #8B6CC9 | Semáforo |

Tipografía: **Bricolage Grotesque 800** (títulos, números de ruta) · **Instrument Sans** (texto e interfaz).

## 3. Personajes (aprobados)
### Ontoy — protagonista
- Cuerpo tipo piedra redondeada, naranja; pies y manos flotantes; celular en la mano derecha con la app en pantalla (la pantalla mira hacia Ontoy).
- Reacciones: **original** (sin boca, de frente) · revisa el cel (sonrisa) · mira la calle · espera (boca en línea, párpados a media asta) · **¡ya viene!** (ojos arriba, boca abierta — cara del ícono).
- Uso: ícono, splash, avisos, tu ubicación (pin), estados vacíos.

### Tino (8a) — parada oficial
- Poste carbón con base, cabeza en disco del **color de la ruta**, manos flotantes del mismo color, carga su placa «51 · 3′» al pecho.
- Estados: espera · mira la calle · aburrido · **¡ya viene!** (alza la placa sobre la cabeza, boca abierta, rebote; texto «¡ya!» en color de ruta).
- Uso: paradas en el mapa, vista de ruta, «Tu próximo camión», avisos.

### Cami — el camión
- Ojos ovalados en el parabrisas (distintos a los redondos de Tino). Letrero superior con el número de ruta. **Original sin boca**; la boca solo en reacciones. Color de presentación: morado.
- Reacciones (2D, sección 13): original · buscando · ¡ya llegué! · se va y saluda · lleno (solo con dato) · paciente en tráfico (medido) · fin de servicio · sin señal (gris) · enojado (solo redes).
- Tipos: chato, convencional con trompa, midibús, combi/micro, articulado.
- Camioncito de juguete del **color de la ruta**, cara en el parabrisas, letrero con el número de ruta (51), franja hueso, faros, manos flotantes.
- Estados: original · buscando · buena onda (sonrisa) · cansado · **¡ya llegué!**
- Vista desde arriba para el mapa en vivo (legible hasta 20 px, gira con el rumbo).

### Tótem central (8c) — paradero multi-ruta
- Columna carbón con una carita por ruta (panel del color de cada ruta + minutos). La ruta que llega sale arriba en grande con «¡ya!», boca abierta y manos.
- Uso: solo donde convergen varias rutas.

## 4. Ícono de la app
- Ontoy «¡Ya viene!» (ojos arriba, boca abierta) naranja sobre **Banqueta #EDE9E1**.
- Reemplaza a `apps/publico/public/icono.svg` y `public/iconos/*` (hoy: camión azul sobre #0f1418). Ver docs/Ontoy-Iconos.md para nombres de archivo.
- Modo oscuro: **Azul noche #1E2B4D** (elegido).
- **Archivos listos** en `export/iconos/` con los nombres que ya usa la app: `icono.svg`, `icono-mascara.svg`, `icono-192.png`, `icono-512.png`, `icono-mascara-512.png`, `apple-touch-icon.png` (+ `icono-noche.svg`). Se reemplazan en `apps/publico/public/` sin tocar el manifest salvo:
  - `background_color` / `theme_color`: de `#0f1418` a `#EDE9E1` (día). En noche, `#1E2B4D`.

## 5. Familia de paradas
Tino (oficial) · Techada curva (parada formal con bancas) · Tótem en vivo (llegadas) · La sombrita (parada informal en árbol) · Tótem central (multi-ruta). Todas con carita y color de ruta.

## 6. El barrio (objetos del mapa, todos con carita)
Tiendita «Abarrotes Lupita» (toldo rosa) · Tienda 24 h «Súper 24» (turquesa) · Puesto de tacos (turquesa) · Casa · Árbol · Semáforo (placa morada) · Pin de Ontoy. Marcas ficticias; se pueden sustituir por alianzas reales.

**Lugares de referencia** («me bajo en…»): plaza comercial · plaza con kiosko · hospital/clínica · farmacia · escuela · universidad · mercado · iglesia/templo · unidad deportiva · parque industrial · central de autobuses · gasolinera. En el mapa en vivo son íconos de categoría sobre lugares reales.

**Tipos de Cami:** chato (urbano) · convencional con trompa · midibús · combi/micro · articulado; vistas de frente, de lado y desde arriba.

## 7. Dónde vive cada pieza en apps/publico
| Momento | Pieza |
|---|---|
| Ícono / manifest | Ontoy ¡ya viene! |
| Pantalla de carga | Wordmark «¿Ontoy?» + Ontoy asomándose |
| not-found | Ontoy perdido/confundido («Ver las rutas») |
| Inicio · Tu próximo camión | Tino con placa + Cami |
| Inicio · sin guardadas | Tino con estrella |
| Inicio · estado de cada ruta | Carita de estado: en vivo · por arrancar · cerrada · sin señal (gris punteada) |
| Inicio · ver rutas cerca | El pasajero en el mapa; Ontoy invita desde el botón |
| Ruta cerrada / por arrancar | Tino aburrido |
| Mapa · camiones en vivo | Cami desde arriba |
| Mapa · paradas | Tino; Tótem central si hay varias rutas |
| Mapa · tu ubicación | El pasajero (con linterna de rumbo) |
| Ir a · atajo | Ontoy acompañándote hasta tu parada |
| Pase (R&D) | Ontoy con boleto QR · Ontoy celebrando el pago |
| Validador (R&D) | Cami con lector (pip verde/rojo) |
| Avisos de la concesión | Tino con aviso amarillo (nunca alarma) |
| Sin conexión | Ontoy dormido con sus «z» (o sin señal) |
| Hoja de parada | Tino con la cara según lo medido |
| Letrero impreso del QR (#536) | Lámina: Tino del color de la ruta + QR «Escanea: mira cuándo llega» |

## 8. 3D
- Estilo: juguete suave, formas redondas, colores planos, sin texturas.
- Hechos (GLB/OBJ descargables): **Ontoy**, **Tino**, **Cami**, **Tótem central** — con estados y color de ruta intercambiable.
- En 2D por diseño: pines e íconos chicos del mapa (a 24–40 px el 3D no se lee).
- Nota: el texto de placas/letreros se conserva en GLB, no en OBJ.

## 9. El mapa (v1 de estilo)
- Escalón 1 — **cambiarle la ropa** a OpenStreetMap: suelo Banqueta #EDE9E1 (día) / Azul noche #1E2B4D (noche), manzanas redondeadas, calles claras, avenidas más claras, sin POIs ajenos.
- Escalón 2 — **nuestros muñecos encima:** rutas con su `color_hex` y borde del color del suelo (la elegida encima y más gruesa), Tino en cada parada, Tótem central en convergencias, Cami desde arriba girando con su rumbo, punto azul.
- Zoom lejos: Tino → punto del color de la ruta; tótem → punto grande.
- Escalón 3 (servir el mapa completo) y el mapa dibujado a mano de colonias: **después**.
- Referencia visual: Universo Ontoy, sección 09 (día y noche) y sección 05 (escena ilustrada).

## 9b. Reacciones (app, web, notificaciones, redes)
| Disparador | Reacción |
|---|---|
| Cami se acerca a tu parada (posición en vivo) | Todos voltean hacia él; el pasajero mueve las manitas; Tino baja sus minutos |
| Cami llega (con medición real) | Tino alza «¡ya!», el barrio abre la boca, Cami saluda |
| Sin dato / sin señal | Nadie reacciona; caritas quietas, estado gris, Ontoy dormido |
| Tocas un personaje | Parpadeo + rebote ≤ 400 ms |
| Cursor/dedo en la web | Los ojos lo siguen |
| Scroll en la web | Cami avanza por la ruta |
| Guardas una parada | Tino sonríe con estrella |
| Pago listo (R&D) | Ontoy celebra |

- Dónde: app del pasajero (mapa, Inicio, hoja de parada, avisos), web de Ontoy (portada, página de ruta compartida y la que abre el QR), notificaciones, redes. Lo impreso es estático; su QR lleva a la web viva.
- Fuera: J-Staff, planta, carrier.
- Reglas: siempre nace de un dato real o de una acción del usuario; nunca alarma; con `prefers-reduced-motion` solo cambia la cara.
- «Tú estás aquí»: **el pasajero** (círculo con aro blanco, ojos, manos flotantes y linterna de rumbo), variante 12a azul. El color final queda por confirmar (12b carbón o 12d azul noche evitan chocar con una ruta azul).
- Referencia: Reacciones demo.dc.html · Universo sección 11 · Tu ubicacion opciones.dc.html.

## 10. Implementación gradual (lo que falta es construir, no diseñar)
1. Subir los íconos de `export/iconos/` y ajustar colores del manifest.
2. Estilo del mapa (escalón 1) + Tino / Cami desde arriba / punto azul (escalón 2).
3. Caritas de estado en las tarjetas de ruta de Inicio.
4. Estados vacíos y de error (not-found, sin conexión, sin guardadas).
5. Lámina #536.
6. Opcional: 3D de paradas secundarias, barrio y piezas nuevas.

## 11. Archivos del proyecto de diseño
- Universo Ontoy.dc.html — hoja maestra (secciones 00–14)
- Reacciones demo.dc.html — calle animada con reacciones
- Tu ubicacion opciones.dc.html — opciones de «tú estás aquí»
- export/iconos/ — íconos listos para apps/publico/public
- Paradas opciones.dc.html — exploración de paradas (histórico)
- Ontoy 3D.html · Tino 3D.html · Cami 3D.html · Totem central 3D.html — modelos 3D


## 12. Landing ontoy.app (aprobada)
- Archivo: **Ontoy Landing v2.dc.html** (+ `Ontoy hero 3D.html`, que se inserta en el hero). La v1 queda como histórico.
- Para pasajeros. **Dice lo que la app ya hace, no lo que va a hacer** (enmienda (b) de Asav,
  23-sep-2026): ver tu ruta, cuándo pasa y cómo llegar a tu parada. Nada de planear el viaje.
  - Título y CTA aprobados el 23-sep prometían el planeador —«¿Ontás? Ontoy te lleva.» y
    «Planea tu viaje»— y **quedan reemplazados**. Propuesta, a falta de tu visto bueno:
    título «¿Ontás? Mira cuándo pasa tu camión.» · CTA **«Ver las rutas»** (abre la app web,
    y es la misma palabra que ya usa la app) + «Instálala gratis».
  - **El archivo `Ontoy Landing v2.dc.html` se queda como llegó**, con el título viejo en su
    lista de opciones: es la hoja de diseño aprobada y sale de tu herramienta. La copia nueva
    entra cuando la landing se escriba en código (después del 29). Lo que manda mientras
    tanto es esta enmienda, repetida en `ENMIENDAS.md` del skill.
  - Tiendas en «Próximamente» hasta publicar.
- Orden: hero (Ontoy 3D + teléfono + calle animada) → Conoce al equipo → Antes / Con Ontoy → Lo que Ontoy hace (carrusel con scroll) → Instalar (Banqueta) → pie. «El barrio» de abajo se quitó (copia en `Ontoy Landing v2 (con calle abajo).dc.html`).
- Calle del hero: avenida de 2 carriles, 7 coches neutros + Cami 51, obra que cambia de lugar y carril (todos se cambian de carril, fila si no hay espacio), Tino con placa en vivo, 3 pasajeros que saludan y suben. Tino y Ontoy tristes si Cami se atrasa, felices al llegar. Ontoy se aburre sin cursor: sigue a Cami y luego juega con su cel.
- Hero 3D: +5 clicks = brinca histérico, backflip y trucos de parkour; todas las reacciones bajan de ritmo suave antes de volver a su estado original.
- Colores: dos mundos. Ontoy (neutros, naranja, noche, rubor/lágrima/estrella, pasajeros en azul noche) vs ruta (solo Tino, Cami, Tótem, líneas del mapa, placas). Nada de la interfaz usa color de ruta.
- Reacciones de Ontoy (solo él reacciona al click; los demás siguen con los ojos y reaccionan a la calle):
  - Hero 3D: voltea y se emociona al acercarte; click = se ríe, sube con clicks seguidos.
  - Función 04: cosquillas 2D, «¡ja ja!» → «¡me haces llorar! jaja» → «¡basta! JAJAJA».
  - Función 02: brinca y sonríe; clicks = saltos, vueltas, se marea.
  - Equipo: tímido, se sonroja y se tapa la cara; clicks = guiño, corazones, «¡basta! >///<».
  - Clicks seguidos cuentan si pasan menos de 1.4 s entre uno y otro. Con reduced-motion solo cambia la cara.
- Pendiente técnico **resuelto el 23-sep-2026 por Asav**: la **app se queda en la raíz** de
  `ontoy.app` —quien escanea un letrero o toca el ícono quiere su camión— y la **landing vive
  en `ontoy.app/conoce`**. Así ninguna dirección que un pasajero guarde, instale o escanee
  cambia después. El mapa completo de direcciones va en su propio documento y su propia valla.
- El planeador arranca después de tener recorridos medidos. **Hasta que exista, la landing no lo nombra** —ni él ni las notificaciones—. Ver la enmienda (b) arriba.

## 13. Cierre (2026-09-23)
- **Aprobado y cerrado:** identidad, universo, personajes (Ontoy, Tino, Cami, Tótem), reacciones, íconos y landing v2.
- Boca 3D de Ontoy: contorno carbón delgado y plano, interior rojizo (#7A2E2A) y lengua rosa (#D9666B), para que la boca abierta se lea (aplica al hero 3D y a Ontoy 3D).

## 14. Sistema de diseño / skill (2026-09-23)
- `SKILL.md` + `readme.md` + `styles.css` → `tokens/colors.css`, `tokens/typography.css`, `tokens/shape.css`. Tarjetas en `guidelines/`, íconos en `assets/`.
- Regla: nunca inventar hex; todo sale de `tokens/colors.css`.
- Paradito → **Tino** (provisional; id interno `paradito`).

## 15. Rendimiento adaptable (landing)
- La página elige un nivel al abrir, según memoria, núcleos, pantalla táctil, ahorro de datos y 2G. Además mide los fps durante los primeros 4 s y baja de nivel si va lenta.
  - **alto:** todo a 60 fps.
  - **medio:** 32 fps; el 3D sin sombras y a resolución 1x.
  - **bajo:** 20 fps; sin 3D (se muestra Ontoy en 2D).
- Para probar: `?nivel=bajo`, `?nivel=medio` o `?nivel=alto` en la URL.
- En producción: separar la calle y los personajes en componentes propios para que no se redibuje toda la página en cada cuadro.
- Pendiente antes de publicar: no prometer el planeador ni las notificaciones antes de tiempo, datos reales en el teléfono del hero, reacciones con el dedo, privacidad, imagen para compartir, analítica, teclado y lector de pantalla.

## 16. Códigos QR (Ontoy QR.dc.html)
- Son QR reales (librería qrcode-generator, corrección H). Las 3 esquinas son ojos que miran a Ontoy, que va en el centro.
- 4 usos: 1a Sticker Ontoy (redes, flyers, tiendita) · 1b Parada/Tino (banda en color de ruta, placa, link ontoy.app/p/<ruta>) · 1c Dentro de Cami (horizontal) · 1d Mínimo.
- Reglas: módulos siempre carbón sobre blanco, nunca naranja ni color de ruta, nunca invertidos. Mínimo 2.5 cm (poste ≥ 8 cm). Respetar el margen blanco. Probar con 2 o 3 celulares.

## 17. Fuentes
- Bricolage Grotesque (600, 800) e Instrument Sans (400–700). Las dos son gratuitas (licencia OFL).
- Hoy se cargan desde Google Fonts. En producción conviene alojarlas en el propio sitio (woff2), por ejemplo con fontsource: `@fontsource-variable/bricolage-grotesque` y `@fontsource-variable/instrument-sans`.
