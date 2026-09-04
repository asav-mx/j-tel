import { describe, it, expect } from "vitest";
import {
  rotuloDeLaTarjeta,
  SEGUN_EL_CONCESIONARIO,
  type ModoDeLaTarjeta,
} from "./rotulo-de-la-tarjeta";

const VIVO = {
  conRango: true,
  hayProxima: true,
  pisoMin: 3,
  velocidadKmh: 20.5,
  velocidadMedida: false,
};

const DECLARADOS: ModoDeLaTarjeta[] = ["por_arrancar", "fuera_de_horario", "sin_evidencia"];

describe("el rótulo dice de dónde sale la afirmación", () => {
  it("todo lo declarado se atribuye al concesionario, con la MISMA copia", () => {
    /*
     * La fuente es la misma persona en los tres. Darle a cada uno su variante
     * —«arranque declarado», «horario declarado»— insinuaría que hay tres
     * fuentes distintas, y es por donde se coló la repetición del titular.
     */
    for (const modo of DECLARADOS) {
      expect(rotuloDeLaTarjeta(modo, VIVO), modo).toBe(SEGUN_EL_CONCESIONARIO);
    }
  });

  it("NO REPITE LO QUE EL TITULAR YA DICE — la valla de esta regla", () => {
    /*
     * Los tres sustantivos que el titular y la frase ya dicen en estos estados:
     * «Arranca 15 sep», «Abre 05:00», «05:00 a 23:00», «Cada 20 min». Si
     * alguno vuelve al rótulo, esto se cae — que es lo único que impide que la
     * corrección de hoy se deshaga sola dentro de tres pantallas.
     */
    for (const modo of DECLARADOS) {
      const r = rotuloDeLaTarjeta(modo, VIVO).toLowerCase();
      expect(r, modo).not.toContain("horario");
      expect(r, modo).not.toContain("frecuencia");
      expect(r, modo).not.toContain("arranque");
    }
  });

  it("pero la ATRIBUCIÓN se queda: sin ella la app afirma con su propia autoridad", () => {
    // Acortar no es callar de dónde viene. El horario no lo medimos nosotros.
    for (const modo of DECLARADOS) {
      expect(rotuloDeLaTarjeta(modo, VIVO).toLowerCase(), modo).toContain("concesionario");
    }
  });

  it("lo que no se pudo preguntar no se le atribuye a nadie", () => {
    /*
     * Sin conexión no hay afirmación sobre el servicio, así que no hay fuente.
     * Decir «según el concesionario» ahí le colgaría a él un silencio que es
     * nuestro.
     */
    expect(rotuloDeLaTarjeta("sin_conexion", VIVO)).toBe("Sin conexión");
    expect(rotuloDeLaTarjeta("cargando", VIVO)).toBe("Consultando…");
    for (const modo of ["sin_conexion", "cargando"] as ModoDeLaTarjeta[]) {
      expect(rotuloDeLaTarjeta(modo, VIVO).toLowerCase()).not.toContain("concesionario");
    }
  });

  it("EN VIVO nombra el instrumento, con sus números", () => {
    expect(rotuloDeLaTarjeta("en_vivo", VIVO)).toBe("En vivo · ±3 min · 20.5 km/h declarados");
    expect(rotuloDeLaTarjeta("en_vivo", { ...VIVO, velocidadMedida: true })).toContain("medidos");
  });

  it("«medidos» y «declarados» no son sinónimos, y el rótulo los distingue", () => {
    // Una velocidad declarada es un punto de partida, no una medición de esta
    // calle: es el motivo por el que el tiempo estimado nace apagado.
    const medida = rotuloDeLaTarjeta("en_vivo", { ...VIVO, velocidadMedida: true });
    const declarada = rotuloDeLaTarjeta("en_vivo", VIVO);
    expect(medida).not.toBe(declarada);
  });

  it("sin permiso de rango, EN VIVO no promete un tiempo ni lo insinúa", () => {
    expect(rotuloDeLaTarjeta("en_vivo", { ...VIVO, conRango: false })).toBe(
      "En vivo · sin tiempo estimado",
    );
    expect(rotuloDeLaTarjeta("en_vivo", { ...VIVO, hayProxima: false })).toBe(
      "En vivo · activa tu ubicación para el tiempo",
    );
  });

  it("ningún estado se queda sin rótulo", () => {
    const todos: ModoDeLaTarjeta[] = [
      "por_arrancar",
      "fuera_de_horario",
      "en_vivo",
      "por_horario",
      "sin_evidencia",
      "sin_conexion",
      "cargando",
    ];
    for (const modo of todos) {
      expect(rotuloDeLaTarjeta(modo, VIVO).length, modo).toBeGreaterThan(0);
    }
  });
});
