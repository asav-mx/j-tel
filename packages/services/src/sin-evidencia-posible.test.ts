import { describe, it, expect } from "vitest";
import {
  razonSinEvidenciaPosible,
  explicarRazon,
  MIN_INTENTOS_ANTES_DE_RETIRAR,
  DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA,
} from "./sin-evidencia-posible.js";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-09-19T19:00:00Z");

describe("razonSinEvidenciaPosible", () => {
  it("el caso real del 19-sep: ventana que el archivador ya rebasó vacía", () => {
    /*
     * Los 365 atorados de `tecma`/`juarez-bus`. La regla vieja miraba el primer
     * punto de toda la historia del transportista —28 de junio— y por eso no
     * podía dispararse nunca. La nueva mira ESTA ventana.
     */
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date("2026-09-07T12:20:00Z"),
        motivo: "sin_senal",
        intentosPrevios: 17_637,
        ahora: AHORA,
      }),
    ).toBe("ventana_cerrada_vacia");
  });

  it("cierra en cuanto el archivador rebasa la ventana, sin esperar los 14 días", () => {
    // Esto es lo que cambia respecto de la regla vieja: dos días, no catorce.
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date(AHORA.getTime() - 2 * DIA),
        motivo: "sin_senal",
        intentosPrevios: 3_000,
        ahora: AHORA,
      }),
    ).toBe("ventana_cerrada_vacia");
  });

  it("si el archivador TODAVÍA no llega a la ventana, se espera", () => {
    /*
     * `memoria_no_alcanza` es paciencia, no falla: el archivador tarda una
     * media de ~7 h y un p95 de ~30 h en cubrir una ventana. Cerrar aquí sería
     * rendirse mientras el dato viene en camino.
     */
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date(AHORA.getTime() - 1 * DIA),
        motivo: "memoria_no_alcanza",
        intentosPrevios: 5_000,
        ahora: AHORA,
      }),
    ).toBeNull();
  });

  it("la paciencia NO es infinita: sin marca de agua manda el reloj", () => {
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date(AHORA.getTime() - (DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA + 1) * DIA),
        motivo: null,
        intentosPrevios: 5_000,
        ahora: AHORA,
      }),
    ).toBe("plazo_vencido_sin_evidencia");
  });

  it("sin marca de agua y dentro del plazo, sigue en la cola", () => {
    // Sin marca de agua no se puede afirmar si la ventana se cerró vacía o si
    // el archivador viene atrasado. Elegir sería inventarlo.
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date(AHORA.getTime() - 2 * DIA),
        motivo: null,
        intentosPrevios: 5_000,
        ahora: AHORA,
      }),
    ).toBeNull();
  });

  it("no se rinde en los primeros intentos, ni con la ventana cerrada vacía", () => {
    // Cortar lazos infinitos, no rendirse ante un fallo transitorio.
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date("2026-09-07T12:20:00Z"),
        motivo: "sin_senal",
        intentosPrevios: MIN_INTENTOS_ANTES_DE_RETIRAR - 1,
        ahora: AHORA,
      }),
    ).toBeNull();
  });

  it("justo en el borde de los días de respaldo todavía no se retira", () => {
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date(AHORA.getTime() - DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA * DIA),
        motivo: null,
        intentosPrevios: 5_000,
        ahora: AHORA,
      }),
    ).toBeNull();
  });

  it("`memoria_no_alcanza` gana sobre el plazo: el respaldo no atropella a la medición", () => {
    /*
     * Una ventana de hace veinte días que el archivador todavía no cubre NO se
     * cierra: hay una afirmación medida —viene en camino— y el reloj no puede
     * más que ella. El respaldo es para cuando no hay nada que medir.
     */
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date(AHORA.getTime() - 20 * DIA),
        motivo: "memoria_no_alcanza",
        intentosPrevios: 20_000,
        ahora: AHORA,
      }),
    ).toBeNull();
  });
});

describe("explicarRazon", () => {
  it("cada razón se puede leer sin conocer el código", () => {
    for (const razon of ["ventana_cerrada_vacia", "plazo_vencido_sin_evidencia"] as const) {
      const texto = explicarRazon(razon);
      expect(texto.length).toBeGreaterThan(40);
      expect(texto).not.toContain("_");
    }
  });
});
