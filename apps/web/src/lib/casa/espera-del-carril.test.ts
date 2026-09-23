import { describe, it, expect } from "vitest";
import { esperasDelCarril } from "./espera-del-carril";
import { rotulosQueCaben, HOLGURA_PX, type RotuloMedido } from "./rotulos-del-carril";
import type { EsperaDeParada } from "@jtel/services";

const espera = (
  stopId: string,
  minutos: number | null,
  estado: EsperaDeParada["estado"],
  desdeLaApertura: boolean,
): EsperaDeParada =>
  ({
    stopId,
    nombre: stopId,
    sentido: "ida",
    minutos,
    desdeLaApertura,
    ultimaPasada: desdeLaApertura ? null : new Date(),
    referencia: { desdeMin: 5, hastaMin: 15 },
    estado,
    motivo: null,
    ultimasPasadas: [],
  }) as unknown as EsperaDeParada;

describe("el reloj de cada parada y lo que se dice una vez", () => {
  /*
   * EL CASO DEL REPORTE: Oasis, la 2120 asignada y sin rodar. 17 paradas, cero
   * pasadas, todas ancladas a la apertura → 803.53 min idénticos y todas
   * atrasadas. Antes eran 17 relojes en cobre; ahora es UN hecho del circuito.
   */
  it("sin una sola pasada hoy, NINGUNA parada lleva reloj propio", () => {
    const esperas = Array.from({ length: 17 }, (_, i) => espera(`p${i}`, 803.53, "atrasada", true));
    const r = esperasDelCarril(esperas, "ida");

    expect(r.conReloj.size).toBe(0);
    expect(r.sinPasada).toEqual({ cuantas: 17, deCuantas: 17, minutos: 803.53 });
  });

  it("con pasada real, la parada conserva su reloj y puede ir en cobre", () => {
    const r = esperasDelCarril([espera("p1", 19, "atrasada", false)], "ida");
    expect(r.conReloj.get("p1")?.estado).toBe("atrasada");
    expect(r.sinPasada).toBeNull();
  });

  /*
   * El caso mezclado, que es el que revienta una regla de «todo o nada»: el
   * camión pasó por las primeras y se quedó. Las que sí tienen pasada siguen
   * midiéndose contra ella; las que no, se dicen juntas.
   */
  it("mezclado: las que pasaron llevan su reloj, las que no se dicen juntas", () => {
    const r = esperasDelCarril(
      [
        espera("p1", 7, "en_rango", false),
        espera("p2", 22, "atrasada", false),
        espera("p3", 803, "atrasada", true),
        espera("p4", 803, "atrasada", true),
      ],
      "ida",
    );

    expect([...r.conReloj.keys()]).toEqual(["p1", "p2"]);
    expect(r.sinPasada).toEqual({ cuantas: 2, deCuantas: 4, minutos: 803 });
  });

  it("los huecos declarados no son esperas: ni reloj ni cuenta", () => {
    const r = esperasDelCarril(
      [espera("p1", null, "no_aplica", false), espera("p2", null, "sin_datos", false)],
      "ida",
    );
    expect(r.conReloj.size).toBe(0);
    expect(r.sinPasada).toBeNull();
  });

  it("sólo mira su sentido", () => {
    const otra = { ...espera("p9", 5, "en_rango", false), sentido: "vuelta" } as EsperaDeParada;
    expect(esperasDelCarril([otra], "ida").conReloj.size).toBe(0);
  });
});

describe("qué paradas llevan su nombre escrito", () => {
  /** 17 paradas repartidas parejas en un carril de 1354 px: ~79 px cada una. */
  const carril = (anchos: number[]): RotuloMedido[] =>
    anchos.map((anchoPx, i) => ({ centroPx: 1354 * 0.03 + (1354 * 0.94 * i) / (anchos.length - 1), anchoPx }));

  it("con nombres cortos y espacio de sobra, todas", () => {
    expect(rotulosQueCaben(carril(Array(17).fill(40))).size).toBe(17);
  });

  /*
   * EL CASO QUE LA CONSTANTE NO ATRAPABA. Con ~79 px por parada, una regla de
   * «hueco mínimo 78» decía «caben todas» — y «Fraccionamiento Praderas del Sur
   * Segunda Etapa» mide 250. Con el ancho medido, se ralean.
   */
  it("con nombres largos reales se ralean, aunque el hueco parezca suficiente", () => {
    const anchos = [45, 190, 250, 205, 215, 60, 95, 90, 95, 115, 110, 150, 65, 115, 100, 110, 50];
    const r = rotulosQueCaben(carril(anchos));
    expect(r.size).toBeLessThan(17);
    expect(r.has(0)).toBe(true);
    expect(r.has(16)).toBe(true);
  });

  it("los que quedan NO se tocan entre sí", () => {
    const anchos = [45, 190, 250, 205, 215, 60, 95, 90, 95, 115, 110, 150, 65, 115, 100, 110, 50];
    const medidos = carril(anchos);
    const r = [...rotulosQueCaben(medidos)].sort((a, b) => a - b);
    for (let i = 1; i < r.length; i++) {
      const izq = medidos[r[i - 1]!]!;
      const der = medidos[r[i]!]!;
      expect(der.centroPx - der.anchoPx / 2).toBeGreaterThanOrEqual(
        izq.centroPx + izq.anchoPx / 2 - HOLGURA_PX,
      );
    }
  });

  /*
   * La vencida es justo la que hay que poder nombrar por radio (9.2b): sin su
   * nombre, el cobre sería un tique anónimo.
   */
  it("la seleccionada y las vencidas NUNCA se ralean", () => {
    const anchos = Array(17).fill(250);
    const r = rotulosQueCaben(carril(anchos), new Set([7, 8]));
    expect(r.has(7)).toBe(true);
    expect(r.has(8)).toBe(true);
  });

  it("los dos extremos siempre: el carril dice de dónde sale y a dónde llega", () => {
    const r = rotulosQueCaben(carril(Array(17).fill(250)));
    expect(r.has(0)).toBe(true);
    expect(r.has(16)).toBe(true);
  });

  it("antes de medir se enseñan todas, no ninguna", () => {
    expect(rotulosQueCaben(carril(Array(17).fill(0))).size).toBe(17);
  });

  it("sin paradas no truena", () => {
    expect(rotulosQueCaben([]).size).toBe(0);
  });
});
