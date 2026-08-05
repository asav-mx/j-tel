/**
 * A dónde ibas antes de que la guardia te parara — pieza 1.j.
 *
 * Quien llega por un enlace profundo —el correo de una alerta, un expediente
 * compartido— hoy termina en la puerta y tiene que volver a navegar a mano. La
 * guardia ya sabe a dónde iba; falta llevarlo de vuelta al entrar.
 *
 * ## Este archivo es la parte peligrosa, y por eso vive solo
 *
 * **El destino viaja en la URL.** Un `?volver=` sin comprobar es un redirector
 * abierto: un enlace que se ve nuestro —nuestro dominio, nuestro candado,
 * nuestra pantalla de entrar— y que avienta a la persona a un sitio ajeno
 * **justo después de que confió lo suficiente como para teclear su
 * contraseña**. Es el peor momento posible para mandarla a otro lado.
 *
 * Por eso la decisión vive aparte de la pantalla y de la guardia: es pura, se
 * prueba sola, y no hay forma de usarla a medias.
 *
 * ## Se valida la SALIDA, no la entrada. Esto se midió.
 *
 * La comprobación obvia —parsear contra un origen centinela y exigir que el
 * origen no cambie— **no alcanza**, y no alcanzaba por un caso concreto que
 * apareció al probar cadenas de ataque contra el parser de Node antes de
 * escribir nada:
 *
 * ```
 * new URL("/..//evil.com", centinela)
 *   → origin: el centinela  ✅ pasa la comprobación de origen
 *   → pathname: "//evil.com"  ❌ y eso el navegador lo lee como PROTOCOL-RELATIVE
 * ```
 *
 * O sea: la comprobación de origen dice que sí, y lo que devuelves es una URL
 * externa. El `..` se resuelve durante el parseo y el resultado ya no se parece
 * a lo que validaste.
 *
 * De ahí la regla que gobierna este archivo: **lo que se comprueba es la cadena
 * que se va a devolver**, después de todas las normalizaciones del parser, no
 * la que llegó. Otras dos que salieron de la misma medición:
 *
 * - `"  //evil.com"` — los espacios de adelante se recortan y queda externa.
 * - `"/\tx//evil.com"` — el parser **borra** los caracteres de control en
 *   silencio, así que la cadena validada y la devuelta serían distintas. Aquí
 *   se rechaza de entrada en vez de dejar que se reescriba sola.
 *
 * ## Dos capas, y viven separadas porque si no, una no se puede probar
 *
 * `rutaRelativaSegura` es la capa estructural. `destinoDeVuelta` le suma la
 * lista blanca de caras. Están partidas a propósito, y la razón salió de las
 * pruebas de mutación:
 *
 * > Con una sola función, **quitarle la comprobación de origen no ponía nada en
 * > rojo**. No porque no sirviera, sino porque la lista blanca ataja los mismos
 * > casos un paso después y la batería no notaba la diferencia. Una defensa que
 * > ninguna prueba distingue es una defensa que no sabes si tienes.
 *
 * Partidas, cada capa tiene su propia batería y sus propias mutaciones. Las dos
 * tienen que pasar para que un destino se acepte, y ninguna depende de que la
 * otra esté bien.
 */

/** El nombre del parámetro. Un solo lugar; la pantalla y la guardia lo leen de aquí. */
export const PARAM_VOLVER = "volver";

/**
 * El encabezado donde el middleware deja la ruta con su búsqueda:
 * `/cliente/servicio/abc?fecha=2026-08-04`. Nunca lleva origen.
 *
 * Vive aquí y no en `middleware.ts` por una razón concreta: la guardia lo
 * necesita, y si lo importara del middleware arrastraría el SDK de servidor de
 * Clerk y `next/server` a cada página que llame a la guardia. Este archivo no
 * importa nada, así que lo pueden leer los dos lados.
 */
export const ENCABEZADO_RUTA_COMPLETA = "x-jtel-url";

/**
 * Un origen que no existe y que nadie puede resolver. Solo sirve de referencia
 * para el parseo: si el candidato lo cambia, es que traía origen propio.
 */
const CENTINELA = "https://destino.invalido";

/** Un enlace profundo de este producto no se acerca ni de lejos. */
const LARGO_MAXIMO = 512;

/**
 * Las caras. `entrar` no está: sería un bucle. La portada tampoco — volver a
 * «/» no es volver a ningún lado, y quien llame ya tiene la portada de
 * respaldo.
 */
const CARAS_PERMITIDAS = new Set(["cliente", "carrier", "jstaff", "quien-soy"]);

/**
 * Capa 1 — ¿esto es una ruta de este sitio, y sigue siéndolo después de que el
 * parser la normalice?
 *
 * No sabe nada de caras ni del producto: solo de la forma. Se exporta para que
 * tenga su propia batería, no porque alguien deba usarla sola — el destino que
 * se acepta es el de `destinoDeVuelta`.
 */
export function rutaRelativaSegura(crudo: unknown): string | null {
  if (typeof crudo !== "string") return null;
  if (crudo.length === 0 || crudo.length > LARGO_MAXIMO) return null;

  /*
   * Caracteres de control, incluidos tabulador, salto de línea y retorno. El
   * parser los borra sin avisar —medido—, así que validar después de que los
   * borre significa validar una cadena que nadie mandó. Un enlace legítimo de
   * este producto no los trae.
   */
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(crudo)) return null;

  /*
   * Espacios de adelante y de atrás. `"  //evil.com"` se recorta durante el
   * parseo y sale externa — medido. Se rechaza en vez de recortarlo nosotros:
   * un destino legítimo no viene con espacios.
   */
  if (crudo !== crudo.trim()) return null;

  /*
   * Tiene que venir ya como ruta absoluta del sitio. Sin esto, `"cliente"`
   * —sin barra— se resuelve contra el centinela y sale `/cliente`: inofensivo,
   * pero es devolver algo que quien preguntó no escribió. La guardia siempre
   * manda la barra; lo que no la trae, no viene de la guardia.
   */
  if (!crudo.startsWith("/")) return null;

  let url: URL;
  try {
    url = new URL(crudo, CENTINELA);
  } catch {
    return null;
  }

  // Origen propio: `https://evil.com`, `//evil.com`, `javascript:…` (que da
  // origen `null`). Los tres mueren aquí.
  if (url.origin !== CENTINELA) return null;

  // Lo que se va a devolver. El fragmento se deja fuera: no llega al servidor y
  // no aporta nada al destino.
  const destino = `${url.pathname}${url.search}`;

  /*
   * La que ataja a `/..//evil.com`. Después de resolver el `..`, el pathname
   * quedó `//evil.com` — mismo origen para el parser, externa para el
   * navegador. Se exige una sola barra al inicio, sobre la cadena final.
   *
   * No se comprueba además que empiece con `/`: habiendo pasado la
   * comprobación de origen, el `pathname` de una URL https **siempre** empieza
   * con barra. Ese `if` estaba escrito y ninguna mutación lo ponía en rojo,
   * porque no hay entrada que lo dispare. Un candado que no cierra nada solo
   * infla la cuenta de candados.
   */
  if (destino.startsWith("//")) return null;

  return destino;
}

/**
 * Capa 2 — y además, ¿es una de nuestras caras?
 *
 * `null` significa **«no hay a dónde volver»**, y quien llama debe caer a la
 * portada. Nunca significa «casi» ni «arréglalo»: ante cualquier duda, null.
 *
 * No devuelve el motivo del rechazo a propósito. Un mensaje que explique por
 * qué se rechazó un `?volver=` le enseña a quien lo está probando cuál es la
 * siguiente forma que sí pasa.
 */
export function destinoDeVuelta(crudo: unknown): string | null {
  const destino = rutaRelativaSegura(crudo);
  if (destino === null) return null;

  const cara = destino.slice(1).split(/[/?]/)[0] ?? "";
  if (!CARAS_PERMITIDAS.has(cara)) return null;

  return destino;
}
