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
 * El titular: `1 de oct`.
 *
 * Corto porque va en el renglón de la derecha de la fila de la ruta, donde rima
 * con el `Abre 05:00` de fuera de horario. La fecha completa va en la frase de
 * la tarjeta, que es donde hay lugar para leerla sin abreviar.
 *
 * `null` si la fecha no se puede leer: **un titular vacío es mejor que uno
 * inventado**, y la frase de abajo tampoco se dibuja.
 *
 * > ✎ **25-sep-2026 — lleva «de».** Nació escribiendo `15 sep` y el diseño
 * > final de la app lo escribe `1 de oct`. El copy del handoff es final
 * > (#562), así que manda él. Se deja anotado porque cambiar el formato de una
 * > fecha no rompe nada y por eso se cambia sin querer: si alguien lo ve
 * > distinto al diseño, es que lo movieron después de esto.
 */
export function arranqueCorto(fechaIso: string): string | null {
  const d = alMediodia(fechaIso);
  if (!d) return null;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  })
    .format(d)
    /* `es-MX` escribe «15 sept» y a veces con punto. Se recorta a tres letras
       sin punto: cabe en el titular y se lee igual de rápido. */
    .replace(/\.$/, "")
    .replace(/(\d+)\s+(\p{L}{3})\p{L}*/u, "$1 de $2");
}

/**
 * La frase: `1 de octubre`.
 *
 * Sin año: un arranque se declara con semanas de anticipación, no con años, y
 * el año de más ocupa lugar sin decir nada.
 *
 * > ✎ **25-sep-2026 — se le quitó el día de la semana.** Nació escribiendo
 * > `martes 15 de septiembre`, con este argumento, que sigue siendo bueno: «es
 * > lo que la gente usa para ubicarse — *el lunes* se agenda, *el 15* se busca
 * > en el calendario».
 * >
 * > Lo que manda encima es que **el copy del handoff es final** (#562): la
 * > tarjeta dice «Arranca el **1 de octubre**.» y la fila «arranca · 1 de oct».
 * > Nadie llamaba a esta función todavía, así que el cambio no movió ninguna
 * > pantalla — pero se anota, con su argumento entero, para que reponerlo
 * > cueste una línea y no una investigación.
 */
export function arranqueLargo(fechaIso: string): string | null {
  const d = alMediodia(fechaIso);
  if (!d) return null;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(d);
}
