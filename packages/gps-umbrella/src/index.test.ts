import { describe, it, expect, beforeEach } from "vitest";
import {
  createUmbrellaProvider,
  fullJitterDelayMs,
  parseRetryAfterMs,
  _resetRateLimitForTests,
  acquireToken,
} from "./index.js";

describe("UmbrellaGpsProvider", () => {
  it("crea proveedor con nombre umbrella", () => {
    const provider = createUmbrellaProvider({
      baseUrl: "http://gps2.umbrellasoluciones.com",
      credentials: { userId: "u", password: "p" },
    });
    expect(provider.name).toBe("umbrella");
  });
});

describe("rate-limit helpers", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it("parseRetryAfterMs seconds and date", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
    expect(parseRetryAfterMs(null)).toBeNull();
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfterMs(future);
    expect(ms).toBeGreaterThan(1000);
    expect(ms).toBeLessThan(8000);
  });

  it("fullJitterDelayMs stays within cap", () => {
    for (let i = 0; i < 20; i++) {
      const d = fullJitterDelayMs(10, { baseMs: 1000, capMs: 5000 });
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(5000);
    }
  });

  it("acquireToken resolves under capacity", async () => {
    const t0 = Date.now();
    await acquireToken("test-bucket", { capacity: 2, refillPerMinute: 60 });
    await acquireToken("test-bucket", { capacity: 2, refillPerMinute: 60 });
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
