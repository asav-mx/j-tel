import { describe, expect, it } from "vitest";
import { isOperationalHours } from "./ingest-health.js";

describe("isOperationalHours", () => {
  it("rejects Sunday morning", () => {
    // 2026-07-12 is Sunday
    const sun = new Date("2026-07-12T14:00:00Z");
    expect(isOperationalHours(sun)).toBe(false);
  });

  it("accepts weekday midday Juarez", () => {
    // 2026-07-10 Friday 18:00 UTC = 12:00 Juarez (UTC-6)
    const fri = new Date("2026-07-10T18:00:00Z");
    expect(isOperationalHours(fri)).toBe(true);
  });

  it("rejects weekday night", () => {
    // 2026-07-10 Friday 06:00 UTC = 00:00 Juarez
    const night = new Date("2026-07-10T06:00:00Z");
    expect(isOperationalHours(night)).toBe(false);
  });
});
