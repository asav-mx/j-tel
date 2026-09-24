import type { MetadataRoute } from "next";

/**
 * **El `robots.txt` de Ontoy.**
 *
 * Hasta hoy no existía: quien pedía `/robots.txt` recibía un 404, y un
 * buscador sin instrucciones rastrea todo lo que encuentra. Para la app del
 * pasajero eso está bien —**queremos** que la gente encuentre sus rutas— pero
 * deja sin decir lo único que no debería salir en una búsqueda: la pantalla de
 * operación del lector del camión.
 *
 * ## Por qué `/validador` NO va en `Disallow`
 *
 * Es la trampa de este archivo, y por eso se escribe aquí.
 *
 * `Disallow` no quiere decir «no lo muestres»: quiere decir **«no lo
 * rastrees»**. Un buscador que tiene prohibido rastrear una dirección tampoco
 * puede leer el `noindex` que esa página trae dentro — y si alguien la enlaza
 * desde fuera, puede acabar listada igual, como una liga pelona sin título. El
 * `Disallow` conseguiría exactamente lo contrario de lo que pide la regla.
 *
 * Lo que sí la saca de los buscadores es **dejar que la rastreen y encontrarse
 * un `noindex`**. Eso es lo que hay, por partida doble:
 *
 * - la etiqueta en el HTML (`robots: { index: false, follow: false }` en
 *   `app/validador/page.tsx`), y
 * - la cabecera `X-Robots-Tag` en la respuesta (`next.config.ts`), que vale
 *   aunque nadie lea el HTML.
 *
 * ## Lo que este archivo NO es
 *
 * No es seguridad. `robots.txt` es una petición que los buscadores serios
 * respetan y cualquier otro ignora, y además **es público**: escribir aquí una
 * dirección que uno quiere esconder es anunciarla. La puerta del lector la
 * cuida el alta del aparato, no esto.
 */
export const dynamic = "force-static";

/** De variable, como el resto de lo que sabe dónde vive la app. */
const SITIO = process.env.NEXT_PUBLIC_SITIO ?? "https://ontoy.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /*
       * Lo único que se pide no rastrear son las consultas del teléfono: no
       * son páginas, cambian cada 15 segundos y rastrearlas sólo gasta
       * peticiones de las que cuenta el límite del firewall. No son secretas
       * —la app las hace a la vista— y por eso decirlo aquí no anuncia nada.
       */
      disallow: "/api/",
    },
    host: SITIO,
  };
}
