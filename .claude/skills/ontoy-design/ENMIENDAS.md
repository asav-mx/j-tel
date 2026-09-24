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

## (c) Dónde vive cada cosa en ontoy.app — 23-sep-2026

Decisión de Asav, que cierra el «pendiente técnico» del §12 del handoff:

| Dirección | Qué |
|---|---|
| `ontoy.app/` | **La app.** Es el `start_url` del manifiesto: lo que abre el ícono instalado |
| `ontoy.app/c/‹ruta›` | Una ruta, para compartir |
| `ontoy.app/p/‹parada›` | Lo que abre el QR del poste |
| `ontoy.app/validador` | El lector del camión |
| `ontoy.app/conoce` | **La landing** |

**La regla detrás:** ninguna dirección que un pasajero guarde, instale o escanee cambia
después. Quien escanea un letrero o toca el ícono quiere su camión, no una portada.

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
