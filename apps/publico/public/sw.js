/*
 * El service worker de la app del pasajero.
 *
 * Hace tres cosas y ninguna más:
 *
 *  1. **Guarda el cascarón** para que la app ABRA sin red. Abrir y decir «no
 *     tengo dato» es honesto; el dinosaurio del navegador se lee como «esta app
 *     está rota».
 *  2. **Guarda los pedazos del mapa que el pasajero ya miró.** Ver abajo.
 *  3. **NO guarda nada de lo vivo.** Nunca. Una posición servida de caché
 *     es una posición vieja dibujada en un mapa en vivo, y eso se lee como «va
 *     llegando» cuando el camión pasó hace veinte minutos. Las consultas vivas
 *     (`VIVO`, abajo) pasan derecho a la red, siempre.
 *
 * ✎ **El mapa sin señal, y por qué NO se baja la ciudad completa** (ASAV,
 * 25-sep-2026).
 *
 * El mapa es un archivo de 18 MB que el navegador lee **por rangos**: pide los
 * pedazos que va a dibujar. Guardarlos no es directo, porque una respuesta
 * parcial (`206`) **no se puede meter en la caché del navegador**: `cache.put`
 * la rechaza. Por eso lo de abajo guarda **el cuerpo** de cada pedazo como una
 * respuesta normal, bajo una dirección inventada que dice qué tramo de bytes
 * trae, y arma el `206` al servirlo.
 *
 * **Se guarda lo que el pasajero ya bajó, y ni un byte más.** Medido el 25-sep:
 * abrir el Mapa cuesta **112 KB**, y una sesión de mirar y arrastrar, **658 KB**.
 * El archivo entero son 18 MB — veintiocho veces más. Bajarlo en segundo plano
 * daría la ciudad completa sin señal, pero se gastaría **del plan de datos del
 * pasajero, en silencio**, y otra vez entero cada vez que refresquemos el mapa,
 * porque el nombre del archivo lleva la fecha. *«Nunca gastamos su plan en
 * silencio»* (ASAV) — la misma regla por la que las fuentes se sirven del repo.
 *
 * **El paso siguiente, decidido y para después del lanzamiento:** un botón
 * «Guardar el mapa para usarlo sin datos» que baje los 18 MB **sólo cuando el
 * pasajero lo toque**, diciéndole lo que pesa. Necesita pantalla, así que no es
 * de este frente; está escrito en `docs/Ontoy-Mapa-Base.md`.
 *
 * **Lo que esto SÍ promete, sin adornos:** sin señal se ve la parte de la ciudad
 * por la que el pasajero ya anduvo, en los zooms que usó; lo demás queda del
 * color del suelo. Es lo que había con los 300 mosaicos de OpenStreetMap, y un
 * poco mejor, porque ahora los nombres de las calles viajan en el pedazo.
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

/* ✎ v5 (25-sep-2026): subió para que los teléfonos **borraran las teselas de
   OpenStreetMap** que tuvieran guardadas. El fondo ya no viene de ahí, y una
   caché con 300 mosaicos ajenos que nadie va a volver a pedir es puro peso.
   ✎ v6, el mismo día: sube porque nace la caché del mapa. La de la v5 no
   estorbaría, pero dejarla obliga a acordarse de ella; subir la versión la borra
   sola. */
const VERSION = "v6";
const CASCARON = `cascaron-${VERSION}`;
const MAPA = `mapa-${VERSION}`;

/*
 * Cuántos pedazos del mapa se guardan. Cada uno pesa entre 10 y 60 KB, así que
 * 400 son unos 10 MB: generoso para las calles por las que uno anda, y **menos
 * que el archivo entero**, que es justo lo que no se baja. Se podan los más
 * viejos primero, como se podaban los mosaicos.
 */
const TOPE_PEDAZOS = 400;

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
        Promise.all(
          llaves.filter((k) => k !== CASCARON && k !== MAPA).map((k) => caches.delete(k)),
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
  if (VIVO.some((v) => url.pathname.includes(v))) return;

  /*
   * El mapa: cada pedazo que ya bajó se guarda y se vuelve a servir de ahí.
   *
   * **Una petición del mapa SIN rango pasa derecho**, y no es un descuido: sería
   * el archivo entero, 18 MB, que es lo que no se baja a espaldas del pasajero.
   * Hoy nadie la hace —`pmtiles` siempre pide rangos—, y si alguien la hiciera,
   * que cueste lo que cuesta y no se quede guardada.
   */
  if (url.pathname.startsWith("/mapa/")) {
    const rango = leerRango(evento.request.headers.get("range"));
    if (rango) evento.respondWith(delMapa(evento.request, url.pathname, rango));
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

/* ── El mapa, pedazo por pedazo ─────────────────────────────────────────── */

/**
 * `bytes=100-199` → `{ desde: 100, hasta: 199 }`.
 *
 * Devuelve `null` para todo lo demás, y eso **manda la petición a la red sin
 * tocarla**: un rango abierto (`bytes=100-`), uno contado desde el final
 * (`bytes=-500`) o varios de golpe son válidos en HTTP y aquí no se saben
 * servir. Contestarlos a medias sería peor que no contestarlos. `pmtiles`
 * siempre pide la primera forma.
 */
function leerRango(cabecera) {
  const m = /^bytes=(\d+)-(\d+)$/.exec((cabecera ?? "").trim());
  if (!m) return null;
  const desde = Number(m[1]);
  const hasta = Number(m[2]);
  return hasta >= desde ? { desde, hasta } : null;
}

/** `bytes 100-199/18440352` → `{ desde, hasta, total }`. */
function leerContentRange(cabecera) {
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec((cabecera ?? "").trim());
  if (!m) return null;
  return { desde: Number(m[1]), hasta: Number(m[2]), total: Number(m[3]) };
}

/**
 * La dirección con la que se guarda un pedazo. **Es inventada**: no existe en el
 * servidor y nunca se pide así. Lleva el tramo de bytes adentro porque es lo que
 * permite encontrarlo después sin abrir el contenido.
 *
 * Va entera —con origen— y no sólo la ruta: la caché guarda peticiones, y una
 * petición se construye con una dirección absoluta.
 */
function direccionDelPedazo(ruta, desde, hasta) {
  return new URL(`${ruta}?desde=${desde}&hasta=${hasta}`, self.location.origin).toString();
}

/**
 * Un pedazo guardado que **contenga** el rango pedido, o `null`.
 *
 * Contener, y no coincidir: `pmtiles` junta teselas vecinas en una sola petición
 * y los tramos cambian según qué teselas toque dibujar. Buscando coincidencias
 * exactas, volver al mismo lugar del mapa fallaría la mitad de las veces y el
 * pasajero sin señal vería huecos en una calle por la que sí anduvo.
 */
async function pedazoQueContiene(cache, ruta, rango) {
  for (const peticion of await cache.keys()) {
    const url = new URL(peticion.url);
    if (url.pathname !== ruta) continue;
    const desde = Number(url.searchParams.get("desde"));
    const hasta = Number(url.searchParams.get("hasta"));
    if (desde <= rango.desde && hasta >= rango.hasta) {
      const guardada = await cache.match(peticion);
      if (guardada) return { respuesta: guardada, desde };
    }
  }
  return null;
}

/** Arma el `206` que el navegador espera, recortando del pedazo guardado. */
async function recortar(guardado, rango) {
  const bytes = await guardado.respuesta.arrayBuffer();
  const inicio = rango.desde - guardado.desde;
  const trozo = bytes.slice(inicio, inicio + (rango.hasta - rango.desde + 1));
  const etag = guardado.respuesta.headers.get("x-etag");
  return new Response(trozo, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(trozo.byteLength),
      "Content-Range": `bytes ${rango.desde}-${rango.hasta}/${guardado.respuesta.headers.get("x-total") ?? "*"}`,
      "Accept-Ranges": "bytes",
      /* El mismo ETag que dio el servidor. `pmtiles` lo compara entre peticiones
         para enterarse de si el archivo cambió debajo; si de la caché saliera
         otro —o ninguno— se caería creyendo que el mapa se movió. */
      ...(etag ? { ETag: etag } : {}),
    },
  });
}

async function delMapa(peticion, ruta, rango) {
  const cache = await caches.open(MAPA);

  const guardado = await pedazoQueContiene(cache, ruta, rango);
  if (guardado) return recortar(guardado, rango);

  try {
    const respuesta = await fetch(peticion);
    /* Guardar va en segundo plano: el pasajero no espera a que se guarde para
       ver su mapa. */
    if (respuesta.status === 206) guardar(cache, ruta, respuesta.clone());
    return respuesta;
  } catch {
    /*
     * Sin red y sin este pedazo guardado. Por ahí el mapa queda del color del
     * suelo: **mejor un hueco que una calle que no es**, que es la misma regla
     * que tenían los mosaicos.
     */
    return Response.error();
  }
}

async function guardar(cache, ruta, respuesta) {
  const cr = leerContentRange(respuesta.headers.get("content-range"));
  if (!cr) return;
  const cuerpo = await respuesta.arrayBuffer();
  /*
   * Se guarda como respuesta **normal**, no como la parcial que llegó: un `206`
   * no se puede meter en la caché del navegador. El tramo de bytes viaja en la
   * dirección inventada, y el total y el ETag en dos cabeceras nuestras, que es
   * lo que permite rearmar el `206` al servirlo.
   */
  await cache.put(
    new Request(direccionDelPedazo(ruta, cr.desde, cr.hasta)),
    new Response(cuerpo, {
      headers: {
        "Content-Type": "application/octet-stream",
        "x-total": String(cr.total),
        ...(respuesta.headers.get("etag") ? { "x-etag": respuesta.headers.get("etag") } : {}),
      },
    }),
  );
  await tirarMapasViejos(cache, ruta);
  await podar(cache);
}

/**
 * Los pedazos de un mapa anterior se van en cuanto llega el primero del nuevo.
 *
 * El nombre del archivo lleva la fecha, así que refrescar el mapa **cambia la
 * dirección** y lo guardado deja de pedirse: se quedaría ocupando lugar para
 * siempre y, por el tope, empujaría fuera de la caché los pedazos del mapa que
 * sí se usa.
 */
async function tirarMapasViejos(cache, ruta) {
  for (const peticion of await cache.keys()) {
    if (new URL(peticion.url).pathname !== ruta) await cache.delete(peticion);
  }
}

/* Poda en orden de inserción: lo más viejo se va primero. */
async function podar(cache) {
  const llaves = await cache.keys();
  if (llaves.length <= TOPE_PEDAZOS) return;
  for (const llave of llaves.slice(0, llaves.length - TOPE_PEDAZOS)) {
    await cache.delete(llave);
  }
}
