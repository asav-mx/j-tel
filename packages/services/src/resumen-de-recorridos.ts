import { recorridosPorTramo, type PasoDeUnaUnidad } from "@jtel/domain";
// Sólo la constante de la versión: este servicio no toca el detector ni su orquestador.
import { VERSION_DEL_DETECTOR } from "./orquestador-de-pasos.js";

/**
 * **El resumen de los recorridos por tramo** (Marco 8.16.5; 0053; PR 5a).
 *
 * Lo corre el cron `/api/cron/recorridos`, diario: lee los pasos de los últimos
 * días por circuito publicado, los agrega con la aritmética del dominio
 * (`recorridosPorTramo`) y **reemplaza** el resumen de cada circuito.
 *
 * ## Es el único que lee los pasos sin muro de cuenta, y por eso vive aquí
 *
 * Los pasos del detector están detrás del muro (9.14): la concesión ve los de
 * su circuito, el carrier los de sus unidades. El pasajero no tiene cuenta, y
 * lo que la 8.16.5 le autoriza es **el recorrido agregado del circuito**.
 *
 * Tres cerraduras, en vez de una cuenta (decisión de ASAV, 22-sep, camino B):
 *
 *  1. **No hay puerta a internet.** Sólo lo llama el cron, detrás de
 *     `CRON_SECRET`. Ninguna ruta de petición toca la lectura — lo exige la
 *     valla del muro.
 *  2. **La lectura no devuelve identidades:** `pasosParaElResumen` da una
 *     cadena anónima por camión, no el id de la unidad.
 *  3. **Lo que se escribe no guarda unidad ni transportista** (0053): lo que no
 *     se guarda no se puede filtrar.
 *
 * ## Reemplaza, no acumula
 *
 * Cada corrida borra el resumen del circuito y escribe el de la ventana nueva.
 * Un tramo que dejó de tener travesías suficientes **desaparece**, en vez de
 * quedarse con el número de la semana pasada: el planeador dirá «se está
 * midiendo», que es la verdad (8.16, regla 4).
 */

/** La ventana que se agrega: una semana (decisión de ASAV, 22-sep). */
export const VENTANA_DIAS = 7;

export interface ReposDelResumen {
  circuits: {
    listPublishedCircuits(): Promise<Array<{ publicSlug: string }>>;
    getPublishedCircuitBySlug(slug: string): Promise<{ id: string; publicSlug: string } | null>;
    guardarRecorridos(
      circuitId: string,
      tramos: Array<{
        sentido: "ida" | "vuelta";
        deStopId: string;
        aStopId: string;
        travesias: number;
        desdeSeg: number;
        medianaSeg: number;
        hastaSeg: number;
        ventanaDesde: Date;
        ventanaHasta: Date;
        detectorVersion: string;
      }>,
    ): Promise<number>;
  };
  pasosPorParada: {
    pasosParaElResumen(
      circuitId: string,
      desde: Date,
      hasta: Date,
    ): Promise<
      Array<{
        cadena: number;
        sentido: "ida" | "vuelta";
        parada: string;
        stopId: string;
        orden: number;
        desde: Date;
        hasta: Date;
        detectorVersion: string;
      }>
    >;
  };
}

export interface RondaDeRecorridos {
  ventanaDesde: string;
  ventanaHasta: string;
  circuitos: number;
  /** Pasos leídos, por circuito sumados: dice si el detector ya juntó algo. */
  pasos: number;
  /** Tramos publicables (con travesías suficientes). */
  tramos: number;
  /** Escritos de verdad. En una simulación, 0. */
  escritos: number;
  simulado: boolean;
  detalle: Array<{ ruta: string; pasos: number; tramos: number }>;
}

export class ResumenDeRecorridosService {
  constructor(
    private repos: ReposDelResumen,
    private reloj: () => Date = () => new Date(),
  ) {}

  async correr(opts: { simular?: boolean } = {}): Promise<RondaDeRecorridos> {
    const simular = opts.simular ?? false;
    const hasta = this.reloj();
    const desde = new Date(hasta.getTime() - VENTANA_DIAS * 86_400_000);

    const ronda: RondaDeRecorridos = {
      ventanaDesde: desde.toISOString(),
      ventanaHasta: hasta.toISOString(),
      circuitos: 0,
      pasos: 0,
      tramos: 0,
      escritos: 0,
      simulado: simular,
      detalle: [],
    };

    for (const { publicSlug } of await this.repos.circuits.listPublishedCircuits()) {
      const circuito = await this.repos.circuits.getPublishedCircuitBySlug(publicSlug);
      if (!circuito) continue;
      ronda.circuitos += 1;

      const pasos = await this.repos.pasosPorParada.pasosParaElResumen(circuito.id, desde, hasta);
      ronda.pasos += pasos.length;

      /*
       * Sólo la versión vigente del detector. Sus corridas se apilan, no se
       * pisan: mezclar dos versiones sobre los mismos días contaría el mismo
       * cruce dos veces con anchos distintos.
       */
      const deLaVersion = pasos.filter((p) => p.detectorVersion === VERSION_DEL_DETECTOR);
      const idDeParada = new Map(deLaVersion.map((p) => [p.parada, p.stopId]));
      const paraElCalculo: PasoDeUnaUnidad[] = deLaVersion.map((p) => ({
        unidad: String(p.cadena),
        sentido: p.sentido,
        parada: p.parada,
        orden: p.orden,
        desde: p.desde,
        hasta: p.hasta,
      }));

      const tramos = recorridosPorTramo(paraElCalculo).flatMap((t) => {
        const deStopId = idDeParada.get(t.de);
        const aStopId = idDeParada.get(t.a);
        // Sin las dos paradas identificadas no se escribe: no hay a qué colgarlo.
        if (!deStopId || !aStopId) return [];
        return [
          {
            sentido: t.sentido,
            deStopId,
            aStopId,
            travesias: t.travesias,
            desdeSeg: t.desdeSeg,
            medianaSeg: t.medianaSeg,
            hastaSeg: t.hastaSeg,
            ventanaDesde: desde,
            ventanaHasta: hasta,
            detectorVersion: VERSION_DEL_DETECTOR,
          },
        ];
      });

      ronda.tramos += tramos.length;
      ronda.detalle.push({ ruta: publicSlug, pasos: pasos.length, tramos: tramos.length });
      if (!simular) ronda.escritos += await this.repos.circuits.guardarRecorridos(circuito.id, tramos);
    }

    return ronda;
  }
}
