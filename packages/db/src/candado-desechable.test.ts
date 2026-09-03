import { describe, it, expect } from "vitest";
import { identidadDeBase, mismaBase, revisarDesechable } from "./candado-desechable.js";

/*
 * Un candado sin prueba es un comentario con otro nombre. Éstas son las formas
 * concretas en que alguien puede apuntar un guion de siembra a producción, cada
 * una con la suya.
 */

const PROD = "postgresql://dueno:secreto@ep-prod-111.us-east-2.aws.neon.tech/neondb?sslmode=require";
const PROD_AGRUPADA =
  "postgresql://dueno:secreto@ep-prod-111-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
const PROD_OTRO_USUARIO =
  "postgresql://jtel_readonly:otra@ep-prod-111.us-east-2.aws.neon.tech/neondb";
const DESECHABLE =
  "postgresql://dueno:secreto@ep-desechable-222.us-east-2.aws.neon.tech/neondb?sslmode=require";

const soloProd = [{ nombre: "DATABASE_URL (dueño de producción)", url: PROD }];

describe("la identidad de una base", () => {
  it("le quita el sufijo -pooler al host: es la misma base por otra puerta", () => {
    expect(identidadDeBase(PROD_AGRUPADA)!.host).toBe("ep-prod-111.us-east-2.aws.neon.tech");
    expect(mismaBase(identidadDeBase(PROD)!, identidadDeBase(PROD_AGRUPADA)!)).toBe(true);
  });

  it("ignora usuario y contraseña: la base es la misma aunque entre otro", () => {
    expect(mismaBase(identidadDeBase(PROD)!, identidadDeBase(PROD_OTRO_USUARIO)!)).toBe(true);
  });

  it("da el puerto de Postgres cuando la URL no lo dice, para no comparar «» contra 5432", () => {
    expect(identidadDeBase(PROD)!.puerto).toBe("5432");
    expect(identidadDeBase("postgresql://u:p@host:6543/db")!.puerto).toBe("6543");
  });

  it("dos ramas distintas son bases distintas", () => {
    expect(mismaBase(identidadDeBase(PROD)!, identidadDeBase(DESECHABLE)!)).toBe(false);
  });

  it("una URL ilegible no es una identidad", () => {
    expect(identidadDeBase("no-es-una-url")).toBeNull();
    expect(identidadDeBase(undefined)).toBeNull();
  });
});

describe("el candado de siembra", () => {
  it("sin DATABASE_URL_TEST no siembra, y NO cae a DATABASE_URL", () => {
    const v = revisarDesechable({ objetivo: undefined, otras: soloProd });
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toContain("NO cae a DATABASE_URL");
  });

  it("apuntada a producción se niega, y dice contra cuál chocó", () => {
    const v = revisarDesechable({ objetivo: PROD, otras: soloProd });
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toContain("DATABASE_URL (dueño de producción)");
  });

  it("apuntada al puerto AGRUPADO de producción también se niega", () => {
    /*
     * La trampa concreta de Neon: `-pooler` hace que las dos URLs se vean
     * distintas siendo la misma base. Un candado que compare texto la deja
     * pasar, y es la forma más fácil de equivocarse copiando del panel.
     */
    const v = revisarDesechable({ objetivo: PROD_AGRUPADA, otras: soloProd });
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toContain("LA MISMA BASE");
  });

  it("apuntada a producción con OTRO usuario también se niega", () => {
    const v = revisarDesechable({
      objetivo: PROD_OTRO_USUARIO,
      otras: [{ nombre: "DATABASE_URL_READONLY (producción)", url: PROD }],
    });
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toContain("DATABASE_URL_READONLY (producción)");
  });

  it("contra la desechable de verdad sí siembra, y dice contra qué comparó", () => {
    const v = revisarDesechable({ objetivo: DESECHABLE, otras: soloProd });
    expect(v.ok).toBe(true);
    expect(v.ok && v.comparadaCon).toContain("DATABASE_URL (dueño de producción)");
  });

  it("sin nada contra qué comparar NO actúa a ciegas: exige nombrar el destino", () => {
    const v = revisarDesechable({ objetivo: DESECHABLE, otras: [] });
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toContain("--base");
  });

  it("y el nombre tiene que corresponder al destino de verdad", () => {
    const malo = revisarDesechable({
      objetivo: DESECHABLE,
      otras: [],
      confirmacion: "ep-prod-111",
    });
    expect(malo.ok).toBe(false);

    const bueno = revisarDesechable({
      objetivo: DESECHABLE,
      otras: [],
      confirmacion: "ep-desechable-222",
    });
    expect(bueno.ok).toBe(true);
  });

  it("una conexión vacía en el ambiente no cuenta como comparación hecha", () => {
    /*
     * Si `DATABASE_URL` está declarada pero vacía, el candado se quedaría
     * «comparando» contra nada y creyendo que comprobó algo. Ahí tiene que
     * caer en el camino ciego y pedir el nombre, no dar el paso.
     */
    const v = revisarDesechable({
      objetivo: DESECHABLE,
      otras: [{ nombre: "DATABASE_URL", url: "" }],
    });
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toContain("--base");
  });
});
