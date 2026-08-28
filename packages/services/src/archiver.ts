import type { Repositories } from "@jtel/db";
import {
  getProviderForCarrier,
  type GpsBackendConfig,
  type GpsProviderInstance,
} from "./providers.js";

export interface ArchiverOptions {
  /** Minutos hacia atrás la primera vez que se archiva un carrier (sin watermark). */
  firstRunLookbackMinutes?: number;
  /** Minutos de traslape antes del watermark, para no perder puntos en el borde. */
  overlapMinutes?: number;
  /** Horas máximas por trozo (Umbrella + muchos IMEIs no aguanta ventanas enormes). */
  chunkHours?: number;
  /** Cuántos trozos procesar por corrida (cron). */
  maxChunksPerRun?: number;
  /** IMEIs por lote dentro de cada trozo. */
  imeiBatchSize?: number;
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

export class ArchiverService {
  private firstRunLookbackMinutes: number;
  private overlapMinutes: number;
  private chunkHours: number;
  private maxChunksPerRun: number;
  private imeiBatchSize: number;

  constructor(
    private repos: Repositories,
    private config: GpsBackendConfig,
    options: ArchiverOptions = {},
  ) {
    this.firstRunLookbackMinutes = options.firstRunLookbackMinutes ?? 60;
    this.overlapMinutes = options.overlapMinutes ?? 5;
    this.chunkHours = options.chunkHours ?? 1;
    this.maxChunksPerRun = options.maxChunksPerRun ?? 12;
    this.imeiBatchSize = options.imeiBatchSize ?? 5;
  }

  async archiveAll(now = new Date()): Promise<{
    carriers: CarrierArchiveResult[];
    totalSaved: number;
  }> {
    const carriers = await this.repos.accounts.listByType("carrier");
    const results: CarrierArchiveResult[] = [];

    for (const carrier of carriers) {
      try {
        results.push(await this.archiveCarrier(carrier.id, carrier.name, now));
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

  private async archiveCarrier(
    carrierAccountId: string,
    carrierName: string,
    now: Date,
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

    const creds = await this.repos.carriers.getGpsCredentials(carrierAccountId);
    if (!creds) return { ...base, skipped: "sin credenciales GPS" };

    const devices = await this.repos.fleet.getDevicesForCarrier(carrierAccountId);
    const imeis = devices.map((d) => d.imei).filter(Boolean);
    if (imeis.length === 0) return { ...base, skipped: "sin dispositivos" };

    const imeiToDevice = new Map(devices.map((d) => [d.imei, d]));
    const watermark = await this.repos.telemetry.getWatermark(carrierAccountId);
    let cursor = watermark
      ? new Date(watermark.lastRecordedAt.getTime() - this.overlapMinutes * 60_000)
      : new Date(now.getTime() - this.firstRunLookbackMinutes * 60_000);

    base.imeis = imeis.length;
    base.from = cursor.toISOString();
    if (cursor >= now) return { ...base, skipped: "sin ventana nueva" };

    const provider: GpsProviderInstance = await getProviderForCarrier(
      this.repos,
      this.config,
      carrierAccountId,
    );
    const token = await provider.login();
    const chunkMs = this.chunkHours * 60 * 60_000;
    let chunks = 0;
    let latestPointAt: Date | null = watermark?.lastRecordedAt ?? null;

    while (cursor < now && chunks < this.maxChunksPerRun) {
      const chunkEnd = new Date(Math.min(cursor.getTime() + chunkMs, now.getTime()));
      if (chunkEnd <= cursor) break;

      for (let i = 0; i < imeis.length; i += this.imeiBatchSize) {
        const batch = imeis.slice(i, i + this.imeiBatchSize);
        let points;
        try {
          points = await provider.getHistoryLocations(token, {
            imeis: batch,
            beginGmt: cursor,
            endGmt: chunkEnd,
          });
        } catch (err) {
          // Guardamos lo ya avanzado y salimos: la siguiente corrida continúa.
          const message = err instanceof Error ? err.message : String(err);
          base.error = message;
          base.chunks = chunks;
          base.to = cursor.toISOString();
          if (/429|503|quota|exceeded|too many/i.test(message)) {
            const d = detalleDelError(err);
            try {
              await this.repos.ingestAlerts.create({
                carrierAccountId,
                kind: "rate_limit",
                severity: "warning",
                message: `Rate limit en archivo: ${d.resumen}`,
                metadata: {
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
          return base;
        }
        base.fetched += points.length;
        if (points.length === 0) continue;

        const resolved = await Promise.all(
          points.map(async (p) => {
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

        for (const p of points) {
          if (!latestPointAt || p.timestamp > latestPointAt) latestPointAt = p.timestamp;
        }
        // Avanzar watermark por lote: si la corrida se corta a mitad, no perdemos progreso.
        if (latestPointAt) {
          const current = await this.repos.telemetry.getWatermark(carrierAccountId);
          if (!current || latestPointAt > current.lastRecordedAt) {
            await this.repos.telemetry.setWatermark(carrierAccountId, latestPointAt);
          }
        }
      }

      // Trozo vacío: NO saltar watermark a chunkEnd (eso borraba huecos reales
      // y el gap-backfill no los veía). Solo avanzamos el cursor local; la
      // watermark queda en el último punto real.
      cursor = chunkEnd;
      chunks += 1;
    }

    base.chunks = chunks;
    base.to = cursor.toISOString();
    return base;
  }
}
