import type { Repositories } from "@jtel/db";
import {
  getProviderForCarrier,
  tieneConexionGps,
  type GpsBackendConfig,
  type GpsProviderInstance,
} from "./providers.js";

export interface ArchiverOptions {
  /** Minutos hacia atrás la primera vez que se archiva un carrier (sin watermark). */
  firstRunLookbackMinutes?: number;
  /** Minutos de traslape antes de la marca de cada aparato, para no perder puntos en el borde. */
  overlapMinutes?: number;
  /** Horas máximas por trozo (Umbrella + muchos IMEIs no aguanta ventanas enormes). */
  chunkHours?: number;
  /**
   * Cuántos trozos lee cada APARATO por corrida, como máximo. Antes era por
   * cuenta; ahora es por aparato para que uno muy atrasado no se coma la
   * corrida de los demás.
   */
  maxChunksPerRun?: number;
  /**
   * Cuánto tiempo puede ocupar una corrida antes de dejar de empezar lecturas.
   * Por debajo de los 300 s de `maxDuration` de la ruta, con margen para
   * terminar de escribir lo que ya se leyó: una corrida que Vercel mata no
   * llega a anotar nada.
   */
  presupuestoMs?: number;
  /** Para las pruebas: reloj inyectable para el presupuesto. */
  reloj?: () => number;
  /** Para las pruebas: reemplaza la resolución del proveedor GPS del carrier. */
  provider?: (carrierAccountId: string) => Promise<
    Pick<GpsProviderInstance, "name" | "login" | "getDevices" | "getHistoryLocations">
  >;
}

/** Un aparato que no se pudo leer en esta corrida. Su marca no se movió. */
export interface AparatoSinLeer {
  imei: string;
  error: string;
}

export interface CarrierArchiveResult {
  carrierAccountId: string;
  carrierName: string;
  imeis: number;
  fetched: number;
  saved: number;
  from: string;
  to: string;
  chunks?: number;
  skipped?: string;
  error?: string;
  /** Cómo le fue a cada aparato. Ausente si la cuenta se saltó entera. */
  aparatos?: {
    /** Leídos hasta el final de su ventana en esta corrida. */
    alDia: number;
    /** El proveedor falló para ellos. Se retoman primero en la corrida siguiente. */
    fallidos: AparatoSinLeer[];
    /** No alcanzó el presupuesto de la corrida. Se retoman primero en la siguiente. */
    sinTerminar: number;
    /** Leyeron su tope de trozos (`maxChunksPerRun`) y todavía les falta. */
    atrasados: number;
    /** El proveedor no los conoce: no se les pregunta y su marca no se toca. */
    fueraDelProveedor: number;
  };
}

/**
 * Archivador continuo de telemetría ("memoria propia").
 *
 * Umbrella pagina de a 100 y topea ~50 páginas por consulta. Si la ventana
 * crece (cron caído), hay que trocear por tiempo y por lotes de IMEI; si no,
 * la marca de agua se atasca y deja de guardar.
 */
/**
 * El error de un archivo, listo para guardar sin perder lo que importa.
 *
 * **La causa venía al final y se cortaba.** Las alertas guardaban
 * `message.slice(0, 200)`, y el mensaje de una consulta fallida de Drizzle
 * empieza con el SQL completo: doscientos caracteres no alcanzan ni para
 * terminar el `select`. Las veinte alertas del 26 de agosto quedaron todas
 * cortadas a media consulta, y **por qué falló no se puede saber** — si fue
 * tiempo de espera, pool agotado o permisos.
 *
 * Ahora la causa va al FRENTE del mensaje, que es donde el humano la lee, y el
 * texto íntegro va en `metadata`, que es `jsonb` y no lo recorta nadie. El
 * mensaje sigue acotado a propósito: la pantalla de verificación lo pinta
 * entero, y un `select` de cuarenta columnas ahí dentro no es información, es
 * una pared.
 */
export function detalleDelError(err: unknown): {
  /** El texto completo, tal cual. Va a `metadata`, nunca se recorta. */
  error: string;
  /** El error de abajo, que es el que dice QUÉ pasó. */
  causa: string | null;
  /** El código de Postgres, si lo hay: lo más diagnóstico y lo más corto. */
  codigo: string | null;
  /** Una línea para el humano: la causa si la hay, si no el principio. */
  resumen: string;
} {
  const error = err instanceof Error ? err.message : String(err);
  const abajo = err instanceof Error ? err.cause : undefined;
  const causa =
    abajo instanceof Error ? abajo.message : typeof abajo === "string" ? abajo : null;
  const codigo =
    abajo && typeof abajo === "object" && "code" in abajo && typeof abajo.code === "string"
      ? abajo.code
      : null;
  const cabeza = causa ?? error;
  return {
    error,
    causa,
    codigo,
    resumen: cabeza.length > 300 ? `${cabeza.slice(0, 300)}…` : cabeza,
  };
}

/**
 * Cuánto puede ocupar una corrida del archivador antes de dejar de empezar
 * lecturas. La ruta tiene `maxDuration = 300`; los 60 s de margen son para
 * terminar de escribir lo que ya se leyó y, en el peor caso, esperar el tiempo
 * máximo de una petición a Traccar (10 s) que ya estaba en curso.
 */
export const PRESUPUESTO_POR_CORRIDA_MS = 240_000;

export class ArchiverService {
  private firstRunLookbackMinutes: number;
  private overlapMinutes: number;
  private chunkHours: number;
  private maxChunksPerRun: number;
  private presupuestoMs: number;
  private reloj: () => number;
  private resolverProveedor: NonNullable<ArchiverOptions["provider"]>;

  constructor(
    private repos: Repositories,
    private config: GpsBackendConfig,
    options: ArchiverOptions = {},
  ) {
    this.firstRunLookbackMinutes = options.firstRunLookbackMinutes ?? 60;
    this.overlapMinutes = options.overlapMinutes ?? 5;
    this.chunkHours = options.chunkHours ?? 1;
    this.maxChunksPerRun = options.maxChunksPerRun ?? 12;
    this.presupuestoMs = options.presupuestoMs ?? PRESUPUESTO_POR_CORRIDA_MS;
    this.reloj = options.reloj ?? Date.now;
    this.resolverProveedor =
      options.provider ??
      ((carrierAccountId) => getProviderForCarrier(this.repos, this.config, carrierAccountId));
  }

  async archiveAll(now = new Date()): Promise<{
    carriers: CarrierArchiveResult[];
    totalSaved: number;
  }> {
    const carriers = await this.repos.accounts.listByType("carrier");
    const results: CarrierArchiveResult[] = [];
    // El presupuesto es de la CORRIDA, no de cada cuenta: los 300 s de Vercel
    // son de la invocación entera.
    const limite = this.reloj() + this.presupuestoMs;

    for (const carrier of carriers) {
      try {
        results.push(await this.archiveCarrier(carrier.id, carrier.name, now, limite));
      } catch (err) {
        const d = detalleDelError(err);
        try {
          await this.repos.ingestAlerts.create({
            carrierAccountId: carrier.id,
            kind: "archive_error",
            severity: "warning",
            message: `Archivo falló: ${d.resumen}`,
            metadata: {
              at: now.toISOString(),
              error: d.error,
              causa: d.causa,
              codigo: d.codigo,
            },
          });
        } catch {
          /* ignore */
        }
        results.push({
          carrierAccountId: carrier.id,
          carrierName: carrier.name,
          imeis: 0,
          fetched: 0,
          saved: 0,
          from: "",
          to: now.toISOString(),
          // El texto íntegro, el mismo que antes: este campo va al resumen de
          // la corrida, no a la pantalla, y ahí recortar sólo estorba.
          error: d.error,
        });
      }
    }

    return {
      carriers: results,
      totalSaved: results.reduce((sum, r) => sum + r.saved, 0),
    };
  }

  /**
   * Archiva una cuenta, aparato por aparato, cada uno desde su propia marca.
   *
   * ## Por qué por aparato
   *
   * Hasta el 15 de septiembre de 2026 había UNA marca por cuenta y avanzaba por
   * tandas de cinco aparatos, antes de leer las tandas que faltaban. Si un
   * aparato no contestaba —o Vercel cortaba la corrida— la marca ya estaba en
   * «ahora» y los aparatos sin leer perdían su ventana para siempre. En la
   * desechable, con UN aparato mudo de 100, 70 perdieron ~10 minutos; y el
   * relleno de huecos no lo ve, porque sólo busca huecos de más de 15.
   *
   * ## Las tres condiciones que vuelven el corte «más vueltas» y no pérdida
   *
   * 1. **El más atrasado primero.** Sin esto, una corrida que no alcanza corta
   *    siempre en el mismo lugar y los últimos no se leen nunca.
   * 2. **Un aparato que falla no detiene a los demás.** Se anota, su marca no
   *    se mueve, y la corrida sigue con el siguiente.
   * 3. **Se deja de empezar lecturas antes de que Vercel mate la corrida.** Lo
   *    que ya se leyó se escribe y se anota; lo que no, conserva su marca.
   *
   * La marca de agua de la CUENTA se sigue escribiendo igual que antes —el
   * último punto archivado—, porque la leen la verificación, el latido, J-Staff
   * y `/api/salud`. Cambiar lo que significa es otra conversación.
   */
  async archiveCarrier(
    carrierAccountId: string,
    carrierName: string,
    now: Date,
    limite = this.reloj() + this.presupuestoMs,
  ): Promise<CarrierArchiveResult> {
    const base: CarrierArchiveResult = {
      carrierAccountId,
      carrierName,
      imeis: 0,
      fetched: 0,
      saved: 0,
      from: "",
      to: now.toISOString(),
      chunks: 0,
    };

    // «¿Tiene conexión?» y no «¿tiene credenciales?»: una cuenta en Compás no
    // guarda credencial y sí tiene de dónde leer. Con la pregunta vieja, el
    // archivador se saltaría en silencio a todas las cuentas de Compás.
    if (!(await tieneConexionGps(this.repos, carrierAccountId))) {
      return { ...base, skipped: "sin conexión GPS" };
    }

    const devices = await this.repos.fleet.getDevicesForCarrier(carrierAccountId);
    const imeis = [...new Set(devices.map((d) => d.imei).filter(Boolean))];
    if (imeis.length === 0) return { ...base, skipped: "sin dispositivos" };
    base.imeis = imeis.length;

    const imeiToDevice = new Map(devices.map((d) => [d.imei, d]));
    const watermark = await this.repos.telemetry.getWatermark(carrierAccountId);
    const marcas = await this.repos.telemetry.getArchiveMarks(carrierAccountId);

    /*
     * Un aparato sin marca arranca donde arrancaba hasta hoy: la marca de agua
     * de la cuenta. Así el primer despliegue de la marca por aparato no vuelve a
     * leer la historia, y un aparato recién dado de alta no pide su pasado.
     */
    const arranquePorOmision = watermark
      ? watermark.lastRecordedAt
      : new Date(now.getTime() - this.firstRunLookbackMinutes * 60_000);

    const provider = await this.resolverProveedor(carrierAccountId);
    const token = await provider.login();

    /*
     * Al proveedor sólo se le pregunta por los aparatos que conoce. Uno que no
     * está en su catálogo —los de Umbrella, en una cuenta que ya lee de
     * Compás— devolvería una lista vacía sin preguntar nada, y tomarla por
     * «leído, sin puntos» le movería la marca a un aparato que nadie leyó.
     */
    const enElProveedor = new Set((await provider.getDevices(token)).map((d) => d.imei));

    const pendientes = imeis
      .filter((imei) => enElProveedor.has(imei))
      .map((imei) => ({ imei, desde: marcas.get(imei) ?? arranquePorOmision }))
      .sort((a, b) => a.desde.getTime() - b.desde.getTime() || a.imei.localeCompare(b.imei));

    /*
     * Los aparatos sin marca quedan anotados AQUÍ, en su punto de arranque,
     * antes de leer a nadie.
     *
     * Sin esto, uno que falla o se queda sin leer en su primera corrida
     * arrancaría la siguiente desde la marca de la CUENTA, que para entonces ya
     * empujaron a «ahora» los aparatos que sí contestaron: exactamente la
     * pérdida que la marca por aparato vino a quitar. Lo atrapó la prueba «el
     * que falló recupera su ventana entera».
     */
    for (const { imei, desde } of pendientes) {
      if (!marcas.has(imei)) {
        await this.repos.telemetry.setArchiveMark(carrierAccountId, imei, desde);
      }
    }

    const aparatos = {
      alDia: 0,
      fallidos: [] as AparatoSinLeer[],
      sinTerminar: 0,
      atrasados: 0,
      fueraDelProveedor: imeis.length - pendientes.length,
    };
    base.aparatos = aparatos;
    if (pendientes.length > 0) {
      const primero = new Date(pendientes[0]!.desde.getTime() - this.overlapMinutes * 60_000);
      base.from = primero.toISOString();
    }

    const chunkMs = this.chunkHours * 60 * 60_000;
    let latestPointAt: Date | null = watermark?.lastRecordedAt ?? null;

    let limitado = false;
    for (let i = 0; i < pendientes.length; i++) {
      if (limitado || this.reloj() >= limite) {
        aparatos.sinTerminar = pendientes.length - i;
        break;
      }
      const { imei, desde } = pendientes[i]!;
      let cursor = new Date(desde.getTime() - this.overlapMinutes * 60_000);
      let trozos = 0;
      let fallo = false;

      while (cursor < now && trozos < this.maxChunksPerRun && this.reloj() < limite) {
        const chunkEnd = new Date(Math.min(cursor.getTime() + chunkMs, now.getTime()));
        if (chunkEnd <= cursor) break;

        let points;
        try {
          points = await provider.getHistoryLocations(token, {
            imeis: [imei],
            beginGmt: cursor,
            endGmt: chunkEnd,
          });
        } catch (err) {
          // Su marca se queda donde está y la corrida sigue con el siguiente.
          const d = detalleDelError(err);
          aparatos.fallidos.push({ imei, error: d.resumen });
          fallo = true;
          if (/429|503|quota|exceeded|too many/i.test(d.error)) {
            // Un proveedor que pide bajarle no mejora con más peticiones: la
            // corrida para aquí y los que faltan conservan su marca.
            limitado = true;
            try {
              await this.repos.ingestAlerts.create({
                carrierAccountId,
                kind: "rate_limit",
                severity: "warning",
                message: `Rate limit en archivo: ${d.resumen}`,
                metadata: {
                  imei,
                  cursor: cursor.toISOString(),
                  chunkEnd: chunkEnd.toISOString(),
                  error: d.error,
                  causa: d.causa,
                  codigo: d.codigo,
                },
              });
            } catch {
              /* ignore */
            }
          }
          break;
        }

        // Sólo los puntos del aparato que se pidió: la marca que se escribe es
        // la suya, y un proveedor que devolviera de más no debe colarle puntos
        // de otro aparato a su ventana.
        const suyos = points.filter((p) => p.imei === imei);
        base.fetched += suyos.length;

        if (suyos.length > 0) {
          const resolved = await Promise.all(
            suyos.map(async (p) => {
              const device = imeiToDevice.get(p.imei);
              let unitId: string | null = null;
              const deviceId: string | null = device?.id ?? null;
              if (device) {
                const assignment = await this.repos.fleet.resolveUnitAtTime(device.id, p.timestamp);
                if (assignment) unitId = assignment.unitId;
              }
              return {
                carrierAccountId,
                imei: p.imei,
                latitude: p.latitude,
                longitude: p.longitude,
                speed: p.speed,
                recordedAt: p.timestamp,
                deviceId,
                unitId,
                source: provider.name,
              };
            }),
          );
          const savedRows = await this.repos.telemetry.savePoints(resolved);
          base.saved += savedRows.length;
          for (const p of suyos) {
            if (!latestPointAt || p.timestamp > latestPointAt) latestPointAt = p.timestamp;
          }
        }

        // Los puntos ya están guardados: AHORA se anota hasta dónde se leyó.
        // Si esta escritura no llega, la corrida siguiente vuelve a pedir la
        // ventana y el índice único de `telemetry_points` descarta lo repetido.
        await this.repos.telemetry.setArchiveMark(carrierAccountId, imei, chunkEnd);
        cursor = chunkEnd;
        trozos += 1;
        base.chunks = (base.chunks ?? 0) + 1;
      }

      if (fallo) continue;
      if (cursor >= now) {
        aparatos.alDia += 1;
      } else if (this.reloj() >= limite) {
        // Se acabó el presupuesto a media lectura: éste y los que siguen.
        aparatos.sinTerminar = pendientes.length - i;
        break;
      } else {
        // Leyó su tope de trozos y le falta: va muy atrasado y sigue la próxima.
        aparatos.atrasados += 1;
      }
    }

    // La marca de la cuenta sigue diciendo lo de siempre: el último punto
    // archivado. Sólo avanza.
    if (latestPointAt && (!watermark || latestPointAt > watermark.lastRecordedAt)) {
      const current = await this.repos.telemetry.getWatermark(carrierAccountId);
      if (!current || latestPointAt > current.lastRecordedAt) {
        await this.repos.telemetry.setWatermark(carrierAccountId, latestPointAt);
      }
    }

    if (aparatos.fallidos.length > 0) {
      const primero = aparatos.fallidos[0]!;
      base.error =
        `${aparatos.fallidos.length} aparato(s) sin leer; se retoman en la corrida siguiente. ` +
        `Primero: ${primero.imei}: ${primero.error}`;
    }
    return base;
  }
}
