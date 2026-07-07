import { describe, it, expect } from "vitest";
import { createUmbrellaProvider } from "./index.js";

describe("UmbrellaGpsProvider", () => {
  it("crea proveedor con nombre umbrella", () => {
    const provider = createUmbrellaProvider({
      baseUrl: "http://gps2.umbrellasoluciones.com",
      credentials: { userId: "u", password: "p" },
    });
    expect(provider.name).toBe("umbrella");
  });
});
