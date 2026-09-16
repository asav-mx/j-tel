import { headers } from "next/headers";

/**
 * El cronómetro de las páginas del cascarón — la mitad del servidor.
 *
 * Existe por un caso con fecha: el 16 de septiembre de 2026 la consulta que
 * hacía lento Expedientes bajó de 3.3 s a 1 ms (#423) y Asav siguió sintiendo
 * la pantalla igual de lenta. Medir la consulta no es medir lo que vive quien
 * da el clic. Esto deja en los registros de Vercel, por cada render:
 *
 *   · cuánto tardó la guardia (sesión, cuenta, membresía);
 *   · cuánto tardaron los datos;
 *   · el total del render;
 *   · si fue una **precarga** de Next (un enlace a la vista se pide solo) o una
 *     visita de verdad — una lista que precarga cada ficha multiplica el
 *     trabajo sin que nadie haya tocado nada;
 *   · y qué despliegue lo atendió: una pestaña abierta antes de un despliegue
 *     sigue pegada a su versión vieja.
 *
 * Sólo escribe números y la ruta: nada de nadie. Se lee con los registros de
 * Vercel buscando `[cronometro]`. Se quita cuando la lentitud esté cerrada.
 */
export async function relojDePagina(pagina: string) {
  const inicio = performance.now();
  const h = await headers();
  const precarga = h.get("next-router-prefetch") === "1" || h.get("purpose") === "prefetch";
  const marcas: Array<[string, number]> = [];
  let ultima = inicio;

  return {
    /** Cierra un tramo con su nombre: lo que pasó desde la marca anterior. */
    marca(tramo: string) {
      const ahora = performance.now();
      marcas.push([tramo, ahora - ultima]);
      ultima = ahora;
    },
    /** Escribe la línea. Se llama al terminar de juntar los datos. */
    fin() {
      const total = performance.now() - inicio;
      const tramos = marcas.map(([t, ms]) => `${t}=${Math.round(ms)}ms`).join(" ");
      console.log(
        `[cronometro] servidor pagina=${pagina} total=${Math.round(total)}ms ${tramos} precarga=${precarga ? "si" : "no"} despliegue=${process.env.VERCEL_DEPLOYMENT_ID ?? "local"}`,
      );
    },
  };
}
