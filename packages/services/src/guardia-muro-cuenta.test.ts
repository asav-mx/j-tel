import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * El muro de cuenta en la lectura de evidencia del motor.
 *
 * **El IMEI no es el muro; la cuenta sí** (Pieza 1.C). Un aparato que cambió de
 * cuenta (6.14) conserva su IMEI, y sus puntos de antes del cambio se quedaron
 * archivados en la cuenta anterior. Una lectura por IMEI solo —
 * `telemetry.getForImeis`— le entrega al árbitro el recorrido de OTRO
 * transportista, y el árbitro sella con él. El resultado no es un error
 * visible: es un hecho falso pero creíble, firmado, en el expediente de un
 * cliente. Es la clase de daño que no se ve revisando el diff.
 *
 * Hasta el 17 de septiembre de 2026 el motor leía así. No mordió porque las
 * cuentas con esos IMEI eran todas de Asav — se midió en producción ese día:
 * cero IMEIs con puntos en más de una cuenta, así que cerrar la puerta no movió
 * ningún veredicto ya sellado. Se cerró con el campo vacío justamente para no
 * tener que cerrarla con dos transportistas reales dentro.
 *
 * Una prueba de comportamiento sola no alcanzaría: comprueba el camino que hoy
 * existe, no el que alguien escriba mañana. Un `getForImeis` nuevo en el motor
 * pasaría verde y volvería a abrir la puerta en silencio. Esta prueba lee el
 * código de los archivos del camino del veredicto y exige que la lectura
 * siempre lleve cuenta, así que **una lectura sin muro nace en rojo**.
 *
 * `getForImeis` sigue existiendo, sin muro y a propósito: ver su comentario en
 * `packages/db/src/repositories/index.ts`. Su único llamador permitido es el
 * guion de diagnóstico que la lista de abajo exime por nombre.
 */

const SRC = path.dirname(fileURLToPath(import.meta.url));

/**
 * El camino del veredicto: todo lo que lee evidencia para sellar un hecho, o
 * para escribir un dato que el motor después usa para juzgar.
 */
const CAMINO_DEL_VEREDICTO = [
  "verification.ts",
  "reverificacion-zona-motor.ts",
  // No sella, pero escribe `route_traversal_measurements`, que dimensiona la
  // ventana derivada — o sea, entra al motor por la puerta de atrás.
  "backfill-duraciones-ruta.ts",
];

/**
 * Exentos, con nombre y motivo. Una lista vacía sería más limpia y menos
 * honesta: lo que pudre una regla como ésta es la excepción que nadie escribió.
 */
const EXENTOS: Record<string, string> = {
  "medir-ventana-vs-ruta.ts":
    "Guion de diagnóstico de solo lectura: no escribe en la base, no toca hechos " +
    "ni el cron. Mira a propósito más ancho que la ventana del viaje, y ver los " +
    "puntos de cualquier cuenta es lo que permite MEDIR el muro.",
};

function leer(archivo: string): string {
  return readFileSync(path.join(SRC, archivo), "utf8");
}

/** Llamadas a `repos.telemetry.getForImeis(`, sin contar `getForImeisDeCuenta`. */
function lecturasSinCuenta(fuente: string): number {
  return (fuente.match(/\.getForImeis\s*\(/g) ?? []).length;
}

describe("guardia · el motor lee la evidencia con el muro de cuenta", () => {
  for (const archivo of CAMINO_DEL_VEREDICTO) {
    it(`${archivo} no llama a getForImeis (la lectura sin cuenta)`, () => {
      const fuente = leer(archivo);
      expect(
        lecturasSinCuenta(fuente),
        `${archivo} lee telemetría sin filtrar por cuenta. El IMEI no es el muro: ` +
          `usa repos.telemetry.getForImeisDeCuenta(carrierAccountId, imeis, desde, hasta).`,
      ).toBe(0);
    });

    it(`${archivo} sí lee con getForImeisDeCuenta`, () => {
      // Sin esto, borrar la lectura entera dejaría la prueba de arriba en verde.
      expect(leer(archivo)).toContain("getForImeisDeCuenta(");
    });
  }

  it("los exentos siguen siendo exactamente los que están escritos aquí", () => {
    // Si un archivo nuevo empieza a leer sin cuenta, o si el exento deja de
    // necesitarlo, esta lista deja de corresponder y hay que decidir a mano.
    expect(Object.keys(EXENTOS)).toEqual(["medir-ventana-vs-ruta.ts"]);
    expect(lecturasSinCuenta(leer("medir-ventana-vs-ruta.ts"))).toBeGreaterThan(0);
  });
});
