import type { Sentido } from "@/lib/ontoy/forma";

/**
 * Los recorridos por tramo que la app del pasajero recibe (Marco 8.16.5).
 *
 * ## Qué lleva, y qué no
 *
 * Por tramo: **las dos paradas por su identificador público, el sentido,
 * cuántas travesías lo sostienen y el rango** (lo menos y lo más que tarda, con
 * su centro). Y **cuándo se midió**, para que la pantalla pueda decirlo.
 *
 * **Ni unidad ni transportista.** No hace falta quitarlos: la tabla que se lee
 * no los tiene (0053). Lo que no se guarda no se puede filtrar.
 *
 * El objeto se arma campo por campo, como la lista de paradas: nada de esparcir
 * la fila, para que una columna nueva no salga a la calle sola.
 */

export interface TramoDeLaCiudad {
  sentido: Sentido;
  de: string;
  a: string;
  travesias: number;
  desde_seg: number;
  mediana_seg: number;
  hasta_seg: number;
}

export interface RecorridosDeUnaRuta {
  ruta: string;
  /** Hasta cuándo llegó la ventana medida (ISO). La pantalla dice «medido estos 7 días». */
  medido_hasta: string;
  tramos: TramoDeLaCiudad[];
}

export interface FuenteDeRecorridos {
  recorridosPublicados(): Promise<
    Array<{
      ruta: string;
      sentido: string;
      de: string;
      a: string;
      travesias: number;
      desdeSeg: number;
      medianaSeg: number;
      hastaSeg: number;
      ventanaHasta: Date;
    }>
  >;
}

export async function recorridosDeLaCiudad(fuente: FuenteDeRecorridos): Promise<RecorridosDeUnaRuta[]> {
  const porRuta = new Map<string, RecorridosDeUnaRuta>();
  for (const f of await fuente.recorridosPublicados()) {
    const ruta =
      porRuta.get(f.ruta) ?? { ruta: f.ruta, medido_hasta: f.ventanaHasta.toISOString(), tramos: [] };
    // La ventana más reciente de la ruta: sus tramos se calculan en la misma corrida.
    if (f.ventanaHasta.toISOString() > ruta.medido_hasta) ruta.medido_hasta = f.ventanaHasta.toISOString();
    ruta.tramos.push({
      sentido: f.sentido === "vuelta" ? "vuelta" : "ida",
      de: f.de,
      a: f.a,
      travesias: f.travesias,
      desde_seg: f.desdeSeg,
      mediana_seg: f.medianaSeg,
      hasta_seg: f.hastaSeg,
    });
    porRuta.set(f.ruta, ruta);
  }
  return [...porRuta.values()];
}
