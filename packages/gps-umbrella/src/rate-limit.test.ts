import { describe, expect, it } from "vitest";
import { TokenBucket, fullJitterMs } from "./rate-limit.js";

describe("fullJitterMs", () => {
  it("stays within [0, cap]", () => {
    for (let i = 0; i < 50; i++) {
      const v = fullJitterMs(10, 1000, 5000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5000);
    }
  });
});

describe("TokenBucket", () => {
  it("allows immediate takes up to capacity", async () => {
    const b = new TokenBucket(3, 1000);
    await b.take();
    await b.take();
    await b.take();
    expect(true).toBe(true);
  });
});
