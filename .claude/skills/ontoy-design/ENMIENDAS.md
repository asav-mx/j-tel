# Enmiendas y notas del repo — léelo antes que nada

**Esto manda sobre `CLAUDE.md` y sobre `readme.md`.** Los dos dicen cosas que Asav cambió
después de exportar el skill, y aquí están corregidas.

**Por qué existe este archivo y no están corregidos allá.** Todos los archivos del skill
—menos `SKILL.md`, que gana el renglón que apunta aquí— son **byte por byte** los del zip que
Asav entregó (`Identidad visual de Ontoy_FINAL.zip`, PR #543). Se dejaron así a propósito:
cuando el skill se vuelva a exportar desde la herramienta de diseño, cae encima sin que haya
que reacomodar nada ni recordar qué se había editado a mano. Lo que pasó **después** del zip
vive aquí.

> Si alguien vuelve a exportar el skill: lo único que hay que volver a poner es el renglón de
> `SKILL.md` que apunta a este archivo. Todo lo demás se sobreescribe sin pérdida.

---

## (a) El color de ruta se escoge una vez, de una lista — 23-sep-2026

**Queda sin efecto** lo que dicen `CLAUDE.md` («el color NO se predetermina ni se limita: la
concesión elige cualquiera y el sistema lo ajusta lo mínimo») y `readme.md` («el sistema lo
ajusta lo mínimo para que quede lejos del naranja»).

- **Lo escoge J-Staff al capturar la ruta, de una lista.** Los tonos parecidos al naranja de
  Ontoy **no aparecen en la lista**. El naranja es de Ontoy y de nadie más, y la única forma
  de sostenerlo es no ofrecer un tono que pelee con él.
- **Se guarda uno solo** —el `color_hex` del circuito— y es **el mismo en la lámina del poste,
  en la app y pintado en el camión**.
- **Nada se corrige al dibujar.** Ni corrimiento de tono, ni luz, ni saturación. Lo que se
  capturó es lo que se pinta. Si escribes código: no hay función que le mueva el color a una
  ruta, y no se debe escribir.
- Lo que **sí** sigue, porque no le toca el color a nadie:
  - Texto **sobre** el color: blanco o carbón según contraste ≥ 3:1
    (`apps/publico/src/lib/ontoy/contraste-de-ruta.ts`).
  - El **halo** de la traza sobre el mapa (Marco 8.8c): una orilla del color del lienzo.
  - El color **nunca va solo**: siempre con el nombre o el número de la ruta.
- La lista todavía no existe: hoy J-Staff captura con un selector de color libre
  (`apps/web/src/components/casa/identidad-del-circuito.tsx`). Es un frente aparte.

## (b) La landing no promete el planeador — 23-sep-2026

`Ontoy Landing v2.dc.html` trae el título «¿Ontás? Ontoy te lleva.» y el CTA «Planea tu
viaje» en su lista de opciones. **Los dos prometen el planeador, que no existe.** El archivo
se queda como llegó porque es la hoja de diseño aprobada; la copia nueva entra cuando la
landing se escriba en código.

La landing dice **lo que la app ya hace**: ver tu ruta, cuándo pasa y cómo llegar a tu parada.
Tampoco nombra las notificaciones. Propuesta a falta del visto bueno de Asav: título
«¿Ontás? Mira cuándo pasa tu camión.» · CTA «Ver las rutas» (la misma palabra que ya usa la
app) + «Instálala gratis».

## (c) Dónde vive cada cosa en ontoy.app — 23-sep, **cambiado el 25-sep-2026**

⚠ **La landing NO va en `/conoce`: va en la raíz.** Esta enmienda decía lo contrario hasta
el 25 de septiembre, y lo que manda es `docs/Ontoy-Direcciones.md`, que es el documento del
tema y está al día.

| Dirección | Qué |
|---|---|
| `ontoy.app/` | **La landing.** Para quien todavía no conoce Ontoy |
| `ontoy.app/rutas` | **La app.** Es el `start_url` del manifiesto: lo que abre el ícono instalado |
| `ontoy.app/c/‹ruta›` | Una ruta, para compartir |
| `ontoy.app/p/‹parada›` | Lo que abre el QR del poste |
| `ontoy.app/validador` | El lector del camión |
| `ontoy.app/privacidad` | Qué se guarda y qué no |

**La regla detrás no cambió:** ninguna dirección que un pasajero guarde, instale o escanee
cambia después.

**Lo que cambió es cuál dirección sostiene esa regla.** Primero se decidió la app en la raíz,
porque el `start_url` se graba al instalar y mudarlo después le cambiaría el destino al ícono
de quien ya la tenía. El 25-sep Asav lo cambió: *la gente escribe «ontoy.app» y nada más*. El
argumento viejo era cierto y **se resolvió por fecha en vez de por dirección** — la app se
mudó a `/rutas` de inmediato (#550), mientras casi nadie la tiene instalada, y no el día que
la landing entrara. Cuando la landing tomó la raíz, el `start_url` ya decía `/rutas` desde
hacía semanas y ningún ícono cambió de destino.

Lo cuida `apps/publico/src/app/direcciones.test.ts`.


## (d) Dos colores que la paleta no traía: el latido y el cobre — 24-sep-2026

**Decisión de ASAV, 24-sep-2026,** al llevar los tokens a la app. `tokens/colors.css` no
tiene con qué pintar dos cosas que la app del pasajero **ya enseña** y que no son de
Ontoy: son de J-Tel, y llegan con sus reglas puestas. Se escriben aquí en vez de colarse
como dos hex sueltos en el CSS de la app, que es lo que la regla «nunca inventes un hex»
existe para impedir.

| Token | Día | Noche | Qué es |
|---|---|---|---|
| `--vivo` | `#1D8A5C` | `#34C77B` | **El latido.** Marca que el dato está vivo **ahora** |
| `--senal` | `#B05A0F` | `#FFA24D` | **El cobre de J-Tel:** el dato que cambia mientras alguien lo mira |

**Las reglas que vienen con ellos, y son las que importan:**

- **El verde es del latido y de nada más.** No es un veredicto, no significa «bien», no se
  usa de acento. Un punto verde junto a «Sin servicio» estaría contradiciendo la frase que
  acompaña.
- **El cobre es de J-Tel, no de Ontoy**, y por eso **nunca va en el mismo elemento que el
  naranja**. El naranja es Ontoy —la marca del pasajero— y el cobre es la plataforma
  diciendo «esto se está moviendo»: juntos en una misma pieza, el pasajero leería dos
  marcas peleando por el mismo objeto. En la app hoy el cobre es **una sola cosa**: el
  anillo que cuenta los cinco segundos del código del pase.
- **Los dos son gráficos, no texto**, así que su piso de contraste es 3:1. Medido sobre los
  fondos de la paleta: `--vivo` da 3.58:1 sobre Banqueta y 3.92:1 sobre Hueso; `--senal`,
  4.02:1 y 4.40:1. De noche sobre Azul noche, 6.37:1 y 6.98:1.
- **Tienen par de día y de noche**, a diferencia de `--ruta`. Ésa es la trampa del #370:
  `--ruta` y `--ruta-claro` **no** tienen par en la paleta de noche a propósito, porque los
  inyecta el componente que sabe de qué ruta habla. Éstos no se inyectan: son del tema.

**Dónde quedan escritos.** En `apps/publico/src/app/tokens-ontoy.css`, junto al resto de la
paleta, marcados como lo que son: los dos únicos que no salen de `tokens/colors.css`. Si el
skill se vuelve a exportar con ellos adentro, esta enmienda se borra y el comentario del
archivo apunta al token.

**Lo que esta enmienda NO hace:** no mete el cobre ni el verde a la identidad de Ontoy. Un
dibujo de Ontoy, de Tino o de Cami no los lleva nunca.

## (e) El gris del sistema no alcanza sobre el fondo de la página — 24-sep-2026

`--gris` (`#6B6F78`) mide **4.16:1 sobre `--banqueta`**, y el piso del texto es 4.5. Sobre
`--hueso` mide 4.55 y sí pasa: está calibrado para las **superficies**, no para el fondo.

La Anatomía común del `Estandar de pantallas.md` manda la línea de contexto de 13 px en
`--gris`, y esa línea va debajo del título, sobre el fondo de la página. Ahí no alcanza.

**Decisión de ASAV, 24-sep-2026:** el texto apagado va en **`--carbon-2`** de día (6.78:1
sobre banqueta, 7.42 sobre hueso) y en **`--arena-2`** de noche (7.80:1 sobre Azul noche).
*«El texto se tiene que leer en la calle; la ley de contraste gana a la delicadeza del
dibujo.»*

`--gris` **no se borra ni se cambia de valor**: sigue siendo el token del sistema y sirve
donde la superficie es hueso o papel. Lo que cambia es dónde se puede usar, y eso lo mide
una prueba (`piel-de-ontoy.test.ts`), no la buena memoria de quien escriba la siguiente
pantalla.

La landing llegó a la misma cuenta por su lado (#555) y usa el mismo `--carbon-2`.

---

## Notas del repo (no son enmiendas: son cosas que este repo ya decidió)

**Las fuentes no se bajan de Google al compilar.** `tokens/typography.css` trae un
`@import` de `fonts.googleapis.com`. Para maquetas y prototipos está bien. **Para código de
producción, no:** este repo se cayó tres veces por eso (#294 en la web, #493 y #498 en Ontoy)
y hay una valla en CI que lo revisa (`pnpm fuentes:check`). Las dos apps sirven su letra desde
`src/app/fuentes/` de cada una. `apps/web` ya tiene `bricolage-variable.woff2`; Instrument
Sans habría que bajarla con `scripts/traer-fuentes.mjs`.

**La piel de la app hoy no son estos tokens.** `apps/publico/src/app/ontoy.css` es la que
manda mientras no entre el PR que cambia los colores y la letra por `tokens/`. Ese archivo
**no se edita**: queda reemplazado, no corregido.

**El `apple-touch-icon.png` del zip perdió su fondo opaco.** En el zip del #542 era un
cuadrado Banqueta completo; en el del #543 las esquinas salieron transparentes (4.5 % del
dibujo). iOS no maneja alfa ahí —compone lo transparente sobre **negro**— y encima le pone su
propia máscara redondeada, con otra curva. **Medido: entre 0 y 296 pixeles** oscurecidos según
qué superelipse use iOS (con la más citada, 8, ninguno negro puro). No es un defecto visible;
es un riesgo que depende de una curva ajena, y la ficha del repo (`docs/Ontoy-Iconos.md`) ya
pedía PNG sin transparencia. La copia que sirve la app va aplanada sobre Banqueta `#EDE9E1` y
sin canal alfa, con una prueba que lo cuida (`iconos.test.ts`, #546); **la de aquí se dejó
como llegó**, para que se vea de dónde salió. Vale corregirlo en la herramienta de diseño: la
próxima exportación lo repite.

**La frontera, otra vez, porque es la regla que más se rompe sin querer:** J-Staff, planta y
carrier (el árbitro) **no llevan caritas**. Este universo es del lado del pasajero, de lo
impreso de la calle y de redes. El letrero del poste **sí** lleva a Tino, aunque se imprima
desde una pantalla de J-Staff: lo impreso es calle.

**El 3D de Tino se llama `Paradito 3D.html`.** Es el nombre viejo del personaje; el id interno
sigue siendo `paradito` y el handoff §14 lo dice. No se renombró para no separar el archivo de
su id.
