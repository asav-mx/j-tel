import { describe, expect, it } from "vitest";
import { camiDesdeArriba, pasajeroConLinterna, rotacionDeCami, tinoEnLaParada } from "./munecos";

/*
 * LOS MUÑECOS DEL MAPA.
 *
 * ## Qué NO prueba, y hay que leerlo antes que el verde
 *
 * **No prueba que se vean bien.** Esto compara cadenas de SVG; que Cami se lea a
 * 30 px sobre una avenida, o que el cono del pasajero no tape su propia carita,
 * sólo lo dice mirarlo. La revisión visual sigue siendo la verificación.
 *
 * **No prueba que el rumbo del GPS sea correcto.** Prueba qué hace la app con el
 * que le llega — y sobre todo qué hace cuando NO le llega.
 *
 * Lo que sí cerca, que es lo que se rompe solo: que un dato ausente no se
 * rellene con un valor por omisión que parezca medido.
 */

const CAMI = { color: "#4F7FD8", rumbo: 90, fresco: true, economico: "2120", edad: "hace 10 s" };

describe("el giro de Cami", () => {
  it("con rumbo, gira a sus grados", () => {
    expect(rotacionDeCami(90)).toBe(90);
    expect(camiDesdeArriba(CAMI)).toContain("rotate(90deg)");
  });

  it("normaliza lo que da la vuelta y lo negativo", () => {
    expect(rotacionDeCami(360)).toBe(0);
    expect(rotacionDeCami(450)).toBe(90);
    expect(rotacionDeCami(-90)).toBe(270);
  });

  /*
   * **El caso que importa.** `rumbo` es `number | null` y viene nulo cuando el
   * aparato no lo reporta o el camión está parado. Cualquier ángulo inventado
   * manda al pasajero al lado equivocado de la avenida.
   */
  it("SIN rumbo no gira, en vez de apuntar a cualquier lado", () => {
    expect(rotacionDeCami(null)).toBe(0);
    expect(camiDesdeArriba({ ...CAMI, rumbo: null })).toContain("rotate(0deg)");
  });

  it("un rumbo que no es número tampoco inventa un ángulo", () => {
    expect(rotacionDeCami(Number.NaN)).toBe(0);
  });

  it("lleva su número y su edad, y los dos se quedan derechos", () => {
    /*
     * Sólo el cuerpo gira. Un rótulo que rota con el camión queda de cabeza la
     * mitad del recorrido, y la edad del dato es lo que no se puede volver
     * ilegible (estándar, regla 4: sin edad no se muestra).
     */
    const html = camiDesdeArriba(CAMI);
    expect(html).toContain("2120");
    expect(html).toContain("hace 10 s");
    const cuerpo = html.slice(html.indexOf("<svg"), html.indexOf("</svg>"));
    expect(cuerpo).toContain("rotate(");
    expect(html.slice(html.indexOf("</svg>"))).not.toContain("rotate(");
  });

  it("una posición vieja se marca, en vez de dibujarse como si fuera de ahorita", () => {
    expect(camiDesdeArriba({ ...CAMI, fresco: false })).toContain("vieja");
    expect(camiDesdeArriba(CAMI)).not.toContain("vieja");
  });

  it("toma el color de SU ruta, del dato", () => {
    expect(camiDesdeArriba({ ...CAMI, color: "#E36F8C" })).toContain("#E36F8C");
  });
});

describe("Tino en una parada", () => {
  it("toma el color de su ruta", () => {
    expect(tinoEnLaParada({ color: "#5FB36B", mirada: "al-frente" })).toContain("#5FB36B");
  });

  it("de lado y al frente no miran igual", () => {
    const lado = tinoEnLaParada({ color: "#4F7FD8", mirada: "de-lado" });
    const frente = tinoEnLaParada({ color: "#4F7FD8", mirada: "al-frente" });
    expect(lado).not.toBe(frente);
    expect(lado).toContain('cx="47.5"');
  });

  it("dormido no tiene pupilas: son dos rayas", () => {
    const html = tinoEnLaParada({ color: "#4F7FD8", mirada: "dormido" });
    expect(html).not.toContain('r="7.5"');
    expect(html).toContain("q7 5 14 0");
  });

  it("NO lleva minutos colgados: una cifra de tiempo sin su edad no se muestra", () => {
    const html = tinoEnLaParada({ color: "#4F7FD8", mirada: "de-lado" });
    expect(html).not.toMatch(/\d+\s*[′']/);
  });

  it("una parada guardada lleva su estrella", () => {
    expect(tinoEnLaParada({ color: "#4F7FD8", mirada: "al-frente", guardada: true })).toContain("★");
    expect(tinoEnLaParada({ color: "#4F7FD8", mirada: "al-frente" })).not.toContain("★");
  });
});

describe("el pasajero", () => {
  /*
   * La linterna apunta a donde el pasajero mira, y quien la ve la usa para
   * orientarse. `coords.heading` viene nulo casi siempre —un teléfono quieto no
   * tiene rumbo—, así que el caso normal es el de abajo.
   */
  it("SIN rumbo no hay cono: no hay hacia dónde apuntar", () => {
    const html = pasajeroConLinterna(null);
    expect(html).not.toContain("M30 30 L14 4");
    expect(html).toContain("tú");
  });

  it("con rumbo medido, el cono apunta ahí", () => {
    const html = pasajeroConLinterna(135);
    expect(html).toContain("M30 30 L14 4");
    expect(html).toContain("rotate(135deg)");
  });

  it("no lleva color de ruta: el pasajero no va en ninguna", () => {
    /*
     * Va en Azul noche, que es de Ontoy. Pintarlo del color de la ruta abierta
     * diría que viaja en ella.
     */
    const html = pasajeroConLinterna(90);
    expect(html).toContain("#1E2B4D");
    expect(html).not.toContain("--ruta");
  });
});
