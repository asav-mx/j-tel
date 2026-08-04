import { exigirEnPagina } from "@/lib/guardia-pagina";

/**
 * La puerta de J-Staff.
 *
 * Existe por dos razones distintas, y conviene no confundirlas:
 *
 * 1. **Cubre lo que todavía no se ha escrito.** Una página nueva bajo `/jstaff`
 *    queda protegida el día que alguien la cree, sin que tenga que acordarse de
 *    llamar a la guardia. Es la parte que un puñado de llamadas sueltas no da.
 *
 * 2. **No sustituye a la guardia de cada página.** Un layout de Next **no se
 *    vuelve a renderizar** al navegar entre rutas hermanas del mismo segmento,
 *    así que como única comprobación es frágil por construcción. Aquí no muerde
 *    —las nueve páginas exigen exactamente la misma audiencia, así que estar
 *    dentro ya significa haberla pasado—, pero la regla general es comprobar
 *    cerca del dato, y eso es lo que hacen las páginas.
 *
 * Las dos juntas: el layout como red, la página como comprobación.
 *
 * `/jstaff` es lo más filoso del producto: `diagnostico` y `verificacion`
 * enseñan **el razonamiento interno del árbitro**. Su ruta de API equivalente
 * lleva protegida y marcada como confidencial desde el #134; la pantalla que
 * mostraba lo mismo, no. Un árbitro cuya cocina es visible para el auditado
 * deja de ser árbitro.
 */
export default async function JStaffLayout({ children }: { children: React.ReactNode }) {
  await exigirEnPagina({ tipo: "jstaff" });
  return <>{children}</>;
}
