/**
 * `localDateTimeSeconds` — el formateo de instantes en evidencia.
 *
 * Existe por un defecto que ninguna prueba podía ver y que apareció al abrir la
 * caja de aportación en el navegador: el rastro de un día real salió como *«de
 * 18:28:33 a 17:58:47»*. Dos números correctos, una frase falsa — se lee como si
 * el día terminara antes de empezar. El rastro se recorta en días UTC, así que
 * en la zona de la operación **cruza la medianoche**, y quien lo imprimía había
 * pedido solo la hora.
 *
 * Lo que fijan, en orden de daño:
 *
 *   1. Que un intervalo que cruza la medianoche **se lea en orden**, porque cada
 *      extremo lleva su fecha.
 *   2. Que la zona sea la que se pide, no la del proceso. Sin `timeZone`
 *      explícito, `Intl` usa el reloj de quien mira, y el resto del expediente
 *      se arma con el del contrato: dos relojes en la misma pantalla.
 *   3. Que los segundos no se pierdan — son parte de la evidencia.
 */
import { describe, it, expect } from "vitest";
import { localDateTimeSeconds, localDateTimeShort, JTTEL_TZ } from "./index.js";

/** Los dos extremos del rastro real que destapó el defecto. */
const PRIMERO = "2026-08-13T00:28:33.000Z";
const ULTIMO = "2026-08-13T23:58:47.000Z";

describe("un intervalo que cruza la medianoche se lee en orden", () => {
  it("cada extremo lleva su fecha, así que el orden es visible", () => {
    const a = localDateTimeSeconds(PRIMERO, JTTEL_TZ);
    const b = localDateTimeSeconds(ULTIMO, JTTEL_TZ);

    expect(a).toBe("2026-08-12 18:28:33");
    expect(b).toBe("2026-08-13 17:58:47");
    // La comprobación que importa: ordenados como texto, siguen en orden. Con
    // solo la hora —«18:28:33» contra «17:58:47»— esto se invertía.
    expect(a < b).toBe(true);
  });

  it("y son días distintos, que es justo lo que la hora sola escondía", () => {
    expect(localDateTimeSeconds(PRIMERO, JTTEL_TZ).slice(0, 10)).not.toBe(
      localDateTimeSeconds(ULTIMO, JTTEL_TZ).slice(0, 10),
    );
  });
});

describe("la zona es la que se pide, no la del proceso", () => {
  it("el mismo instante en dos zonas da dos lecturas distintas", () => {
    const juarez = localDateTimeSeconds(PRIMERO, JTTEL_TZ);
    const utc = localDateTimeSeconds(PRIMERO, "UTC");

    expect(juarez).toBe("2026-08-12 18:28:33");
    expect(utc).toBe("2026-08-13 00:28:33");
    // Si esto fuera igual, el argumento no se estaría usando.
    expect(juarez).not.toBe(utc);
  });

  it("sin zona explícita cae en la del contrato, no en la del runtime", () => {
    expect(localDateTimeSeconds(PRIMERO)).toBe(localDateTimeSeconds(PRIMERO, JTTEL_TZ));
  });
});

describe("los segundos son parte de la evidencia", () => {
  it("los conserva, donde su hermano corto los tira", () => {
    expect(localDateTimeSeconds(ULTIMO, JTTEL_TZ)).toBe("2026-08-13 17:58:47");
    expect(localDateTimeShort(ULTIMO, JTTEL_TZ)).toBe("2026-08-13 17:58");
  });

  it("un instante inválido dice «—» en vez de «Invalid Date»", () => {
    expect(localDateTimeSeconds("no es una fecha", JTTEL_TZ)).toBe("—");
  });
});
