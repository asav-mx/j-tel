"use client";

import { useEffect, useState } from "react";

/**
 * **¿Este teléfono ve el pase de pruebas?** — para el lanzamiento, no
 * (decisión de ASAV, 25-sep-2026).
 *
 * El pase de pruebas es R&D: viajes de mentira, compras simuladas y reglas de
 * ley que son suposiciones hasta el abogado. Enseñarle eso a un pasajero el día
 * del lanzamiento es prometerle algo que ningún camión cumple. El pasajero ve
 * «Pronto podrás pagar con tu teléfono» (4-pase/03 y 05).
 *
 * **El pase de pruebas no se borra**, porque es trabajo que sigue: se prende
 * por teléfono con `?pase=pruebas` en cualquier dirección de la app, y se queda
 * prendido en ese teléfono hasta `?pase=publico`. Así quien prueba no tiene que
 * volver a escribirlo cada vez que abre la app instalada, que abre sin consulta.
 *
 * **No es seguridad**, y conviene decirlo: cualquiera que conozca la palabra lo
 * prende. Lo que esconde es una pantalla de ensayo, no un dato. Nada de lo que
 * el pase de pruebas hace cobra ni llega a un servidor que cobre.
 */

export const LLAVE_PASE_DE_PRUEBAS = "ontoy.pase-de-pruebas";

/**
 * Lo que dice la dirección, y si hay que tocar lo guardado.
 * `guardar`: `true` lo prende, `false` lo apaga, `null` no lo toca.
 */
export function leerPaseDePruebas(
  consulta: string,
  guardado: string | null,
): { ver: boolean; guardar: boolean | null } {
  const pedido = new URLSearchParams(consulta).get("pase");
  if (pedido === "pruebas") return { ver: true, guardar: true };
  if (pedido === "publico") return { ver: false, guardar: false };
  return { ver: guardado === "1", guardar: null };
}

/**
 * `false` hasta montar, y eso es a propósito: el HTML del servidor y el primer
 * cuadro enseñan **siempre** la pantalla del lanzamiento. Un pasajero nunca ve
 * el pase de pruebas ni un instante; quien lo prendió lo ve un cuadro después.
 */
export function usePaseDePruebas(): boolean {
  const [ver, setVer] = useState(false);
  useEffect(() => {
    try {
      const { ver, guardar } = leerPaseDePruebas(
        window.location.search,
        window.localStorage.getItem(LLAVE_PASE_DE_PRUEBAS),
      );
      if (guardar === true) window.localStorage.setItem(LLAVE_PASE_DE_PRUEBAS, "1");
      if (guardar === false) window.localStorage.removeItem(LLAVE_PASE_DE_PRUEBAS);
      setVer(ver);
    } catch {
      /* sin almacenamiento (modo privado): se queda la pantalla del lanzamiento */
    }
  }, []);
  return ver;
}
