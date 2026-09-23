import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { apoyoDe, datoDe, glifoDe, rutasDeLectores, saludEnPalabras } from "@/lib/casa/lectores";

const AHORA = new Date("2026-09-23T18:00:00.000Z");

describe("la forma de cada grupo", () => {
  it("cada grupo tiene la suya, y todas son de la familia del lector", () => {
    for (const grupo of ["en_unidad", "en_bodega", "mudo", "de_baja"] as const) {
      expect(glifoDe(grupo)).toMatch(/^lector-/);
    }
    expect(glifoDe("mudo")).toBe("lector-mudo");
  });

  /*
   * La trampa que esta familia vino a evitar: si el lector usara el cuadro del
   * GPS, en el expediente de una unidad —donde aparecen los dos— un cuadro
   * lleno diría «GPS instalado» y «lector instalado» a la vez.
   */
  it("ninguna forma del lector es la de un dispositivo", () => {
    const fuente = readFileSync(fileURLToPath(new URL("../../components/casa/glifo.tsx", import.meta.url)), "utf8");
    const dibujos = [...fuente.matchAll(/estado === "(lector|dispositivo)-([a-z-]+)"/g)];
    expect(dibujos.length).toBeGreaterThanOrEqual(8);
    /* La muesca —el escalón `v4 h8 v-4`— es lo que separa a la familia, y
       ninguna caja de dispositivo la trae. */
    const lector = fuente.slice(fuente.indexOf("── Lectores"), fuente.indexOf("── Papeles"));
    expect(lector.match(/v4 h8 v-4/g)?.length).toBe(4);
    const dispositivos = fuente.slice(fuente.indexOf("── Dispositivos"), fuente.indexOf("── Lectores"));
    expect(dispositivos).not.toContain("v4 h8 v-4");
  });
});

describe("el número de la pieza", () => {
  const base = { ultimoContacto: new Date("2026-09-23T17:57:00.000Z"), bajaEn: null };

  it("en el vistazo, un solo número: la edad", () => {
    const d = datoDe(
      { ...base, salud: { estado: "en_contacto", horasDeServicioSinContacto: 0.05 } },
      "en_unidad",
      AHORA,
    );
    expect(d.dato).toBe("hace 3 min");
    expect(d.etiqueta).toBe("ÚLTIMO CONTACTO");
    /* Vivo: está hablando ahora, y el cobre es de la vida. */
    expect(d.vivo).toBe(true);
  });

  /* En el mudo alguien decide ir a ver un camión: el número lleva su umbral. */
  it("el mudo lleva su umbral al lado", () => {
    const d = datoDe(
      { ...base, salud: { estado: "mudo", horasDeServicioSinContacto: 4.23 } },
      "mudo",
      AHORA,
    );
    expect(d.dato).toBe("4.2 h · umbral 4 h");
    expect(d.vivo).toBe(false);
  });

  it("uno que nunca entregó dice «nunca», no una edad inventada", () => {
    const d = datoDe(
      { ultimoContacto: null, bajaEn: null, salud: { estado: "en_contacto", horasDeServicioSinContacto: 0.1 } },
      "en_bodega",
      AHORA,
    );
    expect(d.dato).toBe("nunca");
    expect(d.vivo).toBe(false);
  });

  it("el de baja no finge estar vivo", () => {
    const d = datoDe(
      { ...base, bajaEn: AHORA, salud: { estado: "en_contacto", horasDeServicioSinContacto: 0.1 } },
      "de_baja",
      AHORA,
    );
    expect(d.vivo).toBe(false);
    expect(d.dato).toBe("de baja");
  });

  /* En bodega no hay vida que marcar aunque haya entregado ayer. */
  it("el de bodega no lleva cobre", () => {
    const d = datoDe(
      { ...base, salud: { estado: "en_contacto", horasDeServicioSinContacto: 0.1 } },
      "en_bodega",
      AHORA,
    );
    expect(d.vivo).toBe(false);
  });
});

describe("el apoyo, en dos o tres cosas", () => {
  it("dice dónde está, qué circuito le toca y de quién es", () => {
    expect(apoyoDe({ unidad: "2120", circuito: "Zaragoza–Centro", carrier: "Transportes de ciudad" })).toBe(
      "en la 2120 · Zaragoza–Centro · Transportes de ciudad",
    );
  });

  /* El lector sin circuito es justo el que no se puede juzgar: se dice. */
  it("una unidad sin circuito lo dice en vez de callarlo", () => {
    expect(apoyoDe({ unidad: "2126", circuito: null, carrier: "Transportes de ciudad" })).toContain(
      "sin circuito asignado",
    );
  });

  it("en bodega no inventa un circuito", () => {
    const apoyo = apoyoDe({ unidad: null, circuito: null, carrier: "Transportes de ciudad" });
    expect(apoyo).toBe("sin unidad · Transportes de ciudad");
    expect(apoyo).not.toContain("circuito");
  });
});

describe("la salud en palabras", () => {
  it("«no se puede decir» se enuncia entero, con su porqué", () => {
    const frase = saludEnPalabras({ estado: "no_se_puede_decir", motivo: "sin_circuito_asignado" });
    expect(frase).toContain("No se puede decir");
    expect(frase).toContain("circuito");
  });

  it("el mudo y el que está en contacto dicen los dos su umbral", () => {
    expect(saludEnPalabras({ estado: "mudo", horasDeServicioSinContacto: 5 })).toContain("umbral de 4 h");
    expect(saludEnPalabras({ estado: "en_contacto", horasDeServicioSinContacto: 1 })).toContain("umbral de 4 h");
  });
});

describe("las direcciones", () => {
  it("el cuarto y la ficha, con y sin parámetros", () => {
    expect(rutasDeLectores.cuarto()).toBe("/casa/jstaff/lectores");
    expect(rutasDeLectores.cuarto({ accion: "alta" })).toBe("/casa/jstaff/lectores?accion=alta");
    expect(rutasDeLectores.ver("abc")).toBe("/casa/jstaff/lectores/abc");
    expect(rutasDeLectores.ver("abc", { error: "x" })).toBe("/casa/jstaff/lectores/abc?error=x");
  });
});
