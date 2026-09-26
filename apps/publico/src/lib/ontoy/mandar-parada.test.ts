import { describe, expect, it } from "vitest";
import { ligaDeLaParada, mandadaEnPalabras, mandarParada } from "./mandar-parada";

/**
 * **Lo que esta valla NO prueba**: que la hoja de compartir del teléfono se
 * abra, ni que WhatsApp reciba bien la liga. Eso es del sistema y de un teléfono
 * de verdad. Prueba **qué se manda y qué pasa cuando no se puede**, que es lo que
 * se rompe callado.
 */

const LIGA = "https://ontoy.app/p/zaragoza-centro-4";

describe("la liga de una parada", () => {
  it("es la de su letrero: /p/‹qr_slug›", () => {
    expect(ligaDeLaParada("https://ontoy.app", "zaragoza-centro-4")).toBe(LIGA);
  });
  it("aguanta el origen con diagonal al final y escapa el slug", () => {
    expect(ligaDeLaParada("https://ontoy.app/", "a b")).toBe("https://ontoy.app/p/a%20b");
  });
});

describe("mandar una parada", () => {
  it("con la hoja del teléfono: manda SÓLO el nombre y la liga", async () => {
    let enviado: unknown = null;
    const r = await mandarParada({
      nombre: "Zaragoza y Ejército",
      liga: LIGA,
      nav: { share: async (d) => void (enviado = d) },
    });
    expect(r).toBe("compartida");
    /* Nada más: ni ubicación, ni otras paradas, ni identificador. */
    expect(enviado).toEqual({ title: "Zaragoza y Ejército", text: "Zaragoza y Ejército", url: LIGA });
  });

  it("si el pasajero cierra la hoja, no es un error", async () => {
    const aborto = Object.assign(new Error("cerró"), { name: "AbortError" });
    const r = await mandarParada({ nombre: "x", liga: LIGA, nav: { share: async () => { throw aborto; } } });
    expect(r).toBe("cancelada");
    expect(mandadaEnPalabras(r, LIGA)).toBeNull();
  });

  it("si compartir falla por otra cosa, copia la liga", async () => {
    let copiado = "";
    const r = await mandarParada({
      nombre: "x",
      liga: LIGA,
      nav: { share: async () => { throw new Error("no permitido"); }, clipboard: { writeText: async (t) => void (copiado = t) } },
    });
    expect(r).toBe("copiada");
    expect(copiado).toBe(LIGA);
  });

  it("sin hoja de compartir, copia la liga", async () => {
    let copiado = "";
    const r = await mandarParada({ nombre: "x", liga: LIGA, nav: { clipboard: { writeText: async (t) => void (copiado = t) } } });
    expect(r).toBe("copiada");
    expect(copiado).toBe(LIGA);
  });

  it("sin nada, NO calla: dice la liga en la pantalla", async () => {
    const r = await mandarParada({ nombre: "x", liga: LIGA, nav: {} });
    expect(r).toBe("no-se-pudo");
    expect(mandadaEnPalabras(r, LIGA)).toContain(LIGA);
  });

  it("con el portapapeles negado, tampoco calla", async () => {
    const r = await mandarParada({ nombre: "x", liga: LIGA, nav: { clipboard: { writeText: async () => { throw new Error("negado"); } } } });
    expect(r).toBe("no-se-pudo");
  });
});
