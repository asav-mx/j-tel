/**
 * Token bucket compartido + backoff con full jitter (Fase 5).
 * Umbrella ~10 req/min → apuntamos a ~8/min efectivas.
 */

const DEFAULT_CAPACITY = 8;
const DEFAULT_REFILL_PER_MS = 8 / 60_000;

/**
 * Cuántos pedidos pueden estar formados antes de que el balde empiece a decir
 * que no.
 *
 * POR QUÉ HAY UN TOPE. El balde vive a nivel de módulo, así que su cola
 * SOBREVIVE a la invocación que la llenó: en un proceso caliente de Vercel la
 * comparten todas las corridas del cron. Y cada `resolve` formado retiene la
 * continuación completa de la verificación que lo pidió —sus puntos, sus
 * unidades, su cierre entero—, no un puntero suelto.
 *
 * Mientras entren más pedidos por minuto de los que el balde entrega (8), la
 * cola crece sin techo y el proceso se queda sin memoria. Pasó: el 3 de agosto
 * de 2026, `/api/cron/verify` murió cuatro veces con el montón en ~1.7 GB,
 * después de 20, 26 y 47 minutos de vida del proceso. No fue una lectura
 * grande — fue acumulación.
 *
 * 240 = media hora de trabajo formado a 8 por minuto. Más allá de eso, la
 * respuesta honesta ya no es "espera": es "no puedo".
 */
const MAX_EN_COLA = 240;

/** Lo que se lanza cuando el balde ya no acepta más. Se distingue a propósito. */
export class ColaDeGpsLlenaError extends Error {
  readonly enCola: number;
  constructor(clave: string, enCola: number) {
    super(
      `Cola de peticiones a GPS llena (${clave}): ${enCola} pedidos formados. ` +
        `Se rechaza en vez de encolar — una cola sin tope se come la memoria del proceso.`,
    );
    this.name = "ColaDeGpsLlenaError";
    this.enCola = enCola;
  }
}

type BucketState = {
  tokens: number;
  updatedAt: number;
  capacity: number;
  refillPerMs: number;
  queue: Array<() => void>;
  draining: boolean;
};

const buckets = new Map<string, BucketState>();

function getBucket(
  key: string,
  capacity = DEFAULT_CAPACITY,
  refillPerMs = DEFAULT_REFILL_PER_MS,
): BucketState {
  let b = buckets.get(key);
  if (!b) {
    b = {
      tokens: capacity,
      updatedAt: Date.now(),
      capacity,
      refillPerMs,
      queue: [],
      draining: false,
    };
    buckets.set(key, b);
  }
  return b;
}

function refill(b: BucketState, now = Date.now()) {
  const elapsed = Math.max(0, now - b.updatedAt);
  b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillPerMs);
  b.updatedAt = now;
}

function pump(b: BucketState) {
  if (b.draining) return;
  b.draining = true;
  const tick = () => {
    refill(b);
    while (b.queue.length > 0 && b.tokens >= 1) {
      b.tokens -= 1;
      const next = b.queue.shift();
      next?.();
    }
    if (b.queue.length === 0) {
      b.draining = false;
      return;
    }
    const need = 1 - b.tokens;
    const waitMs = Math.max(20, Math.ceil(need / b.refillPerMs));
    setTimeout(tick, waitMs);
  };
  tick();
}

/**
 * Espera un token del bucket (proceso-wide por clave).
 *
 * Rechaza con `ColaDeGpsLlenaError` si ya hay demasiados pedidos formados. Eso
 * es deliberado: quien llama lo traduce a "evidencia indisponible", que es la
 * verdad —no pudimos observar—, mientras que seguir encolando termina en un
 * proceso muerto que no deja ni esa respuesta.
 */
export function acquireToken(
  key = "umbrella",
  opts?: { capacity?: number; refillPerMinute?: number; maxEnCola?: number },
): Promise<void> {
  const capacity = opts?.capacity ?? DEFAULT_CAPACITY;
  const refillPerMs =
    opts?.refillPerMinute != null ? opts.refillPerMinute / 60_000 : DEFAULT_REFILL_PER_MS;
  const maxEnCola = opts?.maxEnCola ?? MAX_EN_COLA;
  const b = getBucket(key, capacity, refillPerMs);
  b.capacity = capacity;
  b.refillPerMs = refillPerMs;

  if (b.queue.length >= maxEnCola) {
    return Promise.reject(new ColaDeGpsLlenaError(key, b.queue.length));
  }

  return new Promise((resolve) => {
    b.queue.push(resolve);
    pump(b);
  });
}

/** Cuántos pedidos hay formados ahora mismo. Para diagnóstico y pruebas. */
export function pedidosEnCola(key = "umbrella"): number {
  return buckets.get(key)?.queue.length ?? 0;
}

/** Full jitter: random(0, min(cap, base * 2^attempt)). */
export function fullJitterDelayMs(
  attempt: number,
  opts?: { baseMs?: number; capMs?: number },
): number {
  const base = opts?.baseMs ?? 1000;
  const cap = opts?.capMs ?? 60_000;
  const exp = Math.min(cap, base * 2 ** Math.max(0, attempt));
  return Math.floor(Math.random() * (exp + 1));
}

export function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const asInt = Number(header);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt * 1000;
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

/** Solo tests. */
export function _resetRateLimitForTests() {
  buckets.clear();
}
