import type { Metadata } from "next";
import Link from "next/link";
import { fondoDelMapa } from "@/lib/ontoy/mapa-base";

/**
 * **La página pública de privacidad** — Ontoy, Parte B (la tienda).
 *
 * Dice exactamente lo que la app hace, y **cada afirmación tiene su lugar en el
 * código** (la declaración para las tiendas, `docs/Ontoy-Declaracion-De-Datos.md`,
 * lleva la cita de cada una). Si un día el texto y el código no coinciden, gana
 * el código y se corrige el texto.
 *
 * Misma regla que los textos cortos de las pantallas
 * (`docs/Ficha-Textos-De-Privacidad.md`): **se dice el PARA QUÉ y lo que
 * hacemos nosotros, no se jura el DÓNDE para siempre.** Por eso aquí no aparece
 * «ningún servidor»: el fondo del mapa se pide a un tercero, y esta página lo
 * dice en vez de callarlo.
 *
 * El tercero del mapa sale de `fondoDelMapa()`, no de un texto horneado: el día
 * que el mapa se sirva desde nuestro propio almacenamiento (Protomaps), esa
 * sección cambia sola.
 *
 * El nombre de la app y el correo de contacto vienen de configuración
 * (`NEXT_PUBLIC_APP_NOMBRE`, `NEXT_PUBLIC_CONTACTO_PRIVACIDAD`): el código no
 * conoce nombres propios.
 */

const NOMBRE = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Transporte público";
const CONTACTO = process.env.NEXT_PUBLIC_CONTACTO_PRIVACIDAD ?? null;
/** El día en que esta página cambió por última vez. Se mueve a mano, con el texto. */
const VIGENTE_DESDE = "22 de septiembre de 2026";

export const metadata: Metadata = {
  title: `Privacidad · ${NOMBRE}`,
  description: `Qué datos usa ${NOMBRE}, para qué, y qué no hace.`,
};

export default function Privacidad() {
  const mapa = fondoDelMapa();

  return (
    <main className="ontoy-legal">
      <p className="ontoy-legal-salida">
        {/* Toda pantalla tiene su salida (8.10). */}
        <Link href="/">← Volver a {NOMBRE}</Link>
      </p>

      <h1>Privacidad</h1>
      <p className="ontoy-legal-fecha">Vigente desde el {VIGENTE_DESDE}.</p>

      <section>
        <h2>En corto</h2>
        <ul>
          <li>No hay cuenta ni registro. La app no te pide tu nombre, tu correo ni tu teléfono.</li>
          <li>Tu ubicación se usa en tu teléfono para calcular cuándo llega tu camión. La app no la manda a nuestro servidor.</li>
          <li>Tus paradas guardadas se quedan en tu teléfono.</li>
          <li>Contamos cuántas veces se abre cada ruta, sin saber quién la abrió.</li>
          <li>No hay anuncios, no vendemos datos y no te seguimos en otras apps ni sitios.</li>
        </ul>
      </section>

      <section>
        <h2>Tu ubicación</h2>
        <p>
          La app no te pide tu ubicación al abrir. Te la pide cuando tocas «Ver paradas cerca de mí»; si ya se la
          habías dado antes, la usa sin volver a preguntar.
        </p>
        <p>
          Si das permiso, la app lee tu ubicación para enseñarte las paradas que tienes cerca, para marcar dónde
          estás sobre la ruta que abres y para calcular cuánto le falta al camión para llegar hasta donde estás. Todo
          eso se calcula en tu teléfono. La app no envía
          tu ubicación a nuestro servidor, no la guarda y no arma una historia de dónde has estado.
        </p>
        <p>
          Para encontrar las paradas cerca de ti, tu teléfono baja la lista de paradas de todas las rutas —la misma
          para todos, sin ningún dato tuyo— y escoge ahí mismo las más cercanas.
        </p>
        <p>
          Si no das permiso, la app sigue funcionando: ves las rutas, las paradas y los camiones en vivo; sólo no se
          calculan las paradas cerca de ti, ni dónde estás sobre la ruta, ni la llegada hasta ti. Puedes quitar el permiso cuando quieras desde los ajustes de tu teléfono.
        </p>
      </section>

      <section>
        <h2>Lo que se guarda en tu teléfono</h2>
        <p>
          Tus paradas guardadas y si prefieres la app en claro u oscuro se guardan en el almacenamiento de tu
          navegador, en tu teléfono. No viajan a nuestro servidor. Se borran si borras los datos del sitio o
          desinstalas la app.
        </p>
      </section>

      <section>
        <h2>El contador de aperturas</h2>
        <p>
          Cuando abres una ruta, tu teléfono avisa a nuestro servidor que esa ruta se abrió. El aviso no lleva
          ningún dato tuyo. Para no contar dos veces al mismo teléfono en el mismo día, el servidor calcula un código
          a partir de los datos técnicos de la conexión (la dirección IP y el tipo de navegador) y guarda sólo tres
          cosas: la ruta, el día y ese código. <strong>La dirección IP y el tipo de navegador no se guardan.</strong>{" "}
          El código cambia cada día, así que no sirve para saber si un teléfono volvió otro día.
        </p>
        <p>
          Sirve para saber cuánta gente consulta cada ruta y dónde hace falta mejor servicio. Es un indicio, no un
          conteo exacto: varios teléfonos pueden salir a internet con la misma dirección (pasa mucho en las redes
          celulares), y entonces cuentan como uno. <strong>El número real de personas es mayor que el que
          contamos.</strong>
        </p>
      </section>

      <section>
        <h2>El mapa</h2>
        {mapa.hayTercero ? (
          <p>
            Las imágenes del mapa de fondo vienen de {mapa.tercero}. Para mostrarlo, tu teléfono se las pide
            directamente a sus servidores, así que {mapa.tercero} recibe tu dirección IP y qué parte del mapa estás
            viendo, como con cualquier sitio que visitas. Nosotros no le mandamos tu ubicación ni ningún otro dato
            tuyo. Lo que hace con esas peticiones lo rige su propia política de privacidad.
          </p>
        ) : (
          <p>Las imágenes del mapa se sirven desde nuestro propio almacenamiento, sin pasar por terceros.</p>
        )}
      </section>

      <section>
        <h2>Nuestro servidor</h2>
        <p>
          Como cualquier sitio web, el servicio que aloja la app recibe los datos técnicos de cada conexión (como la
          dirección IP) para poder contestarla, y puede anotarlos por un tiempo corto para detectar fallas y abusos.
          No los usamos para saber quién eres.
        </p>
      </section>

      <section>
        <h2>Lo que la app no hace</h2>
        <ul>
          <li>No tiene cuentas, ni pagos, ni notificaciones.</li>
          <li>No muestra quién maneja: los choferes no aparecen en la app.</li>
          <li>De los camiones enseña dónde van ahora, nunca por dónde anduvieron.</li>
          <li>No tiene anuncios ni herramientas de publicidad o rastreo de terceros.</li>
          <li>No vende ni comparte datos para publicidad.</li>
        </ul>
      </section>

      <section>
        <h2>Contacto</h2>
        {CONTACTO ? (
          <p>
            Si tienes una pregunta sobre esta página o sobre tus datos, escríbenos a{" "}
            <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
          </p>
        ) : (
          <p>El correo de contacto todavía no está configurado.</p>
        )}
      </section>

      <p className="ontoy-legal-salida">
        <Link href="/">← Volver a {NOMBRE}</Link>
      </p>
    </main>
  );
}
