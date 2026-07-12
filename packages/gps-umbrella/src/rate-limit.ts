/**
 * Token bucket compartido + backoff con full jitter (Fase 5).
 * Umbrella ~10 req/min → apuntamos a ~8/min efectivas.
 */

const DEFAULT_CAPACITY = 8;
const DEFAULT_REFILL_PER_MS = 8 / 60_000;

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

/** Espera un token del bucket (proceso-wide por clave). */
export function acquireToken(
  key = "umbrella",
  opts?: { capacity?: number; refillPerMinute?: number },
): Promise<void> {
  const capacity = opts?.capacity ?? DEFAULT_CAPACITY;
  const refillPerMs =
    opts?.refillPerMinute != null ? opts.refillPerMinute / 60_000 : DEFAULT_REFILL_PER_MS;
  const b = getBucket(key, capacity, refillPerMs);
  b.capacity = capacity;
  b.refillPerMs = refillPerMs;

  return new Promise((resolve) => {
    b.queue.push(resolve);
    pump(b);
  });
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
