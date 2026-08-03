import { describe, it, expect } from "vitest";
import {
  razonSinEvidenciaPosible,
  explicarRazon,
  MIN_INTENTOS_ANTES_DE_RETIRAR,
  DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA,
} from "./sin-evidencia-posible.js";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-08-03T07:00:00Z");

describe("razonSinEvidenciaPosible", () => {
  it("el caso real: ventana de junio, memoria que empieza después", () => {
    // Los cinco de TECMA: ventana 22–26 jun, memoria propia desde el 28 jun.
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date("2026-06-22T12:20:00Z"),
        horizonteDeMemoria: new Date("2026-06-28T02:23:16Z"),
        intentosPrevios: 31_424,
        ahora: AHORA,
      }),
    ).toBe("ventana_anterior_a_la_memoria");
  });

  it("no se rinde en los primeros intentos aunque la ventana sea vieja", () => {
    // Cortar lazos infinitos, no rendirse ante un fallo transitorio.
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date("2026-06-22T12:20:00Z"),
        horizonteDeMemoria: new Date("2026-06-28T02:23:16Z"),
        intentosPrevios: MIN_INTENTOS_ANTES_DE_RETIRAR - 1,
        ahora: AHORA,
      }),
    ).toBeNull();
  });

  it("una ventana que SÍ cae dentro de la memoria sigue en la cola si es reciente", () => {
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date("2026-08-02T13:25:00Z"),
        horizonteDeMemoria: new Date("2026-06-28T02:23:16Z"),
        intentosPrevios: 5_000,
        ahora: AHORA,
      }),
    ).toBeNull();
  });

  it("dentro de la memoria pero vencida hace semanas: también sale de la cola", () => {
    // Sin esta razón el lazo es el mismo, solo que sin fecha de inicio conocida.
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date(AHORA.getTime() - (DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA + 1) * DIA),
        horizonteDeMemoria: new Date("2026-01-01T00:00:00Z"),
        intentosPrevios: 5_000,
        ahora: AHORA,
      }),
    ).toBe("plazo_vencido_sin_evidencia");
  });

  it("justo en el borde de los días todavía no se retira", () => {
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date(AHORA.getTime() - DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA * DIA),
        horizonteDeMemoria: new Date("2026-01-01T00:00:00Z"),
        intentosPrevios: 5_000,
        ahora: AHORA,
      }),
    ).toBeNull();
  });

  it("un carrier sin ni un punto guardado no dispara la razón de memoria", () => {
    // horizonteDeMemoria null = todavía no sabemos dónde empieza la memoria.
    // Inventar un horizonte ahí sería afirmar algo que no medimos.
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: new Date("2026-08-02T13:25:00Z"),
        horizonteDeMemoria: null,
        intentosPrevios: 5_000,
        ahora: AHORA,
      }),
    ).toBeNull();
  });

  it("la ventana que empieza justo en el horizonte no se retira", () => {
    const horizonte = new Date("2026-06-28T02:23:16Z");
    expect(
      razonSinEvidenciaPosible({
        finDeVentana: horizonte,
        horizonteDeMemoria: horizonte,
        intentosPrevios: 5_000,
        ahora: new Date("2026-06-29T00:00:00Z"),
      }),
    ).toBeNull();
  });
});

describe("explicarRazon", () => {
  it("cada razón se puede leer sin conocer el código", () => {
    for (const razon of ["ventana_anterior_a_la_memoria", "plazo_vencido_sin_evidencia"] as const) {
      const texto = explicarRazon(razon);
      expect(texto.length).toBeGreaterThan(40);
      expect(texto).not.toContain("_");
    }
  });
});
