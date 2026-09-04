import { describe, it, expect } from "vitest";
import { arranqueCorto, arranqueLargo } from "./fecha-arranque";

describe("cómo se escribe el día del arranque", () => {
  it("el titular va corto, para rimar con «Abre 05:00»", () => {
    expect(arranqueCorto("2026-09-15")).toBe("15 sep");
    expect(arranqueCorto("2026-11-03")).toBe("3 nov");
  });

  it("la frase va con día de la semana y sin coma que la parta", () => {
    // El 15 de septiembre de 2026 cae en martes.
    expect(arranqueLargo("2026-09-15")).toBe("martes 15 de septiembre");
  });

  it("EL DÍA NO SE CORRE POR LA ZONA — es día civil, no un instante", () => {
    /*
     * `new Date("2026-09-15")` es medianoche UTC, y en Juárez (UTC-6) se
     * dibujaría como el 14. Un día corrido por uno manda a alguien a la parada
     * la víspera, y en la pantalla no hay nada que se vea mal.
     */
    expect(arranqueCorto("2026-09-15")).toBe("15 sep");
    expect(arranqueLargo("2026-01-01")).toBe("jueves 1 de enero");
    expect(arranqueLargo("2026-12-31")).toBe("jueves 31 de diciembre");
  });

  it("aguanta la fecha con hora pegada, como la devolvería un `timestamp`", () => {
    expect(arranqueCorto("2026-09-15T00:00:00.000Z")).toBe("15 sep");
  });

  it("una fecha ilegible no produce un titular inventado: no produce ninguno", () => {
    expect(arranqueCorto("mañana")).toBeNull();
    expect(arranqueLargo("")).toBeNull();
    expect(arranqueCorto("2026-13-45")).toBeNull();
  });
});
