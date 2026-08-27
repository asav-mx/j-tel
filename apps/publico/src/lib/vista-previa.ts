import { getRepos } from "@/lib/db";

/**
 * La vista previa: abrir la app contra un circuito **sin publicarlo**.
 *
 * Existe porque el Marco §F distingue dos cosas que se habían confundido —
 * inventar datos está prohibido; montar un espacio aparte con datos reales no—
 * y porque sin esto no había forma de ver la app contra camiones de verdad
 * antes de prender el interruptor. La única alternativa era publicar y
 * despublicar, que expone el circuito en la portada durante la ventana.
 *
 * ## Las tres cosas que la hacen segura, y ninguna sobra
 *
 * 1. **En producción no existe.** No es una bandera que alguien pueda dejar
 *    encendida: es una rama que el build de producción nunca toma. Un
 *    `JTEL_VISTA_PREVIA` puesto por error en Vercel no hace absolutamente nada.
 * 2. **Hay que nombrar el slug exacto.** No hay valor que abra todo — ni `1`,
 *    ni `true`, ni `*`. Abrir dos circuitos exige nombrar los dos.
 * 3. **Es una sola función, y la llaman los tres caminos.** El comentario de
 *    `getPublishedCircuitBySlug` advierte que un filtro repartido por los
 *    handlers se abre borrando una línea. Esto respeta esa forma: la puerta
 *    sigue siendo una, y la excepción también.
 */
export function vistaPreviaPermitida(slug: string): boolean {
  if (process.env.NODE_ENV === "production") return false;

  return (process.env.JTEL_VISTA_PREVIA ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(slug);
}

/**
 * El circuito que la app puede enseñar: el publicado siempre, y el sin publicar
 * sólo cuando la vista previa lo permite.
 *
 * Devuelve también `esVistaPrevia`, y no es un detalle: la pantalla tiene que
 * poder decirlo. Una app que se ve idéntica publicada y sin publicar es cómo
 * alguien acaba creyendo que ya está en la calle.
 */
export async function circuitoParaLaApp(slug: string) {
  const repos = getRepos();

  const publicado = await repos.circuits.getPublishedCircuitBySlug(slug);
  if (publicado) return { circuito: publicado, esVistaPrevia: false as const };

  if (!vistaPreviaPermitida(slug)) return null;

  const sinPublicar = await repos.circuits.getCircuitByPublicSlug(slug);
  if (!sinPublicar) return null;

  return { circuito: sinPublicar, esVistaPrevia: true as const };
}
