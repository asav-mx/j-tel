import { describe, expect, it } from "vitest";
import { asignarUnidadACircuito, soltarUnidadDeCircuito } from "./acciones-circuito.js";

/*
 * Las acciones del carrier sobre un circuito, con repos falsos. El muro de
 * verdad —las cerraduras en SQL— lo mide la matriz sembrada de
 * `packages/db/src/asignacion-carrier.integration.test.ts`; aquí se prueba el
 * orden de las decisiones: qué procede, qué se pregunta antes y qué se escribe.
 */

type Asignable = {
  unitId: string;
  label: string;
  carrierAccountId: string;
  ocupadaEnCircuitoId: string | null;
  ocupadaEnCircuito: string | null;
};

function repos(
  universo: Asignable[],
  opciones: { choque?: boolean; soltarResponde?: unknown } = {},
) {
  const escrituras: Array<[string, ...unknown[]]> = [];
  const r = {
    circuits: {
      // El universo YA viene filtrado por las dos cerraduras (la matriz lo mide).
      listUnidadesAsignablesDelCarrier: async (carrier: string, _circuito: string) =>
        universo.filter((u) => u.carrierAccountId === carrier),
      getCircuit: async (id: string) => ({ id, name: id === "c-oasis" ? "Oasis" : id }),
      assignUnit: async (datos: { circuitId: string; unitId: string }) => {
        if (opciones.choque) throw Object.assign(new Error("duplicate key"), { code: "23505" });
        escrituras.push(["asignar", datos]);
        const antes = universo.find((u) => u.unitId === datos.unitId)?.ocupadaEnCircuitoId ?? null;
        return {
          abierta: { id: "a-nueva", validFrom: new Date() },
          cerrada: antes ? { id: "a-vieja", circuitId: antes } : null,
        };
      },
      soltarAsignacionDeCuenta: async (...args: unknown[]) => {
        escrituras.push(["soltar", ...args]);
        return opciones.soltarResponde === undefined ? { unitId: "u-2120" } : opciones.soltarResponde;
      },
      endAssignment: async () => {
        throw new Error("el carrier nunca suelta por endAssignment");
      },
    },
  };
  return { repos: r as never, escrituras };
}

const FLOTA: Asignable[] = [
  { unitId: "u-2120", label: "2120", carrierAccountId: "jb", ocupadaEnCircuitoId: null, ocupadaEnCircuito: null },
  { unitId: "u-2121", label: "2121", carrierAccountId: "jb", ocupadaEnCircuitoId: "c-otra", ocupadaEnCircuito: "Centro" },
  { unitId: "u-2122", label: "2122", carrierAccountId: "jb", ocupadaEnCircuitoId: "c-oasis", ocupadaEnCircuito: "Oasis" },
  { unitId: "u-ajena", label: "900", carrierAccountId: "otro", ocupadaEnCircuitoId: null, ocupadaEnCircuito: null },
];

const base = { carrierId: "jb", circuitId: "c-oasis", por: "user_1" };

describe("asignarUnidadACircuito", () => {
  it("asigna una unidad libre suya, firmada por quien actúa, con la cuenta sacada de la unidad", async () => {
    const f = repos(FLOTA);
    const r = await asignarUnidadACircuito(f.repos, { ...base, unitId: "u-2120", confirmaCierreDe: null });
    expect(r).toMatchObject({ ok: true, unidad: "2120", cerroEn: null });
    expect(f.escrituras).toEqual([
      [
        "asignar",
        {
          circuitId: "c-oasis",
          unitId: "u-2120",
          carrierAccountId: "jb",
          motivoDelCierre: "Reasignada a Oasis",
          actorId: "user_1",
        },
      ],
    ]);
  });

  it("una unidad de otro carrier responde igual que una que no existe, y no escribe", async () => {
    for (const unitId of ["u-ajena", "u-inventada"]) {
      const f = repos(FLOTA);
      const r = await asignarUnidadACircuito(f.repos, { ...base, unitId, confirmaCierreDe: null });
      expect(r).toMatchObject({ ok: false, error: "unidad_no_asignable" });
      expect(f.escrituras).toEqual([]);
    }
  });

  it("no la jala de otro circuito sin que el formulario confirme CUÁL se cierra", async () => {
    const f = repos(FLOTA);
    const r = await asignarUnidadACircuito(f.repos, { ...base, unitId: "u-2121", confirmaCierreDe: null });
    expect(r).toMatchObject({ ok: false, error: "falta_confirmar" });
    expect(f.escrituras).toEqual([]);
  });

  it("si la unidad se movió a un tercero entre ver y confirmar, vuelve a preguntar", async () => {
    const f = repos(FLOTA);
    const r = await asignarUnidadACircuito(f.repos, { ...base, unitId: "u-2121", confirmaCierreDe: "c-vieja" });
    expect(r).toMatchObject({ ok: false, error: "falta_confirmar" });
    expect(f.escrituras).toEqual([]);
  });

  it("con la confirmación del circuito correcto la jala, y dice cuál cerró", async () => {
    const f = repos(FLOTA);
    const r = await asignarUnidadACircuito(f.repos, { ...base, unitId: "u-2121", confirmaCierreDe: "c-otra" });
    expect(r).toMatchObject({ ok: true, cerroEn: { circuitoId: "c-otra", nombre: "Centro" } });
    expect(f.escrituras).toHaveLength(1);
  });

  it("una unidad que ya corre este circuito no se reasigna encima", async () => {
    const f = repos(FLOTA);
    const r = await asignarUnidadACircuito(f.repos, { ...base, unitId: "u-2122", confirmaCierreDe: "c-oasis" });
    expect(r).toMatchObject({ ok: false, error: "ya_corre_aqui" });
    expect(f.escrituras).toEqual([]);
  });

  it("el candado de una-sola-vigente se traduce a palabras, no a un 500", async () => {
    const f = repos(FLOTA, { choque: true });
    const r = await asignarUnidadACircuito(f.repos, { ...base, unitId: "u-2120", confirmaCierreDe: null });
    expect(r).toMatchObject({ ok: false, error: "cambio_simultaneo" });
  });
});

describe("soltarUnidadDeCircuito", () => {
  it("sin motivo no suelta", async () => {
    const f = repos(FLOTA);
    const r = await soltarUnidadDeCircuito(f.repos, { ...base, assignmentId: "a-1", motivo: "   " });
    expect(r).toMatchObject({ ok: false, error: "motivo_vacio" });
    expect(f.escrituras).toEqual([]);
  });

  it("suelta por la puerta con muro, con cuenta, circuito, motivo limpio y autor", async () => {
    const f = repos(FLOTA);
    const r = await soltarUnidadDeCircuito(f.repos, { ...base, assignmentId: "a-1", motivo: " entró  a taller " });
    expect(r).toMatchObject({ ok: true, unidadId: "u-2120" });
    expect(f.escrituras).toEqual([["soltar", "jb", "c-oasis", "a-1", "entró a taller", "user_1"]]);
  });

  it("una asignación ajena o ya cerrada responde igual: no existe para esta cuenta", async () => {
    const f = repos(FLOTA, { soltarResponde: null });
    const r = await soltarUnidadDeCircuito(f.repos, { ...base, assignmentId: "a-del-otro", motivo: "x" });
    expect(r).toMatchObject({ ok: false, error: "asignacion_no_encontrada" });
  });
});
