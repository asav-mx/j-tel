import { describe, expect, it } from "vitest";
import { COLORES_IDENTIDAD } from "@/components/monitoreo-map";

/**
 * La paleta de identidad de ruta del mapa es una excepción declarada a la regla
 * de "ningún color a mano": identifica, no mide ni juzga. La excepción viene
 * con una condición dura — **jamás toca verde, rojo ni ámbar**, para que una
 * traza no pueda confundirse con un veredicto.
 *
 * Esto vive como prueba y no como comentario porque el comentario no detiene a
 * nadie: el día que alguien agregue un turquesa bonito, esta prueba lo dice.
 */

/** Tono en grados (0–360) de un hex. */
function tono(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h =
    max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Distancia angular entre dos tonos, por el lado corto del círculo. */
function distancia(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** Los tres veredictos, en SUS DOS temas: ambos tienen que quedar lejos. */
const VEREDICTOS = {
  "verde oscuro": "#34c77b",
  "verde claro": "#1b8a54",
  "ámbar oscuro": "#e3a81f",
  "ámbar claro": "#9a6a05",
  "rojo oscuro": "#e5484d",
  "rojo claro": "#b4262b",
};

/**
 * 45° es el margen; por debajo de eso dos colores se leen de la misma familia
 * de un vistazo. La paleta que se reemplazó tenía aguamarinas a 19.8° del
 * verde: no eran verde, pero al lado de un chip `Cumplido` lo parecían.
 */
const MARGEN_GRADOS = 45;

describe("la paleta de identidad de ruta no invade el veredicto", () => {
  it.each(COLORES_IDENTIDAD)("%s está lejos de los tres veredictos", (color) => {
    const h = tono(color);
    for (const [nombre, veredicto] of Object.entries(VEREDICTOS)) {
      const d = distancia(h, tono(veredicto));
      expect(
        d,
        `${color} (tono ${h.toFixed(1)}°) queda a ${d.toFixed(1)}° de ${nombre} — el mínimo es ${MARGEN_GRADOS}°`,
      ).toBeGreaterThanOrEqual(MARGEN_GRADOS);
    }
  });

  it("vive entera en la banda de tono segura, 196°–312°", () => {
    for (const color of COLORES_IDENTIDAD) {
      const h = tono(color);
      expect(h, `${color} está fuera de la banda`).toBeGreaterThanOrEqual(196);
      expect(h, `${color} está fuera de la banda`).toBeLessThanOrEqual(312);
    }
  });

  it("tiene los 12 colores que la rotación de rutas espera, sin repetidos", () => {
    expect(COLORES_IDENTIDAD).toHaveLength(12);
    expect(new Set(COLORES_IDENTIDAD).size).toBe(12);
  });
});
