# Ontoy — dónde vive cada cosa en `ontoy.app`

**Decisión de ASAV, 23 de septiembre de 2026.** Se decidió y se construyó **antes del 28**, a
propósito: lo que sigue es de las pocas cosas de este producto que **no se pueden cambiar
después**.

## La regla

> **Ninguna dirección que un pasajero guarde, instale o escanee cambia después.**

No es una preferencia de orden. Es que las tres cosas que un pasajero hace con una dirección
la sacan del repo y la dejan **fuera de nuestro alcance**:

- **La guarda.** Un marcador en su teléfono, o un mensaje de WhatsApp reenviado veinte veces.
- **La instala.** El `start_url` del manifiesto **se graba al instalar**. Cambiarlo no mueve el
  ícono que ya está en la pantalla de inicio de nadie: ése sigue apuntando a donde apuntaba.
- **La escanea.** Un letrero atornillado a un poste. Imprimir, repartir y pegar toma días, y
  despegarlo toma otros tantos — más el camión que hay que mandar.

De las tres, la que no tiene arreglo es la impresa. Un despliegue corrige una pantalla en
minutos; una lámina mal impresa se corrige con un humano en una escalera.

## El mapa

| Dirección | Qué hay | Estado |
|---|---|---|
| `ontoy.app/` | **La landing.** Para quien todavía no conoce Ontoy | Reservada. **Hoy enseña la app** mientras la landing no exista |
| `ontoy.app/rutas` | **La app.** Inicio: tus rutas, cuándo pasa tu camión. Es el `start_url` | Existe |
| `ontoy.app/c/‹ruta›` | Una ruta, para compartir por mensaje | Existe |
| `ontoy.app/validador` | El lector del camión | Existe |
| `ontoy.app/privacidad` | Qué se guarda y qué no | Existe |
| `ontoy.app/p/‹parada›` | Lo que abre el QR del poste | Existe (#536) |

## La decisión cambió el 25 de septiembre, y por qué el cambio no rompe nada

**Primero se decidió la app en la raíz** (23-sep), con este argumento: la landing
en la raíz obliga a mudar la app a `/rutas`, y **el `start_url` se graba al
instalar**, así que el ícono de quien ya la tenía abriría la landing en vez de su
camión. Y eso no se arregla redirigiendo, porque `/` tendría que contestar dos
cosas según si el teléfono instaló la app o no, y el servidor no lo sabe.

**El 25-sep ASAV lo cambió:** la landing va en la raíz, porque *la gente escribe
«ontoy.app» y nada más*.

**El argumento viejo era cierto, y se resolvió por fecha en vez de por dirección.**
Lo que rompe un ícono instalado no es *que* el `start_url` cambie: es que cambie
**después** de que la gente instaló. Así que se mueve **ahora**, mientras casi
nadie la tiene instalada, y no el día que la landing entre. El día que la landing
tome la raíz, el `start_url` ya dirá `/rutas` desde hace semanas y ningún ícono
cambiará de destino.

Mientras la landing no exista, **la raíz sigue enseñando la app**: nadie se queda
sin nada en el camino.

## La app vive en `/rutas` y es la raíz la que reenvía

No al revés, y es lo único delicado de todo esto. Si la app viviera en
`app/page.tsx` y `/rutas` reenviara a ella, el día que la raíz se volviera la
landing **`/rutas` se volvería la landing con ella** — y el ícono instalado de
todos abriría una portada.

Así que la app vive en `app/rutas/page.tsx` y `app/page.tsx` es un reenvío de una
línea. **Lo que se reemplaza al escribir la landing es la raíz**, y no se lleva
nada. Lo cuida `direcciones.test.ts`.

Y el `start_url` va al cascarón del service worker (`/rutas`, con la versión
subida a `v4`): sin eso, la app instalada abriría su propia dirección sin red y
no la encontraría en caché.

## Qué cuida esto, y qué no

`apps/publico/src/app/direcciones.test.ts` revisa que **las direcciones que ya existen no se
muevan**: que haya página en la raíz, en `/rutas`, en `/c/‹ruta›`, en `/validador`, en
`/privacidad` y en `/p/‹parada›`, y que el `start_url` del manifiesto siga siendo `/rutas`.

Es una valla chica y es a propósito: mide lo único que de verdad está en riesgo, que es que un
cambio de estructura del router mueva una dirección **sin que nadie lo note**, porque mover una
carpeta compila igual de bien.

Lo que la valla **no** puede cuidar:

- **Que la raíz se vuelva la landing.** Una prueba no puede exigir que eso *no* haya pasado
  todavía: se caería el día que debe pasar. Lo que sí cuida es que ese día `/rutas` no se vaya
  con ella.
- **Que un letrero ya impreso siga abriendo.** La valla cuida que `/p/‹parada›` siga
  sirviéndose; que el `qr_slug` de una lámina concreta siga existiendo en la base es otra
  pregunta, y la cuida la `0055` —`circuit_stops` con RESTRICT— no esta prueba.
- **Un dominio apuntado mal en un panel.** Eso vive en `docs/Procedimiento-Dominio-Ontoy-App.md`
  y en la mudanza del #534.

## Lo que falta, y de quién depende

- **El registro de `ontoy.app`.** En curso. Cuando termine, se conecta siguiendo
  `docs/Procedimiento-Dominio-Ontoy-App.md`.
- **La landing en la raíz.** La escribe el otro constructor desde `Ontoy Landing v2`, meta
  viernes 3 de octubre. Su copia **no promete el planeador**: dice lo que la app ya hace.
