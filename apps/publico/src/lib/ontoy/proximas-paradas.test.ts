import { describe, expect, it } from "vitest";
import { proximasParadasDeLaUnidad } from "./llegadas";
import type { Forma, Sentido } from "./forma";

/*
 * **Tocar a Cami → sus próximas paradas.**
 *
 * ## Qué NO prueba, y conviene leerlo antes que el verde
 *
 * **No prueba que la proyección sobre el trazado sea correcta.** Eso es
 * `avanceSobreTrazado`, que vive en el dominio y tiene lo suyo. Aquí se prueba
 * lo que esta función decide **encima** de ella: qué se descarta, en qué orden
 * queda y dónde se corta.
 *
 * **No prueba nada sobre el tiempo.** Esta función no da minutos y no puede:
 * sin corredor calibrado no hay minuto que dar (8.9b). Si alguien le agrega uno,
 * la prueba que hace falta no es ésta.
 */

/**
 * Un trazado recto sobre el mismo meridiano: el avance es la latitud.
 *
 * **Va en `[lon, lat]`**, que es el orden de `forma.trazados[].coordenadas` tal
 * como baja del servidor —GeoJSON—, y el que espera `proyectarSobreTrazado`. El
 * mapa es el que lo voltea para Leaflet, no al revés. Escrito aquí porque esta
 * prueba nació con el orden cambiado y devolvía listas vacías sin quejarse:
 * todo caía «fuera del corredor», que es un vacío legítimo y por eso no se veía.
 */
const RECTA: Array<[number, number]> = Array.from({ length: 41 }, (_, i) => [-106.45, 31.6 + i * 0.002]);

function forma(paradas: Array<{ id: string; lat: number; sentido?: Sentido | null }>): Forma {
  return {
    circuito_id: "c", nombre: "Ruta de prueba", color_hex: "#4F7FD8",
    piso_rango_seg: 60, dato_viejo_seg: 180, corredor_m: 120, velocidad_declarada_kmh: 20,
    horario: { inicio: "05:00:00", fin: "23:00:00", zona: "America/Ciudad_Juarez" },
    trazados: [{ sentido: "ida", coordenadas: RECTA, largo_m: 8900 }],
    paradas: paradas.map((p, i) => ({
      id: p.id, nombre: p.id.toUpperCase(), orden: i,
      sentido: p.sentido === undefined ? "ida" : p.sentido,
      lat: p.lat, lon: -106.45,
    })),
  };
}

const TRAZADOS = new Map<Sentido, Array<[number, number]>>([["ida", RECTA]]);

describe("las próximas paradas de una unidad", () => {
  const f = forma([
    { id: "a", lat: 31.61 },
    { id: "b", lat: 31.63 },
    { id: "c", lat: 31.65 },
    { id: "d", lat: 31.67 },
  ]);
  const unidad = { lat: 31.62, lon: -106.45, sentido: "ida" as Sentido };

  it("las cuenta desde donde va, y la primera es «a 1 parada»", () => {
    expect(proximasParadasDeLaUnidad(unidad, { forma: f, trazadoPorSentido: TRAZADOS })).toEqual([
      { id: "b", nombre: "B", paradas: 1 },
      { id: "c", nombre: "C", paradas: 2 },
      { id: "d", nombre: "D", paradas: 3 },
    ]);
  });

  it("la que ya quedó atrás NO es una próxima parada", () => {
    /*
     * La «a» está a sus espaldas. Ponerla en la lista invitaría a alguien a
     * caminar hacia una parada por la que este camión ya pasó.
     */
    const ids = proximasParadasDeLaUnidad(unidad, { forma: f, trazadoPorSentido: TRAZADOS }).map((p) => p.id);
    expect(ids).not.toContain("a");
  });

  it("se corta donde se le pide, sin renumerar lo que sí entra", () => {
    const dos = proximasParadasDeLaUnidad(unidad, { forma: f, trazadoPorSentido: TRAZADOS }, 2);
    expect(dos.map((p) => p.paradas)).toEqual([1, 2]);
  });

  it("una parada del OTRO sentido no entra; una de los dos sí", () => {
    const mixta = forma([
      { id: "suya", lat: 31.63 },
      { id: "ajena", lat: 31.64, sentido: "vuelta" },
      { id: "ambas", lat: 31.65, sentido: null },
    ]);
    const ids = proximasParadasDeLaUnidad(unidad, { forma: mixta, trazadoPorSentido: TRAZADOS }).map((p) => p.id);
    expect(ids).toEqual(["suya", "ambas"]);
  });

  it("sin sentido no contesta: no se sabe si viene o va", () => {
    expect(
      proximasParadasDeLaUnidad({ ...unidad, sentido: null }, { forma: f, trazadoPorSentido: TRAZADOS }),
    ).toEqual([]);
  });

  it("fuera del corredor devuelve vacío en vez de las paradas de la ruta", () => {
    /*
     * Una unidad que se salió del corredor no tiene «próximas paradas» que se
     * puedan sostener. Devolver las de la ruta las presentaría como suyas —que
     * es el §E del Marco: completar un hueco porque la pantalla se ve mejor
     * entera.
     */
    const lejos = { lat: 31.62, lon: -106.9, sentido: "ida" as Sentido };
    expect(proximasParadasDeLaUnidad(lejos, { forma: f, trazadoPorSentido: TRAZADOS })).toEqual([]);
  });

  it("sin trazado de su sentido devuelve vacío", () => {
    expect(proximasParadasDeLaUnidad(unidad, { forma: f, trazadoPorSentido: new Map() })).toEqual([]);
  });
});
