/*
 * El service worker de la app del pasajero.
 *
 * Hace tres cosas y ninguna más:
 *
 *  1. **Guarda el cascarón** para que la app ABRA sin red. Abrir y decir «no
 *     tengo dato» es honesto; el dinosaurio del navegador se lee como «esta app
 *     está rota».
 *  2. **Guarda las teselas del mapa** con un tope. Las teselas son de lejos lo
 *     más pesado que baja esta app, y un pasajero recorre casi siempre las
 *     mismas calles.
 *  3. **NO guarda nada de las unidades.** Nunca. Una posición servida de caché
 *     es una posición vieja dibujada en un mapa en vivo, y eso se lee como «va
 *     llegando» cuando el camión pasó hace veinte minutos. Ese endpoint pasa
 *     derecho a la red, siempre.
 */

const VERSION = "v1";
const CASCARON = `cascaron-${VERSION}`;
const TESELAS = `teselas-${VERSION}`;

/* Cuántas teselas se guardan. ~50 KB cada una: 300 son unos 15 MB, que es
   generoso para un recorrido y sigue siendo poco para un teléfono. */
const TOPE_TESELAS = 300;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CASCARON).then((c) => c.addAll(["/", "/icono.svg", "/manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((llaves) =>
        Promise.all(
          llaves
            .filter((k) => k !== CASCARON && k !== TESELAS)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  if (evento.request.method !== "GET") return;

  /* Lo vivo NO se cachea. Ver la nota 3 de arriba: es la regla que impide
     dibujar un camión donde ya no está. */
  if (url.pathname.includes("/unidades")) return;

  /* Teselas del mapa: de caché si están, y si no, de la red guardando copia. */
  if (/^[abc]\.tile\.openstreetmap\.org$/.test(url.hostname)) {
    evento.respondWith(deTeselas(evento.request));
    return;
  }

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

async function deTeselas(peticion) {
  const cache = await caches.open(TESELAS);
  const guardada = await cache.match(peticion);
  if (guardada) return guardada;

  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) {
      cache.put(peticion, respuesta.clone());
      podar(cache);
    }
    return respuesta;
  } catch {
    // Sin red y sin tesela guardada: el mapa queda con huecos grises. Es la
    // versión honesta — mejor un hueco que una calle que no es.
    return Response.error();
  }
}

/* Poda en orden de inserción: lo más viejo se va primero. */
async function podar(cache) {
  const llaves = await cache.keys();
  if (llaves.length <= TOPE_TESELAS) return;
  for (const llave of llaves.slice(0, llaves.length - TOPE_TESELAS)) {
    await cache.delete(llave);
  }
}
