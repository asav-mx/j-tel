import { cargarCuartoDeExpedientes, type CuartoDeExpedientes } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { armarArchivero, type Archivero } from "@/lib/casa/archivero";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";

type Parametros = Promise<Record<string, string | string[] | undefined>>;

/**
 * Lo que leen el tablero y los tres cajones, de una pasada: la guardia de la
 * cuenta, el cuarto de Expedientes y sus piezas ya en palabras. Una sola carga
 * para las cuatro pantallas, para que una pieza no diga una cosa en el tablero
 * y otra en su cajón.
 */
export async function leerArchivero(searchParams: Parametros, pagina: string) {
  const reloj = await relojDePagina(pagina);
  const cuenta = await cuentaDelCuarto(searchParams);
  reloj.marca("guardia");
  if (!cuenta.carrier) {
    reloj.fin();
    return { cuenta, lleno: null };
  }
  const ahora = new Date();
  const cuarto: CuartoDeExpedientes = await cargarCuartoDeExpedientes(getRepos(), { carrierAccountId: cuenta.carrier.id, ahora });
  reloj.marca("datos");
  reloj.fin();
  const archivero: Archivero = armarArchivero(cuarto, ahora, cuenta.cuentaEnRuta);
  return {
    cuenta,
    lleno: {
      carrier: cuenta.carrier,
      cuentaEnRuta: cuenta.cuentaEnRuta,
      identidad: cuenta.identidad,
      alcance: cuenta.alcance,
      cuarto,
      archivero,
      sp: await searchParams,
    },
  };
}
