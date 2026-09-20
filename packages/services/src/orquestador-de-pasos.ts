import type { Repositories, ResultadoDeUnidad, UnidadSaltada } from "@jtel/db";

/**
 * El orquestador del detector de pasos: la ronda automática que lo corre solo
 * sobre la telemetría que va llegando (Marco 9.2 / 9.11).
 *
 * **Sólo orquesta.** El detector (`detectarYGuardar`) ya existe y no se toca:
 * esta clase decide QUÉ unidades y sobre QUÉ ventana, y lo que hace cada una lo
 * hace el repositorio en una transacción (marcador, candado, detección,
 * inserción — ver `detectarUnidadEnRonda`).
 *
 * **No sella nada.** Etapa 1: medir, no juzgar (Marco 9.3). Los pasos quedan
 * como hecho; el veredicto se calcula al leer.
 *
 * **Una unidad que falla no tumba a las demás.** Su transacción se revierte
 * —el marcador no se mueve—, el error se registra y la ronda sigue. Lo que no
 * se procesó se dice en el resultado: ni un cero callado ni un verde falso.
 */

/**
 * Qué versión del detector escribe. Subirla re-corre sin borrar nada: los pasos
 * apilan por ella y el marcador la lleva en la llave, así que la versión nueva
 * arranca limpia.
 */
export const VERSION_DEL_DETECTOR = "orquestador-v1";

/**
 * Cuánto se deja de margen antes de «ahora». El archivador llena
 * `telemetry_points` cada 10 minutos, así que un punto de hace 2 minutos
 * todavía no llegó: detectar sobre él sería detectar sobre datos incompletos, y
 * el marcador ya habría pasado. 15 > 10 con holgura.
 *
 * La latencia real del proveedor no está medida; se ajusta con camiones reales.
 */
export const COLCHON_MINUTOS = 15;

/** De dónde arranca una unidad que nunca corrió, sin bajar de su asignación. */
export const ARRANQUE_HORAS = 24;

/**
 * Cuánto de los 300 s de la ruta se gasta antes de parar. Lo que quede sin
 * procesar lo toma la ronda siguiente desde su marcador: parar no pierde nada.
 */
export const PRESUPUESTO_MS = 240_000;

export type ReposDelOrquestador = Pick<Repositories, "pasosPorParada">;

export type DetalleDeUnidad = {
  circuitId: string;
  unitId: string;
  estado: ResultadoDeUnidad["estado"];
  pasosGuardados: number;
  desde: string | null;
  hasta: string | null;
  marcaNueva: string | null;
  /** Sólo en una simulación: lo que se habría escrito. Acotado a 20 por unidad. */
  muestra?: Array<{
    stopId: string;
    sentido: "ida" | "vuelta";
    pasoDesde: string;
    pasoHasta: string;
    huecoSegundos: number;
  }>;
};

export type RondaDePasos = {
  simulado: boolean;
  detectorVersion: string;
  /** El techo de la ronda: ningún ping posterior se leyó. */
  hastaMaximo: string;
  elegibles: number;
  detectadas: number;
  sinNovedad: number;
  ocupadas: number;
  pasosGuardados: number;
  saltadas: UnidadSaltada[];
  fallidas: Array<{ circuitId: string; unitId: string; error: string }>;
  /** Elegibles que no se alcanzaron a procesar por el presupuesto de tiempo. */
  pendientes: number;
  detalle: DetalleDeUnidad[];
};

const MUESTRA_MAXIMA = 20;

export class OrquestadorDePasosService {
  constructor(
    private repos: ReposDelOrquestador,
    private reloj: () => Date = () => new Date(),
  ) {}

  async correr(opts: { simular?: boolean; presupuestoMs?: number } = {}): Promise<RondaDePasos> {
    const simular = opts.simular ?? false;
    const presupuestoMs = opts.presupuestoMs ?? PRESUPUESTO_MS;
    const inicio = this.reloj();
    const hastaMaximo = new Date(inicio.getTime() - COLCHON_MINUTOS * 60_000);
    const arranque = new Date(inicio.getTime() - ARRANQUE_HORAS * 3_600_000);

    // Si esto falla (p. ej. falta la 0047), la ronda entera falla y se ve: no hay
    // nada que salvar sin saber a quién le toca.
    const { elegibles, saltadas } = await this.repos.pasosPorParada.unidadesParaDetectar(VERSION_DEL_DETECTOR);

    const ronda: RondaDePasos = {
      simulado: simular,
      detectorVersion: VERSION_DEL_DETECTOR,
      hastaMaximo: hastaMaximo.toISOString(),
      elegibles: elegibles.length,
      detectadas: 0,
      sinNovedad: 0,
      ocupadas: 0,
      pasosGuardados: 0,
      saltadas,
      fallidas: [],
      pendientes: 0,
      detalle: [],
    };

    // La que lleva más tiempo sin avanzar va primero (y la que nunca corrió, antes que todas):
    // si el presupuesto se acaba, la que se queda esperando es la más reciente.
    const ordenadas = [...elegibles].sort(
      (a, b) => (a.marcaLastPingAt?.getTime() ?? -Infinity) - (b.marcaLastPingAt?.getTime() ?? -Infinity),
    );

    for (let i = 0; i < ordenadas.length; i++) {
      if (this.reloj().getTime() - inicio.getTime() > presupuestoMs) {
        ronda.pendientes = ordenadas.length - i;
        break;
      }
      const u = ordenadas[i]!;
      try {
        const r = await this.repos.pasosPorParada.detectarUnidadEnRonda({
          circuitId: u.circuitId,
          unitId: u.unitId,
          carrierAccountId: u.carrierAccountId,
          asignadaDesde: u.asignadaDesde,
          corridorToleranceMeters: u.corridorToleranceMeters,
          sentidos: u.sentidos,
          detectorVersion: VERSION_DEL_DETECTOR,
          arranque,
          hastaMaximo,
          simular,
        });
        if (r.estado === "detectada") {
          ronda.detectadas += 1;
          ronda.pasosGuardados += r.pasosGuardados;
          ronda.detalle.push({
            circuitId: u.circuitId,
            unitId: u.unitId,
            estado: r.estado,
            pasosGuardados: r.pasosGuardados,
            desde: r.desde?.toISOString() ?? null,
            hasta: r.hasta?.toISOString() ?? null,
            marcaNueva: r.marcaNueva?.toISOString() ?? null,
            ...(simular
              ? {
                  muestra: r.muestra.slice(0, MUESTRA_MAXIMA).map((m) => ({
                    stopId: m.stopId,
                    sentido: m.sentido,
                    pasoDesde: m.pasoDesde.toISOString(),
                    pasoHasta: m.pasoHasta.toISOString(),
                    huecoSegundos: m.huecoSegundos,
                  })),
                }
              : {}),
          });
        } else if (r.estado === "ocupada") {
          ronda.ocupadas += 1;
        } else {
          ronda.sinNovedad += 1;
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        // console.error y no log: es una unidad que no se pudo procesar, y en Vercel debe salir como error.
        console.error(`[orquestador-de-pasos] ${u.circuitId}/${u.unitId} falló y se revirtió: ${error}`);
        ronda.fallidas.push({ circuitId: u.circuitId, unitId: u.unitId, error });
      }
    }
    return ronda;
  }
}
