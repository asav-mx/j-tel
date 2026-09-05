import { NextResponse } from "next/server";
import { fechaLocalDelCircuito, huellaDeApertura } from "@jtel/domain/publico";
import { getRepos } from "@/lib/db";
import { circuitoParaLaApp } from "@/lib/vista-previa";

/**
 * **La apertura de la app.** El contador anónimo, y la primera ruta de ESCRITURA
 * de toda la cara pública.
 *
 * ## Por qué es un evento propio y explícito
 *
 * Contar aperturas desde el tráfico que ya existe no es una alternativa peor:
 * **no funciona.** El endpoint de la FORMA se sirve con `s-maxage=300`, así que
 * el CDN contesta casi siempre sin invocar la función y esas aperturas no
 * llegarían nunca. Y el de unidades se pide cada quince segundos: contar ahí
 * sería contar sondeos, no gente abriendo la app.
 *
 * Un evento propio dice lo que dice: alguien abrió esta ruta. Una vez.
 *
 * ## Lo que NO se guarda, que es la mitad del diseño
 *
 * **Nada en el teléfono.** Ni cookie, ni `localStorage`, ni identificador que
 * viaje de vuelta. El aparato no tiene que recordar nada para que su segunda
 * apertura del día no cuente dos veces: eso lo resuelve el servidor derivando
 * la huella de lo que la petición ya traía.
 *
 * **Nada que se pueda ligar entre días.** La huella lleva el día adentro, y
 * rota con él. De aquí no sale «cuántos volvieron» — medir regresos sería otro
 * producto, con su propio consentimiento, y no una puerta trasera de éste.
 *
 * **Ni la IP ni el agente se guardan.** Entran al HMAC y no quedan en ninguna
 * columna. Lo que se conserva son treinta y dos caracteres que no se invierten.
 *
 * ## La misma puerta que el resto de la cara pública
 *
 * Un circuito no publicado contesta lo mismo que un slug inventado, por
 * `circuitoParaLaApp`. Sin eso, esta ruta sería el lugar por donde alguien
 * averigua qué slugs existen antes de que existan para el pasajero — y sería la
 * puerta más fácil, porque una escritura contesta distinto según encuentre o no.
 */

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const visible = await circuitoParaLaApp(slug);
  if (!visible) {
    return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });
  }
  const { circuito } = visible;

  const secreto = process.env.JTEL_SECRET_KEY;
  if (!secreto) {
    /*
     * Sin llave la huella no sería opaca, así que NO SE CUENTA. Se contesta
     * 204 igual: el pasajero no tiene nada que ver con esto y una pantalla no
     * se rompe por un contador.
     *
     * No es un silencio peligroso: sin `JTEL_SECRET_KEY` el endpoint de
     * unidades ya contesta 503 y la app no funciona, así que este caso no
     * produce un cero que alguien pueda leer como «nadie abrió».
     */
    return sinCuerpo();
  }

  /*
   * El día CIVIL DEL CIRCUITO, no el del servidor. Es el mismo que rota la
   * huella y el mismo que se guarda: si aquí se colara la fecha de UTC, un
   * pasajero de las 23:30 en Juárez contaría en el día siguiente y su segunda
   * apertura de esa noche no se deduplicaría con la primera.
   */
  const fechaLocal = fechaLocalDelCircuito(new Date(), circuito.timeZone);

  await getRepos().circuits.registrarApertura({
    circuitId: circuito.id,
    localDate: fechaLocal,
    fingerprint: huellaDeApertura({
      ip: ipDe(request),
      agente: request.headers.get("user-agent") ?? "",
      fechaLocal,
      circuitoId: circuito.id,
      secreto,
    }),
  });

  return sinCuerpo();
}

/**
 * De dónde sale la IP.
 *
 * `x-forwarded-for` puede traer una cadena de proxies; **la primera es la del
 * cliente** y las demás son intermediarios. Tomar la última contaría a todos
 * los que compartan salida como un solo aparato.
 *
 * Cadena vacía si no viene ninguna, y entonces la huella la arma el resto: es
 * peor distinguiendo, y es exactamente lo que el rótulo del expediente admite.
 * Inventar aquí un valor por aparato sería fabricar distinguibilidad que no
 * existe.
 */
function ipDe(request: Request): string {
  const cadena = request.headers.get("x-forwarded-for");
  if (cadena) return cadena.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() ?? "";
}

/**
 * 204 y nada más. La app dispara esto y sigue con lo suyo: no espera respuesta,
 * no la lee, y no cambia nada de lo que el pasajero ve.
 *
 * `no-store` explícito porque esto **no se cachea nunca**: una apertura
 * guardada en un CDN sería una apertura que no se cuenta.
 */
function sinCuerpo() {
  return new NextResponse(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
