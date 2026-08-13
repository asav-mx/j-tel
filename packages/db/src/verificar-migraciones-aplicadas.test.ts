/**
 * La valla de migraciones — su lectura del SQL, sin tocar ninguna base.
 *
 * La parte que habla con Postgres necesita credenciales y no corre en CI; **la
 * que decide qué se espera encontrar sí**, y es donde estuvieron los dos errores
 * reales de su construcción:
 *
 *   1. Los identificadores calificados: `"public"."evidence_status"` se leía
 *      como el objeto **`public`**, y la valla reportaba «falta tipo public»
 *      ocho veces. Ruidoso, y por eso se cachó.
 *   2. Los objetos borrados por una migración POSTERIOR: la `0000` crea
 *      `route_shift_kml_versions` y la `0003` la borra. Sin descontarlos, la
 *      valla la reportaba como faltante **en las dos bases** — un falso positivo
 *      que enseña a ignorarla, y una valla que se ignora ya no es una valla.
 */
import { describe, it, expect } from "vitest";
import { objetosDe, borradosDe, claveDe, falta } from "./verificar-migraciones-aplicadas.js";

const CATALOGO = {
  tablas: new Set(["compliance_facts"]),
  columnas: new Set(["compliance_facts.status"]),
  tipos: new Set(["evidence_status"]),
  indices: new Set(["idx_uno"]),
  triggers: new Set(["mi_trigger"]),
  funciones: new Set(["mi_funcion"]),
  valoresEnum: new Set(["evidence_status.en_espera"]),
};

describe("qué objetos crea una migración", () => {
  it("lee tablas, columnas, tipos, índices, triggers y funciones", () => {
    const o = objetosDe(`
      CREATE TABLE "cosas" ("id" uuid);
      ALTER TABLE "compliance_facts" ADD COLUMN "densidad_snapshot" jsonb;
      CREATE TYPE "mi_enum" AS ENUM ('a');
      CREATE UNIQUE INDEX "idx_dos" ON "cosas" ("id");
      CREATE TRIGGER "otro_trigger" BEFORE UPDATE ON "cosas" EXECUTE FUNCTION f();
      CREATE FUNCTION "otra_funcion"() RETURNS trigger AS $$ $$ LANGUAGE plpgsql;
    `);
    expect(o.map(claveDe)).toEqual([
      "tabla:cosas",
      "columna:compliance_facts.densidad_snapshot",
      "tipo:mi_enum",
      "indice:idx_dos",
      "trigger:otro_trigger",
      "funcion:otra_funcion",
    ]);
  });

  it("los identificadores calificados dan el objeto, no el esquema", () => {
    // El error real: esto se leía como el tipo `public`.
    const o = objetosDe(`CREATE TYPE "public"."evidence_status" AS ENUM ('x');`);
    expect(o).toEqual([{ tipo: "tipo", nombre: "evidence_status" }]);
  });

  it("lee los valores agregados a un enum", () => {
    const o = objetosDe(
      `ALTER TYPE "evidence_status" ADD VALUE IF NOT EXISTS 'sin_evidencia_posible';`,
    );
    expect(o).toEqual([
      { tipo: "valor_enum", tipo_enum: "evidence_status", nombre: "sin_evidencia_posible" },
    ]);
  });

  it("IGNORA el SQL que vive en los comentarios", () => {
    /*
     * Los encabezados de este repo traen la verificación como SQL comentado.
     * Contarlo daría objetos que la migración no crea — y la valla pediría
     * columnas que nadie prometió.
     */
    const o = objetosDe(`
      --   SELECT * FROM x;
      --   ALTER TABLE "otra" ADD COLUMN "fantasma" jsonb;
      ALTER TABLE "compliance_facts" ADD COLUMN "real" jsonb;
    `);
    expect(o).toEqual([{ tipo: "columna", tabla: "compliance_facts", nombre: "real" }]);
  });

  it("una migración que solo mueve datos no crea objetos", () => {
    expect(objetosDe(`UPDATE contratos SET policy = '{}'::jsonb;`)).toEqual([]);
  });
});

describe("qué borra una migración — para no pedirlo después", () => {
  it("lee DROP TABLE, DROP COLUMN, DROP INDEX y DROP TYPE", () => {
    const b = borradosDe(`
      DROP TABLE "route_shift_kml_versions";
      ALTER TABLE "x" DROP COLUMN IF EXISTS "vieja";
      DROP INDEX IF EXISTS "idx_viejo";
      DROP TYPE "enum_viejo";
    `);
    expect(b.map(claveDe)).toEqual([
      "tabla:route_shift_kml_versions",
      "columna:x.vieja",
      "indice:idx_viejo",
      "tipo:enum_viejo",
    ]);
  });

  it("la clave de un borrado casa con la del objeto creado", () => {
    // Es lo que permite descontarlos: si las claves no casaran, el descuento
    // no haría nada y el falso positivo volvería sin avisar.
    const creado = objetosDe(`CREATE TABLE "route_shift_kml_versions" ("id" uuid);`)[0]!;
    const borrado = borradosDe(`DROP TABLE "route_shift_kml_versions";`)[0]!;
    expect(claveDe(creado)).toBe(claveDe(borrado));
  });
});

describe("qué cuenta como faltante", () => {
  it("un objeto que está no falta; uno que no está, sí", () => {
    expect(falta({ tipo: "tabla", nombre: "compliance_facts" }, CATALOGO)).toBe(false);
    expect(falta({ tipo: "tabla", nombre: "no_existe" }, CATALOGO)).toBe(true);
  });

  it("una columna se busca en SU tabla, no por nombre suelto", () => {
    expect(
      falta({ tipo: "columna", tabla: "compliance_facts", nombre: "status" }, CATALOGO),
    ).toBe(false);
    // El mismo nombre en otra tabla no cuenta como presente.
    expect(falta({ tipo: "columna", tabla: "otra", nombre: "status" }, CATALOGO)).toBe(true);
  });

  it("un valor de enum se busca dentro de su tipo", () => {
    expect(
      falta(
        { tipo: "valor_enum", tipo_enum: "evidence_status", nombre: "en_espera" },
        CATALOGO,
      ),
    ).toBe(false);
    expect(
      falta({ tipo: "valor_enum", tipo_enum: "evidence_status", nombre: "otro" }, CATALOGO),
    ).toBe(true);
  });
});
