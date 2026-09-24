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
| `ontoy.app/` | **La app.** Inicio: tus rutas, cuándo pasa tu camión | Existe |
| `ontoy.app/c/‹ruta›` | Una ruta, para compartir por mensaje | Existe |
| `ontoy.app/validador` | El lector del camión | Existe |
| `ontoy.app/privacidad` | Qué se guarda y qué no | Existe |
| `ontoy.app/p/‹parada›` | Lo que abre el QR del poste | Llega con el #536 |
| `ontoy.app/conoce` | **La landing.** Para quien todavía no conoce Ontoy | Reservada; la landing se escribe después del 29 |

## Por qué la app se queda en la raíz, y no la landing

Se consideraron las dos, y la diferencia no es de gusto.

**La app en la raíz (lo decidido).** Nada se mueve. El `start_url` sigue siendo `/`, los
enlaces compartidos siguen siendo `/c/‹ruta›`, el QR del poste nace en `/p/‹parada›`. La
landing nace en una dirección que **hoy no existe**, así que no puede romper nada de nadie. Y
es lo que quiere quien llega: **quien escanea un letrero parado en la banqueta, o toca el
ícono de su pantalla de inicio, quiere su camión** — no una portada que le explique el
producto que ya está usando.

**La landing en la raíz (descartada).** Habría que mudar la app a su propia ruta, por ejemplo
`/rutas`. Eso rompe el `start_url`: **el ícono ya instalado apunta a `/`**, y abriría la
landing en vez de la app. Y no se arregla redirigiendo, porque `/` tendría que contestar dos
cosas distintas según si el teléfono instaló la app o no, y **eso el servidor no lo sabe**.

La landing gana lo suyo sin estar en la raíz: es la dirección que va en redes, en los flyers y
en el sticker QR de la tiendita, donde el que llega **de verdad** no conoce Ontoy todavía.

## Qué cuida esto, y qué no

`apps/publico/src/app/direcciones.test.ts` revisa que **las direcciones que ya existen no se
muevan**: que haya página en la raíz, en `/c/‹ruta›` y en `/validador`, y que el `start_url`
del manifiesto siga siendo `/`.

Es una valla chica y es a propósito: mide lo único que de verdad está en riesgo, que es que un
cambio de estructura del router mueva una dirección **sin que nadie lo note**, porque mover una
carpeta compila igual de bien.

Lo que la valla **no** puede cuidar:

- **La reserva de `/conoce`.** Hoy no existe nada ahí, y una prueba que exija que no exista se
  caería el día que la landing entre, que es justo cuando debe pasar. Queda escrita aquí.
- **El `/p/‹parada›` del #536.** Su página no está en `main` todavía. Cuando entre, su
  dirección ya está reservada en esta tabla.
- **Un dominio apuntado mal en un panel.** Eso vive en `docs/Procedimiento-Dominio-Ontoy-App.md`
  y en la mudanza del #534.

## Lo que falta, y de quién depende

- **El registro de `ontoy.app`.** En curso. Cuando termine, se conecta siguiendo
  `docs/Procedimiento-Dominio-Ontoy-App.md`.
- **La landing en `/conoce`.** Después del 29 (handoff §10). Su copia no promete el planeador:
  dice lo que la app ya hace.
