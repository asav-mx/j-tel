import { describe, it, expect } from "vitest";
import { generarSql, type Fila } from "./corregir-deadlines.js";

const fila = (over: Partial<Fila> = {}): Fila => ({
  occurrenceId: "11111111-1111-1111-1111-111111111111",
  contrato: "Contrato X",
  serviceDate: "2026-08-09",
  guardado: new Date("2026-08-09T06:45:00.000Z"),
  correcto: new Date("2026-08-09T12:45:00.000Z"),
  causa: "zona",
  difMinutos: 360,
  tripId: "22222222-2222-2222-2222-222222222222",
  ventana: {
    inicio: new Date("2026-08-09T11:45:00.000Z"),
    fin: new Date("2026-08-09T13:30:00.000Z"),
  },
  bloqueo: null,
  ...over,
});

describe("el SQL que se pega en la consola", () => {
  const sql = generarSql([fila()], false);

  it("lleva las guardas del deadline DENTRO del WHERE", () => {
    // No basta con que el plan fuera seguro al calcularlo: tiene que seguir
    // siéndolo cuando alguien lo corra media hora después.
    expect(sql).toContain("o.expected_deadline > now()");
    expect(sql).toContain("FROM compliance_facts cf WHERE cf.service_occurrence_id = o.id");
  });

  it("lleva las guardas del viaje DENTRO del WHERE", () => {
    expect(sql).toContain("t.evidence_status = 'en_espera'");
    expect(sql).toContain("FROM evidence_points ep WHERE ep.trip_id = t.id");
    expect(sql).toContain("cf.service_occurrence_id = t.service_occurrence_id");
  });

  it("va en transacción y deja la verificación antes del COMMIT", () => {
    expect(sql.indexOf("BEGIN;")).toBeLessThan(sql.indexOf("descuadradas"));
    expect(sql.indexOf("descuadradas")).toBeLessThan(sql.indexOf("COMMIT;"));
    expect(sql).toContain("ROLLBACK;");
  });

  it("los instantes van en UTC explícito, sin ambigüedad de zona", () => {
    expect(sql).toContain("'2026-08-09T12:45:00.000Z'::timestamptz");
    expect(sql).not.toMatch(/'\d{4}-\d{2}-\d{2} \d{2}:\d{2}/); // nada sin la Z
  });

  it("una fila por ocurrencia, en los tres bloques", () => {
    const muchas = [fila(), fila({ occurrenceId: "33333333-3333-3333-3333-333333333333" })];
    const s = generarSql(muchas, false);
    expect((s.match(/11111111-1111-1111-1111-111111111111/g) ?? []).length).toBe(2); // update + verificación
    expect(s).toContain("Ocurrencias a corregir: 2");
  });

  it("declara en el encabezado si la deriva entra o no", () => {
    expect(generarSql([fila()], false)).toContain("deriva incluida: no");
    expect(generarSql([fila({ causa: "deriva" })], true)).toContain("deriva incluida: sí");
  });

  it("una ocurrencia sin viaje no rompe el bloque de viajes", () => {
    const s = generarSql([fila(), fila({ tripId: null, ventana: null })], false);
    expect(s).toContain("BEGIN;");
    expect(s).not.toContain("null::uuid");
    expect(s).toContain("viajes_corregidos");
  });

  it("si NINGUNA tiene viaje, no emite un VALUES vacío", () => {
    // Un VALUES sin filas es SQL inválido, y esto se pega a mano en una
    // consola: tiene que salir correcto o no salir.
    const s = generarSql([fila({ tripId: null, ventana: null })], false);
    expect(s).not.toMatch(/VALUES\s*\n\s*\), aplicado/);
    expect(s).not.toContain("viajes_corregidos");
    expect(s).toContain("ninguna de estas ocurrencias tiene viaje");
  });

  it("sin nada que corregir no emite una transacción vacía", () => {
    expect(generarSql([], false)).not.toContain("BEGIN;");
  });
});
