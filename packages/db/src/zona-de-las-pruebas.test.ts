import { describe, it, expect } from "vitest";

/**
 * **La suite corre en UTC**, y esto lo comprueba mirando el proceso — no el
 * archivo de configuración.
 *
 * La valla de `scripts/verificar-zona-de-pruebas.mjs` mira que cada
 * configuración importe la zona. Eso no alcanza: un `import` puede estar y no
 * surtir efecto —si Node dejara de admitir el cambio de `process.env.TZ` en
 * caliente, por ejemplo—, y entonces la valla seguiría en verde mientras la
 * suite mide otra zona.
 *
 * Esta prueba es la otra mitad: pregunta **qué hora cree que es** el proceso
 * que corre las pruebas.
 *
 * Vive en `@jtel/db` porque es el paquete que lo pagó: la prueba de calendario
 * del generador de ocurrencias se puso roja el 23-sep-2026 por correr fuera de
 * UTC, y la reporté como un fallo de `main` sin serlo
 * (`docs/Diagnostico-Rango-Del-Generador-2026-09-23.md`).
 */
describe("la zona de las pruebas", () => {
  it("es UTC, la misma en la que corre el producto", () => {
    expect(process.env.TZ).toBe("UTC");
    /* Lo que de verdad importa: que las fechas se comporten como en UTC. */
    expect(new Date().getTimezoneOffset()).toBe(0);
  });

  /*
   * El caso exacto que se rompía: `setHours(0,0,0,0)` sobre una medianoche UTC
   * devuelve el mismo instante sólo si la máquina está en UTC. En
   * `America/Ciudad_Juarez` retrocede al día anterior, y de ahí salía el
   * '2026-08-21' que nadie pidió.
   */
  it("una medianoche UTC sigue siendo el mismo día después de setHours", () => {
    const medianoche = new Date("2026-08-22T00:00:00.000Z");
    const alInicioDelDia = new Date(medianoche);
    alInicioDelDia.setHours(0, 0, 0, 0);
    expect(alInicioDelDia.toISOString().slice(0, 10)).toBe("2026-08-22");
  });
});
