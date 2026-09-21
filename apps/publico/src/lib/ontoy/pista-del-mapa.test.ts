import { describe, expect, it } from "vitest";
import type { Forma } from "./forma";
import { pistaDelMapa } from "./pista-del-mapa";

const parada = (id: string, sentido: "ida" | "vuelta" | null) => ({
  id,
  nombre: id,
  orden: 1,
  sentido,
  lat: 31.7,
  lon: -106.4,
});

const forma = (paradas: Forma["paradas"], circuito_id = "oasis-centro") =>
  ({ circuito_id, paradas }) as unknown as Forma;

describe("pistaDelMapa — no se invita a tocar lo que no existe", () => {
  it("con paradas en el sentido elegido invita a tocarlas", () => {
    expect(pistaDelMapa(forma([parada("a", "ida")]), "oasis-centro", "ida")).toBe(
      "Toca una parada para ver cuándo pasa",
    );
  });

  it("una parada de los dos sentidos cuenta en cualquiera", () => {
    expect(pistaDelMapa(forma([parada("a", null)]), "oasis-centro", "vuelta")).toBe(
      "Toca una parada para ver cuándo pasa",
    );
  });

  it("sin paradas en ESTE sentido lo dice, aunque el otro sí tenga", () => {
    expect(pistaDelMapa(forma([parada("a", "ida")]), "oasis-centro", "vuelta")).toBe(
      "Esta ruta aún no tiene paradas en este sentido",
    );
  });

  it("una ruta sin una sola parada tampoco invita", () => {
    expect(pistaDelMapa(forma([]), "oasis-centro", "ida")).toBe("Esta ruta aún no tiene paradas en este sentido");
  });

  it("mientras la ruta no llega, o lo que hay es de otra ruta, no dice nada", () => {
    expect(pistaDelMapa(null, "oasis-centro", "ida")).toBeNull();
    expect(pistaDelMapa(forma([parada("a", "ida")], "prueba-2"), "oasis-centro", "ida")).toBeNull();
    expect(pistaDelMapa(forma([parada("a", "ida")]), null, "ida")).toBeNull();
  });
});
