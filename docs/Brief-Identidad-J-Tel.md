> ## ⚠ DOCUMENTO SUPERSEDED — no construir contra este documento
>
> **Reemplazado por:** el skill `j-telemetry-ui` para todas las superficies internas.
> Para la landing pública, el diseño vigente es el aprobado en sesión (dirección
> "la parvada · ciudad de noche").
>
> **Desde:** los tokens canónicos en `main` (PR #77, #78) y el skill con sus ediciones (#79).
>
> **Qué quedó obsoleto:** la paleta y tipografía que propone contradicen las que están
> construidas. Su sección 9 —correr una prueba comparativa entre v0, Framer y Claude
> Design— describe una fase de exploración que ya cerró.
>
> **Qué sigue vigente y no está en otro lado:** la definición de los subdominios
> (`j-tel.io` pública · `portal.j-tel.io` cliente, donde el alcance lo decide el rol y no
> la URL · `carrier.j-tel.io` transportista · `staff.j-tel.io` consola interna). Esa
> sección se cita desde aquí hasta que viva en un documento vigente.
>
> **Por qué se conserva:** es el registro del posicionamiento de marca y de por qué el
> sello es el activo comercial central.

# Brief de Identidad Visual — J-Telemetry (j-tel.io)

**Uso:** este documento se pega **completo** al inicio de cualquier herramienta de diseño (v0, Framer, Claude Design, Claude Code). Sin él, todas producen el mismo promedio del internet. Con él, producen J-Telemetry.

**Regla:** este brief se subordina al `Marco-Limpio-J-Telemetry-MAESTRO.md`. Si algo aquí contradice al Marco, gana el Marco.

---

## 0. Qué es esto y para quién

J-Telemetry es un **árbitro**. Recibe GPS, lo cruza contra la ruta contratada y emite un veredicto vinculante — `cumplido`, `no cumplido`, `pendiente por evidencia` — que una empresa usa para decidir si paga o no un viaje.

No es un producto de mapas. No es un rastreador. El GPS es la cámara; **el producto es el fallo del árbitro.**

Quien lo compra: gente de compras, RH y cumplimiento en maquiladoras de Juárez (Tecma, Honeywell). Gente que hoy resuelve esto con hojas de cálculo y discusiones de WhatsApp. No los impresiona el "wow" de startup — los impresiona la **autoridad**: algo que se ve tan bien hecho que no discutes su resultado.

**El trabajo de la landing pública, en una frase:** convencer a un gerente escéptico de que este veredicto se sostiene ante su proveedor y ante su jefe.

---

## 1. La tesis del diseño

> **El diseño debe verse como una pieza de instrumentación, no como una app.**

Referencias del mundo real (no de otras webs): la carta náutica, el registro de vuelo, el acta notarial, el sismógrafo, el tablero de una torre de control. Cosas donde la estética **nace de la precisión**, no de la decoración.

Si un elemento no comunica un hecho, se va.

---

## 2. Paleta

La paleta **es el producto**: los tres colores de estado son literalmente las tres salidas del árbitro. No son "colores de marca" inventados — son el vocabulario del sistema.

| Nombre | Hex | Uso |
|---|---|---|
| `--acta` | `#EDF0EE` | fondo base. Papel frío, verde-gris tenue. **No es crema cálida.** |
| `--tinta` | `#111A22` | texto principal, tipografía grande. Casi negro con azul. |
| `--grafito` | `#5A6772` | texto secundario, etiquetas, líneas de datos |
| `--linea` | `#C9D0CD` | hairlines, bordes, cuadrícula (1px, siempre 1px) |
| `--cumplido` | `#1F7A5C` | verde profundo. Verificado. |
| `--no-cumplido` | `#A62C24` | rojo óxido. Incumplido. |
| `--pendiente` | `#C98A12` | ámbar. Sin evidencia. |

Los tres colores de estado **sólo se usan para estado.** Nunca como decoración, nunca como acento de un botón cualquiera. Cuando ves ámbar en la página, significa algo. Esa disciplina es lo que se lee como calidad.

Para las caras internas (`carrier`, `portal`, `staff`) existe una variante oscura del mismo sistema (`--tinta` como fondo, `--acta` como texto), misma paleta de estado. Consola de operación, no tema oscuro de moda.

---

## 3. Tipografía

Tres roles. Ninguno es un serif editorial de alto contraste (eso es la firma visual de "esto lo hizo una IA").

- **Display — `Archivo Expanded`** (Google Fonts, gratis). Grotesca ancha, se siente placa metálica y señalización industrial. Peso 600–700. Se usa **con hambre**: pocos titulares, muy grandes.
- **Cuerpo — `Inter Tight`** (Google Fonts). Neutral, denso, legible en tablas largas. Peso 400–500.
- **Datos — `JetBrains Mono`** (Google Fonts). **Ley:** toda coordenada, hora, ID de evidencia, folio de servicio y placa de unidad va en monoespaciada. Siempre. Sin excepción.

Esa última regla es la más importante de la sección. Es lo que hace que el sistema se sienta *medido* y no *escrito*. Un dato tabulado en mono se lee como una lectura de instrumento; el mismo dato en tipografía normal se lee como una opinión.

Escala: saltos grandes y pocos. `72 / 40 / 24 / 16 / 13`. Nada intermedio.

---

## 4. El elemento firma (lo único memorable)

**El hero es un veredicto sucediendo en vivo.**

Al cargar la página, en 2.4 segundos y en este orden:

1. Se dibuja una línea de ruta (polilínea de KML) sobre una cuadrícula tenue — trazo que avanza, como una plumilla.
2. Caen los pings de GPS sobre ella, uno a uno, con su timestamp en mono al lado.
3. La ventana de servicio se cierra (una barra de tiempo llega a su límite).
4. **Cae el sello: `CUMPLIDO`.** Un impacto físico, ligero rebote, se asienta. Silencio.

Ese sello es el único momento de audacia de toda la página. Todo lo demás alrededor está callado y ordenado. Es el argumento comercial entero, convertido en movimiento: *nosotros no te enseñamos el mapa, te damos el fallo.*

Debajo, tres tarjetas — no de features, sino de las **tres únicas salidas posibles**. Vender la decisividad, no la funcionalidad.

---

## 5. Movimiento

Alta calidad de animación = **una secuencia orquestada**, no efectos regados por todos lados.

Permitido:
- La secuencia de carga del hero (arriba).
- Trazos de ruta que se dibujan al hacer scroll (SVG `stroke-dashoffset`). El scroll avanza el recorrido: el usuario literalmente conduce la ruta con el dedo.
- Micro-interacción: al pasar sobre una fila de datos, aparece su ID de evidencia en mono. Revelar el rastro de auditoría al tocar, no antes.
- Transiciones de 180–240ms, curva `cubic-bezier(0.2, 0, 0, 1)`. Todo con el mismo easing.

Prohibido (esto es lo que grita "IA"):
- Gradientes de fondo, blobs, formas orgánicas flotantes.
- Glassmorphism / vidrio esmerilado.
- Tarjetas que levitan con sombra difusa al hover.
- Parallax genérico, texto que aparece con fade uno tras otro sin razón.
- Íconos de librería (Lucide/Heroicons) usados como adorno. Si hay ícono, es diagramático y hecho a la medida.
- Emojis. Nunca.

`prefers-reduced-motion`: todo se apaga y el sello aparece ya puesto.

---

## 6. Estructura y layout

- Cuadrícula visible, tenue. La página se ve **medida**. Márgenes que respiran, pero alineación de milímetro.
- Hairlines de 1px como único separador. Cero sombras. Cero `border-radius` mayor a 2px.
- Todo dato importante va **tabulado y alineado a la derecha** si es numérico.
- Marcadores numerados (01 / 02 / 03) **sólo** si el contenido es de verdad una secuencia. En este producto sí lo hay: el árbol de decisión del árbitro es una secuencia real. Ahí sí se numera. En "beneficios" no.

---

## 7. Voz y copy

El árbitro habla en hechos. Frases cortas. Verbos activos. Sin adjetivos de venta.

Prohibido: *revolucionario, seamless, potenciado por IA, desbloquea, transforma, next-gen, solución integral.*

Titulares candidatos (elegir uno, no mezclar):
1. **"El veredicto que se sostiene."**
2. **"Verificamos que el camión llegó. Tú decides si pagas."**
3. **"Tres respuestas. Ninguna discutible."**

Subtítulo, en el mismo registro: *"J-Telemetry cruza el GPS de cada unidad contra la ruta que contrataste y emite un fallo por cada servicio. Se calcula una vez. No se edita."*

Ese "no se edita" es el activo comercial más grande que tienes. Debe estar en la primera pantalla.

---

## 8. Las cuatro caras

Mismo sistema, distinta temperatura:

- **`j-tel.io` (pública):** cinematográfica, editorial, oscura o clara según la prueba. Vende autoridad. Encamina al login que toque; **no guarda datos**.
- **`portal.j-tel.io` (cliente):** clara, evidenciaria, tranquila. Una sola puerta; el alcance (corporativo vs. planta) lo decide el rol, no la URL.
- **`carrier.j-tel.io` (transportista):** densa, operativa, tabla-primero. Es una herramienta de trabajo diario.
- **`staff.j-tel.io` (J-Staff):** utilitaria, sin adorno. Consola interna.

---

## 9. Cómo correr la prueba entre las tres herramientas

Pégale este documento completo a cada una, con el mismo encargo: **"Construye sólo el hero de la landing pública de j-tel.io, con la secuencia del veredicto."**

- **v0 (Vercel):** te devuelve React + Tailwind que se lleva directo al repo `j-tel`. Es el que mejor sobrevive al pasar a producción.
- **Framer:** te devuelve el sitio publicado más pulido, pero vive en su plataforma. Bueno para la landing, no para las caras internas.
- **Claude Design:** con este brief encima debería dejar de salir genérico. Es la prueba de control.

Juzga con una sola pregunta: **¿el sello se sintió?** Si el sello no impacta, la herramienta perdió.

---

## 10. Piso de calidad (no negociable)

Responsivo hasta móvil. Foco de teclado visible. `prefers-reduced-motion` respetado. Contraste AA. Fuentes cargadas sin salto de layout. Todo lo demás es humo si esto no está.
