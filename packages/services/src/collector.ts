import type { Repositories } from "@jtel/db";
import { getProviderForCarrier, type GpsBackendConfig } from "./providers.js";

/** Resultado de UN sondeo. Nunca lanza: el error viaja como dato. */
export interface SondeoResult {
  /** Segundo dentro de la ventana en el que arrancó (0, 30, …). */
  offsetSeconds: number;
  ok: boolean;
  fetched: number;
  written: number;
  error?: string;
}

export interface CarrierCollectResult {
  carrierAccountId: string;
  carrierName: string;
  pollSeconds: number;
  sondeos: SondeoResult[];
  written: number;
  /** Falso solo si TODOS los sondeos de este carrier fallaron. */
  ok: boolean;
}

export interface CollectorOptions {
  /** Ventana que cubre una invocación del cron. Un minuto, que es el piso de Vercel. */
  windowSeconds?: number;
  /** Para las pruebas: reemplaza la espera real entre sondeos. */
  sleep?: (ms: number) => Promise<void>;
  /** Para las pruebas: reloj inyectable. */
  now?: () => Date;
  /** Para las pruebas: reemplaza la resolución del proveedor GPS del carrier. */
  provider?: (carrierAccountId: string) => Promise<{
    login: () => Promise<string>;
    getLastLocations: (token: string, imeis?: string[]) => Promise<
      Array<{
        imei: string;
        latitude: number;
        longitude: number;
        speed?: number;
        heading?: number;
        timestamp: Date;
      }>
    >;
  }>;
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Recolector de posición viva — el camino propio de la app pública.
 *
 * ## Por qué existe
 *
 * El archivador corre `*​/10 * * * *` y mete un retraso propio (medido el 26 de
 * agosto de 2026: p99 de 12.84 min). La app del pasajero no puede leer eso: una
 * posición congelada doce minutos es la mentira que el Tramo JB prohíbe.
 *
 * ## Por qué varios sondeos por invocación
 *
 * Los crones de Vercel tienen granularidad de un minuto. A 60 s la antigüedad
 * p90 queda en 3.0 min —el p90 del hueco entre fixes (2 min) más hasta 60 s de
 * espera al cron—, que es exactamente el umbral de dato viejo: la app estaría
 * cayendo a frecuencia declarada todo el tiempo.
 *
 * Con dos sondeos dentro de la misma invocación (a los 0 y a los 30 s) la
 * cadencia efectiva es de 30 s, el p90 baja a ~2.5 min, y quedan 30 segundos de
 * margen contra el umbral. Sin inventar infraestructura fuera de la plataforma.
 *
 * ## Un sondeo no puede tumbar a otro
 *
 * Cada sondeo es independiente: su propio try/catch, su propia escritura ya
 * confirmada antes de que el siguiente empiece. Si el de los 30 s falla o se
 * atrasa, el de los 0 ya escribió y la app tiene dato. **Ninguna invocación
 * falla entera por culpa de un sondeo**, y el resultado dice cuál falló y por
 * qué en vez de esconderlo detrás de un error único.
 *
 * Y el orden tampoco importa: `upsertMany` solo pisa la posición si la nueva es
 * más reciente, así que un sondeo lento que llega tarde no empuja al camión
 * hacia atrás.
 */
export class CollectorService {
  private windowSeconds: number;
  private sleep: (ms: number) => Promise<void>;
  private now: () => Date;
  private resolverProveedor: NonNullable<CollectorOptions["provider"]>;

  constructor(
    private repos: Repositories,
    private config: GpsBackendConfig,
    options: CollectorOptions = {},
  ) {
    this.windowSeconds = options.windowSeconds ?? 60;
    this.sleep = options.sleep ?? dormir;
    this.now = options.now ?? (() => new Date());
    this.resolverProveedor =
      options.provider ??
      ((carrierAccountId) => getProviderForCarrier(this.repos, this.config, carrierAccountId));
  }

  async collectAll(): Promise<{
    carriers: CarrierCollectResult[];
    totalWritten: number;
    /** Falso solo si ningún carrier logró un solo sondeo. Es lo que decide el código HTTP. */
    anyOk: boolean;
  }> {
    const carriers = await this.repos.accounts.listByType("carrier");
    const resultados: CarrierCollectResult[] = [];

    for (const carrier of carriers) {
      resultados.push(await this.collectCarrier(carrier.id, carrier.name));
    }

    return {
      carriers: resultados,
      totalWritten: resultados.reduce((a, r) => a + r.written, 0),
      anyOk: resultados.some((r) => r.ok),
    };
  }

  async collectCarrier(carrierAccountId: string, carrierName: string): Promise<CarrierCollectResult> {
    // La cadencia es del carrier, no del código: otro proveedor, otra cadencia,
    // se ajusta desde la pantalla sin desplegar.
    const perfil = await this.repos.carriers.getProfileByAccountId(carrierAccountId);
    const pollSeconds = Math.max(1, perfil?.gpsPollSeconds ?? 30);
    const sondeosPorVentana = Math.max(1, Math.floor(this.windowSeconds / pollSeconds));

    const sondeos: SondeoResult[] = [];
    for (let i = 0; i < sondeosPorVentana; i++) {
      const offsetSeconds = i * pollSeconds;
      // La espera va ANTES del sondeo y solo a partir del segundo: el primero
      // arranca de inmediato para que, si la invocación se corta, ya haya dato.
      if (i > 0) await this.sleep(pollSeconds * 1000);
      sondeos.push(await this.unSondeo(carrierAccountId, offsetSeconds));
    }

    return {
      carrierAccountId,
      carrierName,
      pollSeconds,
      sondeos,
      written: sondeos.reduce((a, s) => a + s.written, 0),
      ok: sondeos.some((s) => s.ok),
    };
  }

  /** Un sondeo. Aislado a propósito: aquí es donde se garantiza que uno no tumbe a otro. */
  private async unSondeo(carrierAccountId: string, offsetSeconds: number): Promise<SondeoResult> {
    try {
      const provider = await this.resolverProveedor(carrierAccountId);
      const dispositivos = await this.repos.fleet.getDevicesForCarrier(carrierAccountId);
      const porImei = new Map(
        dispositivos.filter((d) => d.imei).map((d) => [d.imei as string, d]),
      );
      if (porImei.size === 0) {
        return { offsetSeconds, ok: true, fetched: 0, written: 0 };
      }

      const token = await provider.login();
      const puntos = await provider.getLastLocations(token, [...porImei.keys()]);
      const collectedAt = this.now();

      const posiciones = puntos
        .filter((p) => porImei.has(p.imei))
        .map((p) => {
          const d = porImei.get(p.imei)!;
          return {
            imei: p.imei,
            carrierAccountId,
            deviceId: d.id,
            unitId: null,
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speed ?? null,
            heading: p.heading ?? null,
            recordedAt: p.timestamp,
            collectedAt,
          };
        });

      const escritas = await this.repos.livePositions.upsertMany(posiciones);
      return { offsetSeconds, ok: true, fetched: puntos.length, written: escritas.length };
    } catch (err) {
      // No se relanza: un sondeo caído es un dato del resumen, no el final de la
      // invocación. El que ya escribió sigue valiendo.
      return {
        offsetSeconds,
        ok: false,
        fetched: 0,
        written: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
