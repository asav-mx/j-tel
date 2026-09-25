/**
 * Cómo se escribe el día en que arranca un circuito, para el pasajero.
 *
 * Vive fuera del componente por la razón de siempre —una frase escrita dentro
 * de un `.tsx` no se puede probar sin montar la pantalla— y por una segunda que
 * aquí pesa: **una fecha mal formateada no se ve rota, se ve creíble.** Un día
 * corrido por uno manda a alguien a la parada un día antes, y en la pantalla no
 * hay nada que se vea mal.
 *
 * ## El día se lee como día civil, sin zona de por medio
 *
 * `service_launch_date` es un `DATE`: no tiene hora, y por lo tanto no tiene
 * instante. El error clásico es `new Date("2026-09-15")`, que Postgres y
 * JavaScript leen distinto —JS lo toma como medianoche UTC— y en Juárez
 * (UTC-6) se dibuja como el **14**. Aquí se arma a mediodía UTC y se formatea
 * en UTC: cualquier zona del mundo cae en el mismo día civil, que es lo único
 * que esta fecha significa.
 *
 * La zona del circuito ya hizo su trabajo antes, en `yaArrancoElServicio`, que
 * es quien decide **si** arrancó. Esto sólo escribe **cuándo**.
 */

/** Mediodía UTC del día civil: cualquier zona lo lee como el mismo día. */
function alMediodia(fechaIso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaIso);
  if (!m) return null;
  const [, y, mes, d] = m;
  const instante = new Date(Date.UTC(Number(y), Number(mes) - 1, Number(d), 12));
  if (Number.isNaN(instante.getTime())) return null;
  /*
   * `Date.UTC` NO rechaza un día imposible: lo desborda. `2026-13-45` no da
   * error, da el 14 de febrero de 2027 — una fecha perfectamente creíble, en
   * otro año, que nadie declaró. Lo encontró la prueba de esta función.
   *
   * La comprobación es de ida y vuelta: si el día que salió no es el día que
   * entró, la cadena no era una fecha.
   */
  if (
    instante.getUTCFullYear() !== Number(y) ||
    instante.getUTCMonth() !== Number(mes) - 1 ||
    instante.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return instante;
}

/**
 * El renglón corto: `jue 1 oct`.
 *
 * Corto porque va en la columna de la derecha de la fila de la ruta, donde rima
 * con el `Abre 05:00` de fuera de horario. La fecha completa va en la frase de
 * la tarjeta, que es donde hay lugar para leerla sin abreviar.
 *
 * **Lleva el día de la semana y no lleva «de»,** y las dos cosas van juntas: en
 * una forma donde el mes ya se abrevia a `oct` y el día a `jue`, un «de» entero
 * está fuera de registro — y sobre todo ocupa el lugar que el `jue` necesita.
 * De los dos, el que se acuerda la gente es el día de la semana.
 *
 * `null` si la fecha no se puede leer: **un renglón vacío es mejor que uno
 * inventado**, y la frase de abajo tampoco se dibuja.
 *
 * > ✎ **Historia, porque este formato ya se movió dos veces en tres días.**
 * > Nació `15 sep` (#373). El diseño final lo escribió `1 de oct` y se ajustó
 * > (#569). ASAV lo corrigió el 25-sep: **con día de la semana**, «la gente se
 * > acuerda del jueves». Queda `jue 1 oct`.
 */
export function arranqueCorto(fechaIso: string): string | null {
  const d = alMediodia(fechaIso);
  if (!d) return null;
  return (
    new Intl.DateTimeFormat("es-MX", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
    })
      .format(d)
      /*
       * `es-MX` escribe «mar, 15 sept» — con coma y con cuatro letras en el
       * mes, a veces con punto. Se deja en tres letras sin punto y sin coma:
       * cabe en la columna y se lee igual de rápido.
       *
       * Se recorta **cada palabra de letras por separado** en vez de una sola
       * expresión con todo adentro: así `septiembre` y `miércoles` se cortan
       * igual sin tener que acertarle al orden en que `Intl` los ponga, que no
       * es el mismo en todas las versiones de Node.
       */
      .replace(/\./g, "")
      .replace(/,/g, "")
      .replace(/\p{L}{3}\p{L}+/gu, (palabra) => palabra.slice(0, 3))
      /*
       * Y el «de» que `Intl` mete solo: `es-MX` con `month: "short"` devuelve
       * «jue, 1 de oct», no «jue 1 oct». En la forma larga el «de» es parte de
       * la frase; aquí, entre abreviaturas, es la palabra que sobra — y es
       * justo el lugar que el `jue` necesita en la columna.
       */
      .replace(/ de /g, " ")
  );
}

/**
 * La frase: `jueves 1 de octubre`.
 *
 * **Con día de la semana**, que es lo que la gente usa para ubicarse: «el
 * jueves» se agenda, «el 1» se busca en el calendario. Sin año: un arranque se
 * declara con semanas de anticipación, no con años, y el año de más ocupa lugar
 * sin decir nada.
 *
 * > ✎ **Fue y volvió, y por eso queda escrito.** Nació así (#373). El #569 se
 * > lo quitó para seguir el copy del handoff, que escribe «Arranca el **1 de
 * > octubre**». ASAV lo devolvió el 25-sep: *«la gente se acuerda del jueves»*.
 * >
 * > O sea que **el copy final del diseño no lo traía y aun así se pone**: es
 * > una corrección de ASAV encima del handoff, no un descuido. Quien compare
 * > la pantalla con el diseño va a ver la diferencia; está aquí la razón.
 */
export function arranqueLargo(fechaIso: string): string | null {
  const d = alMediodia(fechaIso);
  if (!d) return null;
  return (
    new Intl.DateTimeFormat("es-MX", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    })
      .format(d)
      /* `es-MX` mete una coma —«martes, 15 de septiembre»— que dentro de una
         frase corrida se lee como una pausa que nadie quiso. */
      .replace(",", "")
  );
}
