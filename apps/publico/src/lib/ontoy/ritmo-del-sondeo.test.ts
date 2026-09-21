import { describe, expect, it } from "vitest";
import { proximaEspera, SONDEO_MS, TOPE_ESPERA_MS } from "./ritmo-del-sondeo";

describe("proximaEspera", () => {
  it("con éxito, vuelve al ritmo normal aunque viniera de apartarse", () => {
    expect(proximaEspera(200, null, TOPE_ESPERA_MS)).toBe(SONDEO_MS);
  });

  it("sin red o con un 500 conserva el ritmo normal: nadie pidió bajar el paso", () => {
    expect(proximaEspera(null, null, SONDEO_MS)).toBe(SONDEO_MS);
    expect(proximaEspera(500, null, SONDEO_MS)).toBe(SONDEO_MS);
  });

  it("un 429 sin Retry-After dobla la espera", () => {
    expect(proximaEspera(429, null, SONDEO_MS)).toBe(30_000);
    expect(proximaEspera(429, null, 30_000)).toBe(60_000);
  });

  it("la espera tras 429 nunca pasa del tope", () => {
    expect(proximaEspera(429, null, 90_000)).toBe(TOPE_ESPERA_MS);
    expect(proximaEspera(429, null, TOPE_ESPERA_MS)).toBe(TOPE_ESPERA_MS);
  });

  it("un 429 con Retry-After espera lo que el servidor pide, acotado", () => {
    expect(proximaEspera(429, "45", SONDEO_MS)).toBe(45_000);
    expect(proximaEspera(429, "3", SONDEO_MS)).toBe(SONDEO_MS);
    expect(proximaEspera(429, "3600", SONDEO_MS)).toBe(TOPE_ESPERA_MS);
  });

  it("un Retry-After que no es número (una fecha, basura) cae a doblar", () => {
    expect(proximaEspera(429, "Wed, 21 Oct 2026 07:28:00 GMT", SONDEO_MS)).toBe(30_000);
    expect(proximaEspera(429, "", SONDEO_MS)).toBe(30_000);
  });
});
