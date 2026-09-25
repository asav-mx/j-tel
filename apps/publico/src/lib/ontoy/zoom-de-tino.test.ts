import { describe, expect, it } from "vitest";
import { tinoEntero, ZOOM_DE_TINO } from "./zoom-de-tino";

/*
 * **El umbral de Tino.**
 *
 * ## Qué NO prueba
 *
 * **No prueba que se vea bien** — eso se mira. Prueba que la decisión dependa
 * del **acercamiento** y no de en qué vista está el pasajero, que era el
 * defecto: la condición era «¿hay una ruta abierta?» en vez de «¿qué tan cerca
 * estoy?», y de cerca en la vista general las paradas se quedaban en puntos.
 */

/** La cuenta con la que se escogió el umbral, rehecha aquí. */
const M_POR_PX = (z: number) => (156543.03392 * Math.cos((31.7 * Math.PI) / 180)) / 2 ** z;
/** Oasis–Centro: 17 paradas a 667 m, medido en la base. */
const SEPARACION_REAL_M = 667;
/** La caja de toque de un marcador, que es lo que no se puede encimar. */
const TOQUE_PX = 44;

describe("el umbral", () => {
  it("de cerca, Tino entero; de lejos, punto", () => {
    expect(tinoEntero(ZOOM_DE_TINO)).toBe(true);
    expect(tinoEntero(ZOOM_DE_TINO + 1)).toBe(true);
    expect(tinoEntero(ZOOM_DE_TINO - 1)).toBe(false);
  });

  it("al umbral, dos paradas reales NO encabalgan sus toques", () => {
    expect(SEPARACION_REAL_M / M_POR_PX(ZOOM_DE_TINO)).toBeGreaterThanOrEqual(TOQUE_PX);
  });

  it("y un acercamiento menos SÍ los encabalgaría — por eso el umbral es éste", () => {
    /*
     * Es la mitad que hace que el número no sea arbitrario: si el zoom de
     * abajo también cupiera, el umbral estaría de más y habría que bajarlo.
     */
    expect(SEPARACION_REAL_M / M_POR_PX(ZOOM_DE_TINO - 1)).toBeLessThan(TOQUE_PX);
  });
});
