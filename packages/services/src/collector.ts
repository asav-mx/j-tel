import type { Repositories } from "@jtel/db";
import {
  getCompasProvider,
  getProviderForCarrier,
  usaCompas,
  type GpsBackendConfig,
} from "./providers.js";
import { cotejar, repartir, sincronizarAvisos, type ResumenCotejo } from "./cotejo-compas.js";

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
  /** Falso si todos los sondeos fallaron, o si el carrier ni siquiera llegó a sondear. */
  ok: boolean;
  /**
   * Presente solo cuando el carrier falló ANTES del primer sondeo — leyendo su
   * perfil, por ejemplo. Ahí no hay sondeos que reportar, y sin este campo el
   * resumen diría `sondeos: []` sin decir por qué.
   */
  error?: string;
}

/** Lo que una pasada de Compás dejó escrito, cuenta por cuenta. */
export interface PasadaCompasResult {
  pollSeconds: number;
  sondeos: SondeoResult[];
  /** Cada cuenta en Compás, con lo que se le escribió. Una cuenta sin posiciones sale con 0. */
  carriers: Array<{ carrierAccountId: string; carrierName: string; written: number }>;
  written: number;
  ok: boolean;
  /** El cotejo del primer sondeo que logró leer el catálogo. Ausente si ninguno lo logró. */
  cotejo?: ResumenCotejo;
}

type PuntoGps = {
  imei: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
};

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
  /** Para las pruebas: reemplaza la conexión de plataforma a Compás. */
  compas?: () => Promise<{
    login: () => Promise<string>;
    getLastLocations: (token: string) => Promise<PuntoGps[]>;
    getDevices: (token: string) => Promise<Array<{ imei: string }>>;
  }>;
}

/**
 * Cada cuánto se sondea Compás. Es de la plataforma y no de cada cuenta,
 * porque la pasada es una sola: `gps_poll_seconds` sigue gobernando a las
 * cuentas con proveedor propio, y a las de Compás no las toca.
 */
export const POLL_COMPAS_SEGUNDOS = 30;

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
  private resolverCompas: NonNullable<CollectorOptions["compas"]>;

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
    this.resolverCompas = options.compas ?? (async () => getCompasProvider(this.config));
  }

  /**
   * ## Una sola pasada para todas las cuentas en Compás
   *
   * Hasta el 14 de septiembre de 2026 este bucle iba cuenta por cuenta, y cada
   * una dormía 30 s entre sus dos sondeos. Con una cuenta, la invocación duraba
   * ~30 s. **Con dos, ~62 s: se empalmaba con el minuto siguiente. Con tres,
   * pasaba los 90 s de `maxDuration` y la cortaban.** El producto se rompía en
   * el tercer cliente.
   *
   * Compás es un solo servidor y `/api/positions` ya devuelve la última posición
   * de todos los aparatos en una llamada. Así que las cuentas en Compás se
   * sondean **juntas**: la duración ya no depende de cuántos clientes haya.
   *
   * Las cuentas con proveedor propio siguen con su sondeo de siempre, **en
   * paralelo** con la pasada y entre ellas, no en fila.
   *
   * Juntas se recogen; **a quién pertenece cada posición lo sigue decidiendo la
   * tabla de aparatos de J-Tel** (`repartir`), y ninguna cuenta recibe la de
   * otra.
   */
  async collectAll(): Promise<{
    /** Las cuentas con proveedor propio, o cuyo perfil no se pudo leer. */
    carriers: CarrierCollectResult[];
    /** La pasada de Compás. `null` si ninguna cuenta está en Compás. */
    compas: PasadaCompasResult | null;
    totalWritten: number;
    /** Falso solo si ni la pasada ni ningún carrier lograron un solo sondeo. Es lo que decide el código HTTP. */
    anyOk: boolean;
  }> {
    const carriers = await this.repos.accounts.listByType("carrier");
    const nombres = new Map(carriers.map((c) => [c.id, c.name]));

    /*
     * Cada carrier aislado, también al leer su perfil. Si eso falla no se sabe
     * si la cuenta es de Compás, así que va por su camino propio, que reporta
     * el error sin tumbar a nadie: el 26 de agosto de 2026 la columna
     * `gps_poll_seconds` no existía todavía en producción y la invocación
     * entera reventaba con 500 cada minuto, aunque el proveedor respondía bien.
     */
    const perfiles = await Promise.all(
      carriers.map(async (c) => {
        try {
          return { carrier: c, perfil: await this.repos.carriers.getProfileByAccountId(c.id) };
        } catch (err) {
          return { carrier: c, error: err };
        }
      }),
    );

    const enCompas = perfiles.filter((p) => !("error" in p) && usaCompas(p.perfil));
    const propios = perfiles.filter((p) => !enCompas.includes(p));

    const [pasada, ...resultados] = await Promise.all([
      enCompas.length > 0
        ? this.pasadaCompas(
            enCompas.map((p) => p.carrier),
            nombres,
          )
        : Promise.resolve(null),
      ...propios.map(async (p): Promise<CarrierCollectResult> => {
        try {
          if ("error" in p) throw p.error;
          return await this.collectCarrier(p.carrier.id, p.carrier.name);
        } catch (err) {
          return {
            carrierAccountId: p.carrier.id,
            carrierName: p.carrier.name,
            pollSeconds: 0,
            sondeos: [],
            written: 0,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    ]);

    return {
      carriers: resultados,
      compas: pasada,
      totalWritten: resultados.reduce((a, r) => a + r.written, 0) + (pasada?.written ?? 0),
      anyOk: resultados.some((r) => r.ok) || Boolean(pasada?.ok),
    };
  }

  /** Los sondeos de la ventana para todas las cuentas en Compás juntas. */
  private async pasadaCompas(
    carriers: Array<{ id: string; name: string }>,
    nombres: Map<string, string>,
  ): Promise<PasadaCompasResult> {
    const cuentas = new Set(carriers.map((c) => c.id));
    const porCuenta = new Map(carriers.map((c) => [c.id, 0]));
    const sondeosPorVentana = Math.max(1, Math.floor(this.windowSeconds / POLL_COMPAS_SEGUNDOS));

    const sondeos: SondeoResult[] = [];
    let cotejo: ResumenCotejo | undefined;
    for (let i = 0; i < sondeosPorVentana; i++) {
      const offsetSeconds = i * POLL_COMPAS_SEGUNDOS;
      if (i > 0) await this.sleep(POLL_COMPAS_SEGUNDOS * 1000);
      const r = await this.unSondeoCompas(cuentas, nombres, offsetSeconds, !cotejo);
      for (const [cuenta, n] of r.porCuenta) porCuenta.set(cuenta, (porCuenta.get(cuenta) ?? 0) + n);
      cotejo ??= r.cotejo;
      sondeos.push(r.sondeo);
    }

    return {
      pollSeconds: POLL_COMPAS_SEGUNDOS,
      sondeos,
      carriers: carriers.map((c) => ({
        carrierAccountId: c.id,
        carrierName: c.name,
        written: porCuenta.get(c.id) ?? 0,
      })),
      written: sondeos.reduce((a, s) => a + s.written, 0),
      ok: sondeos.some((s) => s.ok),
      ...(cotejo ? { cotejo } : {}),
    };
  }

  /**
   * Un sondeo de Compás. Aislado igual que `unSondeo`: nunca lanza.
   *
   * El cotejo va DESPUÉS de escribir, y su propia falla no borra lo escrito:
   * primero la posición del pasajero, luego la vigilancia.
   */
  private async unSondeoCompas(
    cuentas: Set<string>,
    nombres: Map<string, string>,
    offsetSeconds: number,
    cotejarAhora: boolean,
  ): Promise<{ sondeo: SondeoResult; porCuenta: Map<string, number>; cotejo?: ResumenCotejo }> {
    const porCuenta = new Map<string, number>();
    try {
      const provider = await this.resolverCompas();
      const aparatos = await this.repos.fleet.listDeviceOwners();
      const { porImei } = repartir(aparatos, cuentas);

      const token = await provider.login();
      const puntos = await provider.getLastLocations(token);
      const collectedAt = this.now();

      const posiciones = puntos.flatMap((p) => {
        const d = porImei.get(p.imei);
        if (!d) return [];
        return [
          {
            imei: p.imei,
            carrierAccountId: d.carrierAccountId,
            deviceId: d.id,
            unitId: null,
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speed ?? null,
            heading: p.heading ?? null,
            recordedAt: p.timestamp,
            collectedAt,
          },
        ];
      });

      const escritas = await this.repos.livePositions.upsertMany(posiciones);
      for (const e of escritas) {
        porCuenta.set(e.carrierAccountId, (porCuenta.get(e.carrierAccountId) ?? 0) + 1);
      }
      const sondeo = { offsetSeconds, ok: true, fetched: puntos.length, written: escritas.length };

      if (!cotejarAhora) return { sondeo, porCuenta };
      try {
        const catalogo = await provider.getDevices(token);
        const cotejo = await sincronizarAvisos(
          this.repos,
          cotejar(
            catalogo.map((d) => d.imei),
            aparatos,
            cuentas,
            new Map(puntos.map((p) => [p.imei, p.timestamp])),
          ),
          nombres,
        );
        return { sondeo, porCuenta, cotejo };
      } catch {
        // Sin catálogo no hay cotejo; el siguiente sondeo lo vuelve a intentar.
        return { sondeo, porCuenta };
      }
    } catch (err) {
      return {
        sondeo: {
          offsetSeconds,
          ok: false,
          fetched: 0,
          written: 0,
          error: err instanceof Error ? err.message : String(err),
        },
        porCuenta,
      };
    }
  }

  async collectCarrier(carrierAccountId: string, carrierName: string): Promise<CarrierCollectResult> {
    // Sólo para cuentas con proveedor PROPIO: las de Compás van en la pasada
    // de plataforma, con `POLL_COMPAS_SEGUNDOS`, y esta columna no las toca.
    //
    // La cadencia es del carrier, no del código: vive en
    // `carrier_profiles.gps_poll_seconds` y cambia sin desplegar, pero NO hay
    // pantalla que la edite — hoy sólo se mueve escribiendo en la base.
    //
    // Y la segunda mentira que la perilla no confiesa: un valor MAYOR A 60 no
    // sondea más lento. El cron corre cada minuto y la ventana es de 60 s, así
    // que `floor(60 / pollSeconds)` da 0 y `Math.max(1, …)` lo sube a 1 —
    // sondea una vez por invocación, cada minuto, igual que con 60, y sin
    // avisar. Para ir más lento hay que cambiar el calendario del cron o hacer
    // que el recolector se salte invocaciones; esta columna sola no alcanza.
    // Hay una prueba que fija este comportamiento de hoy.
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
