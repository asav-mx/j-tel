import { describe, expect, it } from "vitest";
import { horarioEnPalabras } from "./horario-en-palabras";

describe("horarioEnPalabras — «Hoy de 5:30 a 22:30» (lámina 2-mapa/03)", () => {
  it("sin cero a la izquierda, como la lámina", () => {
    expect(horarioEnPalabras("05:30:00", "22:30:00")).toBe("Hoy de 5:30 a 22:30");
  });
  it("un servicio que cruza la medianoche se dice tal cual", () => {
    expect(horarioEnPalabras("22:00", "06:00")).toBe("Hoy de 22:00 a 6:00");
  });
  it("inicio igual a fin es todo el día", () => {
    expect(horarioEnPalabras("00:00", "00:00")).toBe("Todo el día");
  });
  it("un dato raro no se inventa en frase", () => {
    expect(horarioEnPalabras("", "22:30")).toBeNull();
  });
});

describe("toda hora que ve el pasajero va sin cero delante (auditoría del 25-sep)", () => {
  it("horaSinCero: «05:00» → «5:00», y las de dos cifras no cambian", async () => {
    const { horaSinCero } = await import("./horario-en-palabras");
    expect(horaSinCero("05:00")).toBe("5:00");
    expect(horaSinCero("01:00:00")).toBe("1:00");
    expect(horaSinCero("09:53")).toBe("9:53");
    expect(horaSinCero("22:30")).toBe("22:30");
    expect(horaSinCero("00:05")).toBe("0:05");
  });

  it("ninguna pantalla vuelve a poner una hora cruda de la ruta", async () => {
    const { readFileSync } = await import("node:fs");
    const leer = (r: string) => readFileSync(new URL(r, import.meta.url), "utf8");
    for (const r of ["../../components/ontoy/ontoy.tsx", "../../components/ontoy/rutas-de-inicio.tsx", "./lectura-de-la-guardada.ts"]) {
      expect(leer(r), r).not.toMatch(/\$\{(vivo|e|l)\.abre(_a|A)\}/);
    }
  });
});
