import { NextResponse } from "next/server";
import { igualEnTiempoConstante } from "@/lib/comparacion-segura";

/**
 * La guardia de las siete rutas de cron.
 *
 * Las siete traían la misma línea copiada: `process.env.CRON_SECRET` seguido de
 * `??` y un valor de respaldo fijo, escrito en el código y **publicado tal cual
 * en el README y en `DESPUES.md`** — no se repite aquí por la misma razón por
 * la que se quitó de allá. La cuenta completa: si `CRON_SECRET` faltaba en el
 * entorno —una variable mal escrita,
 * un despliegue nuevo, un preview— las siete rutas seguían contestando 200 a
 * quien mandara un secreto que cualquiera podía leer en el repositorio. Entre
 * ellas `/api/cron/verify`, que sella veredictos, y `/api/cron/archive`, que
 * consume la cuota de Umbrella.
 *
 * `verificar-env.mjs` sí exige la variable, pero eso valida el entorno al
 * arrancar — no quita el respaldo del código. Un arranque que pasó la
 * comprobación y perdió la variable después seguía cayendo al secreto
 * publicado.
 *
 * **Sin variable no se sirve.** No hay valor por omisión, ni en desarrollo:
 * un respaldo que solo existe "para local" es exactamente el que se va a
 * producción el día que alguien olvide la variable.
 *
 * ## Por qué 503 y no 401
 *
 * Son dos fallas distintas y decirlas igual cuesta caro. Un 401 afirma "tu
 * secreto no sirve", que le echa la culpa a quien llama y manda a revisar el
 * cron. Cuando lo que falta es la variable del servidor, el que está roto es
 * el servidor: eso es un 503, que además Vercel marca como corrida fallida y
 * queda a la vista. Un 401 se ve idéntico a un cron mal configurado y se
 * ignora durante semanas.
 *
 * Mismo criterio que ya usaban `/api/cron/alertas` y `/api/cron/alertas-resumen`
 * cuando falta `DATABASE_URL`: falta configuración del servidor → 503.
 *
 * ## El orden importa
 *
 * La comprobación de la variable va **antes** de mirar el encabezado. Si se
 * hiciera al revés, una petición sin `Authorization` recibiría 401 y taparía
 * el hecho de que el servidor no tiene secreto: el 503 nunca se vería y la
 * mala configuración seguiría escondida detrás de una respuesta que parece
 * normal.
 */

/** El nombre sale en el registro y en el cuerpo; se escribe una vez. */
const VARIABLE = "CRON_SECRET";

/**
 * Devuelve la respuesta con la que hay que contestar, o `null` para dejar
 * pasar. Se lee `const negada = exigirCron(request); if (negada) return negada;`
 * — la forma más corta que no se puede ignorar sin querer.
 */
export function exigirCron(request: Request, ruta: string): NextResponse | null {
  // `?? ""` y no `??` a secas: una variable presente pero vacía es una
  // variable que falta. `verificar-env.mjs` ya la trata así.
  const secreto = (process.env[VARIABLE] ?? "").trim();

  if (!secreto) {
    /*
     * A `console.error` y no a `console.log`: esto no es telemetría de una
     * corrida, es el servidor diciendo que no puede hacer su trabajo. En
     * Vercel sale como error y se puede alertar sobre él.
     */
    console.error(
      `[${ruta}] ${VARIABLE} no está configurada — la ruta no se sirve.`,
    );
    return NextResponse.json(
      {
        error: `${VARIABLE} no está configurada en el servidor.`,
        detalle:
          "La ruta no tiene secreto contra el cual comparar, así que no se sirve. No hay valor por omisión a propósito.",
      },
      { status: 503 },
    );
  }

  const encabezado = request.headers.get("authorization");
  if (!encabezado || !igualEnTiempoConstante(encabezado, `Bearer ${secreto}`)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return null;
}
