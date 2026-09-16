import { resolveAccountByType } from "@/lib/account-context";
import { exigirEnPagina, exigirSesion } from "@/lib/guardia-pagina";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * De qué cuenta es el cuarto, con sus dos guardias.
 *
 * 1. **Sesión**, antes de leer nada de nadie.
 * 2. **La cuenta**: la resuelve `resolveAccountByType` igual que en `/carrier`
 *    —la del usuario si es una sola, o la de `?account=` si ve varias—, y luego
 *    la guardia fina la exige por su slug. Es la guardia por cuenta que el
 *    cascarón dejó anunciada para su primer cuarto (#413).
 *
 * Devuelve `null` si no hay una cuenta que mostrar: la página lo dice, sin
 * dibujar un solo dato.
 *
 * `cuentaEnRuta` es el slug sólo si vino en la dirección: las ligas internas lo
 * arrastran para no perder la cuenta al navegar, y no lo agregan si no hacía
 * falta.
 */
export async function cuentaDelCuarto(searchParams: SearchParams) {
  await exigirSesion();
  const params = await searchParams;
  const carrier = await resolveAccountByType("carrier", params);
  if (!carrier) return null;
  const identidad = await exigirEnPagina({ tipo: "carrier", slug: carrier.slug });
  const cuentaEnRuta = typeof params?.account === "string" && params.account ? carrier.slug : null;
  return { carrier, identidad, cuentaEnRuta };
}
