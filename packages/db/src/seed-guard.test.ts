import { describe, it, expect } from "vitest";
import { resolveSeedDatabaseUrl } from "./seed-guard.js";

/*
 * El candado del guion que pobló producción el 7 de julio de 2026.
 *
 * Las pruebas de la versión anterior sólo cubrían la URL IDÉNTICA. Las formas
 * reales de equivocarse son otras: la URL agrupada de Neon, otro usuario, o la
 * copia desechable de producción que alguien está usando.
 */

const PROD = "postgresql://dueno:secreto@ep-prod-111.us-east-2.aws.neon.tech/neondb?sslmode=require";
const PROD_AGRUPADA =
  "postgresql://dueno:secreto@ep-prod-111-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
const PROD_SOLO_LECTURA = "postgresql://jtel_readonly:otra@ep-prod-111.us-east-2.aws.neon.tech/neondb";
const DESECHABLE = "postgresql://dueno:secreto@ep-desechable-222.us-east-2.aws.neon.tech/neondb";
const LOCAL = "postgresql://jtel:jtel_dev@localhost:5432/jtel";

describe("resolveSeedDatabaseUrl — candado del seed", () => {
  it("se niega si SEED_DATABASE_URL no está definida, y NO cae a DATABASE_URL", () => {
    expect(() => resolveSeedDatabaseUrl({ DATABASE_URL: PROD })).toThrow(
      /SEED_DATABASE_URL no está definida/,
    );
    expect(() => resolveSeedDatabaseUrl({})).toThrow(/TRUNCATE/);
  });

  it("se niega si es la misma URL que producción", () => {
    expect(() => resolveSeedDatabaseUrl({ DATABASE_URL: PROD, SEED_DATABASE_URL: PROD })).toThrow(
      /LA MISMA BASE que DATABASE_URL/,
    );
  });

  it("el hueco que tenía: la URL AGRUPADA de producción también se niega", () => {
    // Con la comparación de texto del 27 de julio, esto pasaba y vaciaba producción.
    expect(() =>
      resolveSeedDatabaseUrl({ DATABASE_URL: PROD, SEED_DATABASE_URL: PROD_AGRUPADA }),
    ).toThrow(/LA MISMA BASE/);
  });

  it("producción con otro usuario también se niega, aunque sólo esté la de solo lectura", () => {
    expect(() =>
      resolveSeedDatabaseUrl({
        DATABASE_URL_READONLY: PROD_SOLO_LECTURA,
        SEED_DATABASE_URL: PROD,
      }),
    ).toThrow(/DATABASE_URL_READONLY/);
  });

  it("tampoco siembra en la copia desechable de producción: alguien la está usando", () => {
    expect(() =>
      resolveSeedDatabaseUrl({
        DATABASE_URL: PROD,
        DATABASE_URL_TEST: DESECHABLE,
        SEED_DATABASE_URL: DESECHABLE,
      }),
    ).toThrow(/DATABASE_URL_TEST/);
  });

  it("siembra en una base propia distinta de todas", () => {
    expect(
      resolveSeedDatabaseUrl({ DATABASE_URL: PROD, DATABASE_URL_TEST: DESECHABLE, SEED_DATABASE_URL: LOCAL }),
    ).toBe(LOCAL);
  });

  it("sin nada contra qué comparar no actúa a ciegas: exige --base, y que corresponda", () => {
    expect(() => resolveSeedDatabaseUrl({ SEED_DATABASE_URL: LOCAL })).toThrow(/--base/);
    expect(() => resolveSeedDatabaseUrl({ SEED_DATABASE_URL: LOCAL }, "ep-prod")).toThrow(
      /no aparece/,
    );
    expect(resolveSeedDatabaseUrl({ SEED_DATABASE_URL: LOCAL }, "localhost")).toBe(LOCAL);
  });

  it("ignora espacios alrededor de la URL", () => {
    expect(() =>
      resolveSeedDatabaseUrl({ DATABASE_URL: PROD, SEED_DATABASE_URL: `  ${PROD}  ` }),
    ).toThrow(/LA MISMA BASE/);
  });
});
