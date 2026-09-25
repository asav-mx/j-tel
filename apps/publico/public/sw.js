/*
 * El service worker de la app del pasajero.
 *
 * Hace tres cosas y ninguna más:
 *
 *  1. **Guarda el cascarón** para que la app ABRA sin red. Abrir y decir «no
 *     tengo dato» es honesto; el dinosaurio del navegador se lee como «esta app
 *     está rota».
 *  2. **NO toca el archivo del mapa.** Ver abajo.
 *  3. **NO guarda nada de lo vivo.** Nunca. Una posición servida de caché
 *     es una posición vieja dibujada en un mapa en vivo, y eso se lee como «va
 *     llegando» cuando el camión pasó hace veinte minutos. Las consultas vivas
 *     (`VIVO`, abajo) pasan derecho a la red, siempre.
 *
 * ✎ **El mapa dejó de pasar por aquí, y es una pérdida que hay que decir.**
 * Antes el fondo eran mosaicos de OpenStreetMap y este archivo guardaba hasta
 * 300, así que sin señal el pasajero veía el pedazo de ciudad por donde ya había
 * andado. Ahora el mapa es **un archivo nuestro que el navegador lee por
 * rangos**, y una respuesta parcial (`206`) **no se puede guardar en la caché
 * del navegador**: `cache.put` la rechaza. El mecanismo no sirve, así que el
 * mapa se excluye en vez de dejar que reviente en silencio con cada rango.
 *
 * Se puede hacer **mejor** que lo que había —guardar el archivo completo la
 * primera vez que alguien abre el mapa y servir los rangos desde ahí: toda la
 * ciudad sin señal, en todos los zooms, en vez de nada más lo que se miró— y es
 * su propio PR. Mientras no entre, **sin señal no hay mapa de fondo**: la app
 * abre, las rutas y las paradas siguen ahí, y el mapa queda del color del suelo.
 * Está escrito en `docs/Ontoy-Mapa-Base.md` para que nadie lo cuente como parejo.
 *
 * ✎ 25-sep-2026: **`/rutas` entra al cascarón y la versión sube a v4.** La app se
 * mudó ahí y el `start_url` del manifiesto apunta ahí (ASAV): sin esto, la app
 * instalada abriría su propia dirección sin red y no la encontraría en caché. La
 * raíz se queda en la lista mientras siga enseñando la app.
 *
 * ✎ 22-sep-2026: la consulta de las favoritas (`/api/circuitos/en-vivo`, PR 3b)
 * nació sin estar en la lista —sólo se exceptuaba `/unidades`— y este archivo
 * la guardaba en caché: sin red, la app habría enseñado camiones de hace rato
 * como si fueran de ahora. La lista se volvió explícita, una prueba
 * (`sw.test.ts`) se cae si una consulta viva nueva no está en ella, y la
 * versión sube para que los teléfonos borren lo que ya hubieran guardado.
 */

/** Lo vivo: nunca de caché. Si agregas una consulta viva, va aquí (lo exige `sw.test.ts`). */
const VIVO = ["/unidades", "/api/circuitos/en-vivo"];

/* ✎ v5 (25-sep-2026): sube para que los teléfonos **borren las teselas de
   OpenStreetMap** que tengan guardadas. El fondo ya no viene de ahí, y una
   caché con 300 mosaicos ajenos que nadie va a volver a pedir es puro peso. */
const VERSION = "v5";
const CASCARON = `cascaron-${VERSION}`;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    /* `/validador` entra al cascarón porque el lector del camión TIENE que abrir
       sin red: es su caso normal, no su excepción. Si no estuviera aquí, un
       chofer en un tramo sin señal recargaría y se quedaría sin lector. */
    caches
      .open(CASCARON)
      .then((c) =>
        c.addAll(["/rutas", "/", "/validador", "/icono.svg", "/manifest.webmanifest"]),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((llaves) =>
        Promise.all(llaves.filter((k) => k !== CASCARON).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  if (evento.request.method !== "GET") return;

  /* Lo vivo NO se cachea. Ver la nota 3 de arriba: es la regla que impide
     dibujar un camión donde ya no está. */
  if (VIVO.some((v) => url.pathname.includes(v))) return;

  /*
   * **El archivo del mapa pasa derecho, sin tocarlo.** El navegador lo pide por
   * rangos y la respuesta es un `206`, que `cache.put` rechaza: dejarlo caer en
   * la rama de abajo llenaría la consola de promesas rotas en cada arrastre del
   * mapa, sin que el mapa se viera mal. Un error que no se ve es peor que uno que
   * se ve. Ver la nota de arriba: guardar el archivo completo es otro PR.
   */
  if (url.pathname.startsWith("/mapa/")) return;

  /* La forma del circuito y el cascarón: red primero para no servir un trazado
     viejo cuando hay señal, caché cuando no la hay. */
  if (url.origin === self.location.origin) {
    evento.respondWith(
      fetch(evento.request)
        .then((r) => {
          const copia = r.clone();
          caches.open(CASCARON).then((c) => c.put(evento.request, copia));
          return r;
        })
        .catch(() => caches.match(evento.request).then((r) => r ?? Response.error())),
    );
  }
});

/*
 * Aquí vivían `deTeselas` y `podar`, la caché de los 300 mosaicos de
 * OpenStreetMap. Se fueron con los mosaicos: **no se dejan «por si acaso»**,
 * porque un mecanismo de caché que nadie llama se lee como que el mapa sigue
 * guardándose, y eso es justo lo que ya no pasa. Lo que viene en su lugar está
 * dicho arriba y en `docs/Ontoy-Mapa-Base.md`.
 */
