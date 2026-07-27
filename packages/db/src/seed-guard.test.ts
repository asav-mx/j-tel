import { describe, it, expect } from "vitest";
import { resolveSeedDatabaseUrl } from "./seed-guard.js";

describe("resolveSeedDatabaseUrl — candado del seed", () => {
  it("se niega si SEED_DATABASE_URL no está definida y explica por qué (TRUNCATE)", () => {
    expect(() =>
      resolveSeedDatabaseUrl({ DATABASE_URL: "postgresql://prod/neondb" }),
    ).toThrow(/SEED_DATABASE_URL no está definida/);
    // El mensaje explica la razón del candado, no solo que falta la variable.
    expect(() => resolveSeedDatabaseUrl({})).toThrow(/TRUNCATE/);
  });

  it("se niega si SEED_DATABASE_URL es idéntica a DATABASE_URL (producción)", () => {
    const url = "postgresql://neondb_owner:secret@prod-host/neondb";
    expect(() =>
      resolveSeedDatabaseUrl({ DATABASE_URL: url, SEED_DATABASE_URL: url }),
    ).toThrow(/producción/);
    expect(() =>
      resolveSeedDatabaseUrl({ DATABASE_URL: url, SEED_DATABASE_URL: url }),
    ).toThrow(/TRUNCATE/);
  });

  it("devuelve la URL de seed cuando es distinta de DATABASE_URL", () => {
    expect(
      resolveSeedDatabaseUrl({
        DATABASE_URL: "postgresql://prod/neondb",
        SEED_DATABASE_URL: "postgresql://jtel:jtel_dev@localhost:5432/jtel",
      }),
    ).toBe("postgresql://jtel:jtel_dev@localhost:5432/jtel");
  });

  it("permite sembrar cuando DATABASE_URL no está definida", () => {
    expect(
      resolveSeedDatabaseUrl({ SEED_DATABASE_URL: "postgresql://dev/db" }),
    ).toBe("postgresql://dev/db");
  });

  it("ignora espacios alrededor de las URLs al comparar", () => {
    const url = "postgresql://prod/neondb";
    expect(() =>
      resolveSeedDatabaseUrl({ DATABASE_URL: url, SEED_DATABASE_URL: `  ${url}  ` }),
    ).toThrow(/producción/);
  });
});
