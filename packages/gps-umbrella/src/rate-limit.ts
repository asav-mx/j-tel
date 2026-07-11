/**
 * Rate limit compartido para Umbrella (~10/min oficiales → ~8/min efectivos).
 * Full jitter (AWS): sleep = random(0, min(cap, base * 2^attempt)).
 */

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(now = Date.now()) {
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }

  /** Espera hasta poder consumir 1 token. */
  async take(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const need = 1 - this.tokens;
      const waitMs = Math.ceil(need / this.refillPerMs) + 5;
      await sleep(waitMs);
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Full jitter: random(0, min(cap, base * 2^attempt)). */
export function fullJitterMs(attempt: number, baseMs = 1000, capMs = 60_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}

/** Bucket global: 8 tokens/min (margen bajo el límite 10/min de Umbrella). */
export const umbrellaTokenBucket = new TokenBucket(8, 8 / 60_000);
