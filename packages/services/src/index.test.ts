import { describe, it, expect } from "vitest";
import { VerificationService } from "./verification.js";

describe("VerificationService", () => {
  it("expone processPending e ingestEvidenceForOccurrence", () => {
    const service = new VerificationService({} as never, {
      umbrellaBaseUrl: "http://example.com",
    });
    expect(typeof service.processPending).toBe("function");
    expect(typeof service.ingestEvidenceForOccurrence).toBe("function");
    expect(typeof service.verifyOccurrence).toBe("function");
  });
});
