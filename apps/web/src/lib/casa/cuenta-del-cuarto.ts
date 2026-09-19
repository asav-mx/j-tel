import { resolverCuentaYElegibles } from "@/lib/account-context";
import { exigirEnPagina, exigirSesion } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";
import type { Alcance, CuentaDeLaCasa } from "@/lib/casa/casas";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * De qué cuenta es el cuarto, con sus dos guardias.
 *
 * 1. **Sesión**, antes de leer nada de nadie.
 * 2. **La cuenta**: la resuelve la misma regla de `/carrier`
 *    —la del usuario si es una sola, o la de `?account=` si ve varias—, y luego
 *    la guardia fina la exige por su slug. Es la guardia por cuenta que el
 *    cascarón dejó anunciada para su primer cuarto (#413).
 *
 * Devuelve siempre `casa`, lo que el marco necesita para no perder la cuenta al
 * navegar y para ofrecer el selector. Con `carrier: null` no hay una cuenta que
 * mostrar: la página lo dice, sin dibujar un solo dato, y `casa.elegibles` dice
 * si hay de dónde elegir.
 *
 * `cuentaEnRuta` es el slug sólo si vino en la dirección: las ligas internas lo
 * arrastran para no perder la cuenta al navegar, y no lo agregan si no hacía
 * falta.
 *
 * `alcance` es lo que la cuenta tiene encendido, leído de la base —no una
 * constante—: con algún contrato que no sea borrador, Vernier está encendido y
 * el menú dibuja Servicios especiales (mapa, regla 4). Transporte público queda
 * en `false` mientras Circuitos no tenga cuarto: con `ruta: null` el menú no lo
 * dibujaría de todos modos, y leer la concesión para no usarla sería afirmar
 * algo que nadie mira.
 */
export async function cuentaDelCuarto(searchParams: SearchParams) {
  await exigirSesion();
  const params = await searchParams;
  const { cuenta: carrier, elegibles } = await resolverCuentaYElegibles("carrier", params);
  const opciones = elegibles.map((c) => ({ slug: c.slug, nombre: c.name }));

  if (!carrier) {
    const casa: CuentaDeLaCasa = { actual: null, enRuta: null, elegibles: opciones };
    return { carrier: null, casa } as const;
  }

  const identidad = await exigirEnPagina({ tipo: "carrier", slug: carrier.slug });
  const alcance: Alcance = {
    conContrato: await getRepos().expedientes.tieneContratoEncendido(carrier.id),
    operaPublico: false,
  };
  const cuentaEnRuta = typeof params?.account === "string" && params.account ? carrier.slug : null;
  const casa: CuentaDeLaCasa = {
    actual: { slug: carrier.slug, nombre: carrier.name },
    enRuta: cuentaEnRuta,
    elegibles: opciones,
  };
  return { carrier, identidad, cuentaEnRuta, casa, alcance };
}
