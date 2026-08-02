import { describe, expect, it } from "vitest";
import { completarTira, ventanaTira, DIAS_TIRA } from "./inicio-corporativo-data";

describe("ventanaTira", () => {
  it("son 14 días civiles y el último es hoy", () => {
    const { dias } = ventanaTira(new Date("2026-08-02T18:00:00Z"));
    expect(dias).toHaveLength(DIAS_TIRA);
    expect(dias.at(-1)).toBe("2026-08-02");
    expect(dias[0]).toBe("2026-07-20");
  });

  it("no repite ni salta días", () => {
    const { dias } = ventanaTira(new Date("2026-08-02T18:00:00Z"));
    expect(new Set(dias).size).toBe(DIAS_TIRA);
  });
});

describe("completarTira", () => {
  const dias = ["2026-07-30", "2026-07-31", "2026-08-01"];

  it("un día que la base no devolvió es un día SIN SERVICIOS PROGRAMADOS", () => {
    const tira = completarTira(dias, [
      { dia: "2026-07-30", cumplido: 40, no_cumplido: 8, pendiente_evidencia: 0, sin_hecho: 0 },
    ]);
    const sabado = tira.find((d) => d.dia === "2026-08-01")!;
    expect(sabado.programados).toBe(0);
    // La distinción que sostiene la tira: vacío ≠ sin verificar.
    expect(sabado.sin_hecho).toBe(0);
  });

  it("un día programado pero sin juzgar NO se confunde con uno sin programar", () => {
    const tira = completarTira(dias, [
      { dia: "2026-07-31", cumplido: 0, no_cumplido: 0, pendiente_evidencia: 0, sin_hecho: 48 },
    ]);
    const sinVerificar = tira.find((d) => d.dia === "2026-07-31")!;
    const sinProgramar = tira.find((d) => d.dia === "2026-08-01")!;
    expect(sinVerificar.programados).toBe(48);
    expect(sinProgramar.programados).toBe(0);
  });

  it("devuelve siempre una casilla por día pedido, en orden", () => {
    const tira = completarTira(dias, []);
    expect(tira.map((d) => d.dia)).toEqual(dias);
  });

  it("los programados son la suma de las cuatro columnas", () => {
    const [dia] = completarTira(["2026-07-30"], [
      { dia: "2026-07-30", cumplido: 19, no_cumplido: 18, pendiente_evidencia: 11, sin_hecho: 2 },
    ]);
    expect(dia!.programados).toBe(50);
  });

  it("un día mixto conserva sus cuatro cifras: la tira muestra proporción, no un agregado", () => {
    const [dia] = completarTira(["2026-07-29"], [
      { dia: "2026-07-29", cumplido: 27, no_cumplido: 21, pendiente_evidencia: 0, sin_hecho: 0 },
    ]);
    // Si esto se colapsara a un solo color, un día de 27/21 se vería idéntico
    // a uno de 10/38 y la tira no podría comparar nada.
    expect(dia).toMatchObject({ cumplido: 27, no_cumplido: 21, programados: 48 });
  });
});
