import { proyectarSobreTrazado } from "@jtel/domain";

/**
 * Cada parada con su distancia al trazado **de su sentido** — el paso 3 del
 * expediente de J-Staff (PR A3 de la ficha de Circuitos, 21-sep-2026).
 *
 * Es la misma proyección del dominio que usa el editor del mapa para pegarla,
 * así que la lista y el editor no pueden discrepar sobre a cuántos metros
 * quedó. Una parada de «ambos» se mide contra los dos trazados: sirve a los dos
 * sentidos, y donde la vuelta va por otra calle puede estar bien pegada a la
 * ida y lejísimos de la vuelta (el caso de Oasis, #487).
 *
 * **Lejos** es pasar la tolerancia del pegado del circuito
 * (`stop_snap_tolerance_meters`) — la misma con la que el editor avisa. Se dice
 * con texto, sin cobre: un aviso no es vida (ficha, corrección 2).
 */

export type Sentido = "ida" | "vuelta";

export interface ParadaMedida {
  stopId: string;
  nombre: string;
  qr: string;
  sentido: Sentido | null;
  /** Metros a cada trazado que le toca; `null` si ese sentido no tiene trazado. */
  distancias: Array<{ sentido: Sentido; metros: number | null }>;
  lejos: boolean;
}

export function medirParadas(
  paradas: Array<{ stopId: string; name: string; qrSlug: string; sentido: Sentido | null; latitude: number; longitude: number }>,
  trazados: Array<{ sentido: Sentido; coordinates: Array<[number, number]> }>,
  toleranciaMetros: number,
): ParadaMedida[] {
  return paradas.map((p) => {
    const suyos: Sentido[] = p.sentido === null ? ["ida", "vuelta"] : [p.sentido];
    const distancias = suyos.map((s) => {
      const t = trazados.find((x) => x.sentido === s)?.coordinates ?? null;
      const d = t ? proyectarSobreTrazado({ lat: p.latitude, lon: p.longitude }, t)?.distanciaMetros ?? null : null;
      return { sentido: s, metros: d };
    });
    return {
      stopId: p.stopId,
      nombre: p.name,
      qr: p.qrSlug,
      sentido: p.sentido,
      distancias,
      lejos: distancias.some((d) => d.metros !== null && d.metros > toleranciaMetros),
    };
  });
}

/** «ida 4 m · vuelta 96 m» — sin redondear a «~»: los instrumentos no redondean. */
export function distanciasEnPalabras(m: ParadaMedida): string {
  return m.distancias
    .map((d) => {
      const n = d.metros === null ? "sin trazado" : `${Math.round(d.metros)} m`;
      return m.distancias.length > 1 ? `${d.sentido} ${n}` : n;
    })
    .join(" · ");
}

export const SENTIDO_EN_PALABRAS: Record<"ida" | "vuelta" | "ambos", string> = {
  ida: "Ida",
  vuelta: "Vuelta",
  ambos: "Ambos",
};
