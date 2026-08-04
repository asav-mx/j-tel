import { describe, it, expect } from "vitest";
import { generarSql, type PlanDeVinculo } from "./vincular-identidades.js";

const CUENTA = "22222222-2222-2222-2222-222222222222";
const PLANTA = "33333333-3333-3333-3333-333333333333";

function plan(faltan: PlanDeVinculo["faltan"]): PlanDeVinculo[] {
  return [
    {
      vinculo: { desde: "jstaff_admin", hacia: "user_2abc", nota: "Asav" },
      faltan,
      yaExistian: 0,
      origenVacio: false,
    },
  ];
}

/*
 * Este SQL se pega en la consola de Neon contra producción. Lo que se prueba
 * aquí es exactamente lo que decide si esa corrida es segura.
 */
describe("el SQL para la consola", () => {
  it("envuelve todo en una transacción sin confirmarla sola", () => {
    const sql = generarSql(plan([]));
    expect(sql).toContain("BEGIN;");
    // El COMMIT va comentado a propósito: lo teclea quien revisó el resultado.
    expect(sql).toContain("-- COMMIT;");
    expect(sql).not.toMatch(/^COMMIT;/m);
  });

  it("no genera ningún INSERT cuando no falta nada", () => {
    expect(generarSql(plan([]))).not.toContain("INSERT INTO");
  });

  /*
   * La guarda que hace la corrida idempotente. Sin `IS NOT DISTINCT FROM`, un
   * `scope_id` nulo nunca empareja consigo mismo —en Postgres NULL = NULL es
   * NULL, no true— y el INSERT se repetiría en cada corrida. Es la misma razón
   * por la que el índice único tampoco protege esa fila.
   */
  it("empareja el alcance nulo con IS NOT DISTINCT FROM, no con =", () => {
    const sql = generarSql(
      plan([{ accountId: CUENTA, role: "admin_plataforma", scopeType: "global" }]),
    );
    expect(sql).toContain("scope_id IS NOT DISTINCT FROM NULL");
    expect(sql).not.toContain("scope_id = NULL");
  });

  it("inserta solo si la fila no existe todavía", () => {
    const sql = generarSql(
      plan([{ accountId: CUENTA, role: "admin_plataforma", scopeType: "global" }]),
    );
    expect(sql).toContain("INSERT INTO user_memberships");
    expect(sql).toContain("WHERE NOT EXISTS (");
  });

  it("escribe el alcance con su id cuando lo tiene", () => {
    const sql = generarSql(
      plan([
        { accountId: CUENTA, role: "usuario_planta", scopeType: "plant", scopeId: PLANTA },
      ]),
    );
    expect(sql).toContain(`'${PLANTA}'`);
    expect(sql).toContain("scope_id IS NOT DISTINCT FROM '" + PLANTA + "'");
  });

  it("nunca escribe UPDATE ni DELETE — este script solo suma", () => {
    const sql = generarSql(
      plan([
        { accountId: CUENTA, role: "admin_plataforma", scopeType: "global" },
        { accountId: CUENTA, role: "usuario_planta", scopeType: "plant", scopeId: PLANTA },
      ]),
    );
    expect(sql).not.toMatch(/\bUPDATE\b/);
    expect(sql).not.toMatch(/\bDELETE\b/);
  });

  it("escapa las comillas simples en vez de dejarlas romper la sentencia", () => {
    const sql = generarSql(
      plan([{ accountId: "a'b", role: "admin_plataforma", scopeType: "global" }]),
    );
    expect(sql).toContain("'a''b'");
  });

  it("marca el tipo del enum de alcance", () => {
    const sql = generarSql(
      plan([{ accountId: CUENTA, role: "admin_plataforma", scopeType: "global" }]),
    );
    expect(sql).toContain("'global'::scope_type");
  });
});
