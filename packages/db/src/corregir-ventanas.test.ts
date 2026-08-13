/**
 * Lo que vigilan, y el orden es el del daño si fallan:
 *
 *   1. Que **una fila bloqueada nunca entre al SQL**. La guarda que importa es
 *      la de los puntos anclados: ensanchar la ventana de un viaje que ya tiene
 *      evidencia adentro empeora su cobertura —se mide más tiempo contra los
 *      mismos puntos—, y eso fabrica justo las acusaciones que la corrección
 *      existe para evitar.
 *   2. Que las guardas viajen **dentro del `WHERE`**, no solo en el plan: entre
 *      generar el SQL y pegarlo pueden pasar horas.
 *   3. Que `--solo-ensanchan` deje fuera de verdad las que se angostarían.
 *   4. Que la verificación pida **los tres números**. `sin_mover = 0` da 0 igual
 *      si todo se movió que si el JOIN no encontró nada.
 */
import { describe, it, expect } from "vitest";
import { generarSql, type FilaDeVentana } from "./corregir-ventanas.js";

const BASE: FilaDeVentana = {
  ocurrenciaId: "11111111-1111-1111-1111-111111111111",
  contratoId: "22222222-2222-2222-2222-222222222222",
  contratoNombre: "Contrato de ejemplo",
  clienteNombre: "Cliente de ejemplo",
  routeShiftId: "33333333-3333-3333-3333-333333333333",
  rutaNombre: "Ruta de ejemplo",
  turnoNombre: "Turno A",
  serviceDate: "2026-08-27",
  congeladaMinutos: 60,
  derivadaMinutos: 93,
  difMinutos: 33,
  baseHoy: "medida",
  muestras: 12,
  ventanaHoy: {
    inicio: new Date("2026-08-27T10:25:00Z"),
    fin: new Date("2026-08-27T12:35:00Z"),
  },
  tripId: "44444444-4444-4444-4444-444444444444",
  bloqueo: null,
};

const conBloqueo = (bloqueo: string, id: string): FilaDeVentana => ({
  ...BASE,
  tripId: id,
  bloqueo,
});

describe("lo bloqueado no se toca", () => {
  it("un viaje con puntos anclados no aparece en el SQL", () => {
    const sql = generarSql([
      BASE,
      conBloqueo("tiene puntos de evidencia anclados", "55555555-5555-5555-5555-555555555555"),
    ]);
    expect(sql).toContain("44444444-4444-4444-4444-444444444444");
    expect(sql).not.toContain("55555555-5555-5555-5555-555555555555");
  });

  it("si TODO está bloqueado, no emite un UPDATE vacío", () => {
    const sql = generarSql([conBloqueo("viaje en 'cerrado'", BASE.tripId!)]);
    expect(sql).not.toContain("UPDATE");
    expect(sql).toContain("No hay ninguna ventana");
  });

  it("dice cuántas quedaron fuera — callarlas se lee como si no existieran", () => {
    const sql = generarSql([BASE, conBloqueo("no tiene viaje", "66666666-6666-6666-6666-666666666666")]);
    expect(sql).toContain("Bloqueados, NO se tocan: 1");
  });
});

describe("las guardas viajan dentro del WHERE", () => {
  const sql = generarSql([BASE]);

  it("exige que el viaje siga en espera", () => {
    expect(sql).toContain("t.evidence_status = 'en_espera'");
  });

  it("exige que no haya puntos anclados en el momento de correr", () => {
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM evidence_points ep WHERE ep.trip_id = t.id)");
  });

  it("exige que la ocurrencia siga sin sellar", () => {
    expect(sql).toContain("FROM compliance_facts cf");
  });

  it("va en transacción y no cierra con COMMIT a ciegas", () => {
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("-- ROLLBACK;");
  });
});

describe("--solo-ensanchan", () => {
  const angosta: FilaDeVentana = {
    ...BASE,
    tripId: "77777777-7777-7777-7777-777777777777",
    congeladaMinutos: 120,
    derivadaMinutos: 75,
    difMinutos: -45,
  };

  it("por omisión mueve las dos direcciones", () => {
    const sql = generarSql([BASE, angosta]);
    expect(sql).toContain("77777777-7777-7777-7777-777777777777");
  });

  it("con la bandera deja fuera las que se angostarían, y lo dice", () => {
    const sql = generarSql([BASE, angosta], { soloEnsanchan: true });
    expect(sql).not.toContain("77777777-7777-7777-7777-777777777777");
    expect(sql).toContain("1 que se ANGOSTARÍAN quedaron fuera");
  });
});

describe("la verificación no acepta un cero ciego", () => {
  it("pide los tres números, no solo el de los errores", () => {
    const sql = generarSql([BASE]);
    expect(sql).toContain("AS encontrados");
    expect(sql).toContain("AS con_la_nueva");
    expect(sql).toContain("AS sin_mover");
  });

  it("deja escrito qué se espera de cada uno", () => {
    const sql = generarSql([BASE, { ...BASE, tripId: "88888888-8888-8888-8888-888888888888" }]);
    expect(sql).toContain("encontrados  = 2");
    expect(sql).toContain("con_la_nueva = 2");
  });
});
