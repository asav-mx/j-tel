import { describe, expect, it } from "vitest";
import { serviciosDeUnidadEnDia } from "./servicios-de-unidad.js";

const juarez = (iso: string) => new Date(`${iso}-06:00`);

function repos(opciones: {
  ligado?: boolean;
  especiales?: Array<{ cliente: string; ruta: string; ventanaDesde: Date; ventanaHasta: Date }>;
  circuitos?: Array<{ circuitoId: string; nombre: string; inicioLocal: string; finLocal: string; zona: string }>;
} = {}) {
  const pedidos: string[] = [];
  const r = {
    fleet: { getUnitsForCarrier: async () => [{ id: "u1", label: "10254" }] },
    expedientes: {
      ligadoAServiciosDeclarados: async () => opciones.ligado ?? true,
      especialesDeUnidadQueEmpiezanEntre: async (_c: string, _u: string, desde: Date, hasta: Date) => {
        pedidos.push(`${desde.toISOString()}→${hasta.toISOString()}`);
        return (opciones.especiales ?? []).map((e, i) => ({ ocurrenciaId: `o${i}`, ...e }));
      },
      circuitosDeUnidadEntre: async () => opciones.circuitos ?? [],
    },
  };
  return { repos: r as never, pedidos };
}

const AHORA = juarez("2026-09-15T18:04:47");
const pedir = (dia: string, r = repos()) =>
  serviciosDeUnidadEnDia(r.repos, { carrierAccountId: "c1", unitId: "u1", dia, ahora: AHORA });

describe("serviciosDeUnidadEnDia · decisión 2 de la ficha C3", () => {
  it("la unidad de otro carrier no existe desde aquí", async () => {
    const r = repos();
    expect(
      await serviciosDeUnidadEnDia(r.repos, { carrierAccountId: "c1", unitId: "ajena", dia: "2026-09-15", ahora: AHORA }),
    ).toBeNull();
  });

  it("sin contrato de especial ni concesión, la sección no existe — ni vacía ni con mensaje", async () => {
    expect(await pedir("2026-09-15", repos({ ligado: false }))).toEqual({ reservada: false });
  });

  it("busca los especiales que empiezan en ese día civil de Juárez", async () => {
    const r = repos();
    await pedir("2026-09-14", r);
    expect(r.pedidos).toEqual(["2026-09-14T06:00:00.000Z→2026-09-15T05:59:59.999Z"]);
  });

  it("especial: cliente · ruta, con la ventana de su viaje; el nocturno trae su ventana de dos días", async () => {
    const s = await pedir(
      "2026-09-15",
      repos({
        especiales: [
          { cliente: "Cliente A", ruta: "Poniente", ventanaDesde: juarez("2026-09-15T05:30:00"), ventanaHasta: juarez("2026-09-15T13:30:00") },
          { cliente: "Cliente B", ruta: "Nocturno", ventanaDesde: juarez("2026-09-15T22:00:00"), ventanaHasta: juarez("2026-09-16T06:00:00") },
        ],
      }),
    );
    expect(s).toEqual({
      reservada: true,
      dia: "2026-09-15",
      circuitosSinHorario: [],
      servicios: [
        { nombre: "Cliente A · Poniente", modalidad: "especial", desde: juarez("2026-09-15T05:30:00"), hasta: juarez("2026-09-15T13:30:00") },
        { nombre: "Cliente B · Nocturno", modalidad: "especial", desde: juarez("2026-09-15T22:00:00"), hasta: juarez("2026-09-16T06:00:00") },
      ],
    });
  });

  it("circuito hoy: un botón con su horario de servicio, mezclado en orden con los especiales", async () => {
    const s = await pedir(
      "2026-09-15",
      repos({
        especiales: [{ cliente: "Cliente A", ruta: "Poniente", ventanaDesde: juarez("2026-09-15T05:30:00"), ventanaHasta: juarez("2026-09-15T13:30:00") }],
        circuitos: [{ circuitoId: "k1", nombre: "Circuito 1", inicioLocal: "14:00:00", finLocal: "22:00:00", zona: "America/Ciudad_Juarez" }],
      }),
    );
    expect(s && s.reservada && s.servicios.map((x) => [x.nombre, x.modalidad, x.desde.toISOString()])).toEqual([
      ["Cliente A · Poniente", "especial", "2026-09-15T11:30:00.000Z"],
      ["Circuito 1", "circuito", "2026-09-15T20:00:00.000Z"],
    ]);
  });

  it("circuito con cierre después de medianoche: la ventana termina al día siguiente", async () => {
    const s = await pedir(
      "2026-09-15",
      repos({ circuitos: [{ circuitoId: "k1", nombre: "Circuito 1", inicioLocal: "18:00:00", finLocal: "02:00:00", zona: "America/Ciudad_Juarez" }] }),
    );
    expect(s && s.reservada && s.servicios[0]!.hasta).toEqual(juarez("2026-09-16T02:00:00"));
  });

  it("circuito en un día pasado: su horario de entonces no se guardó — sin botón, y sin decir que no hubo servicio", async () => {
    const s = await pedir(
      "2026-09-14",
      repos({ circuitos: [{ circuitoId: "k1", nombre: "Circuito 1", inicioLocal: "14:00:00", finLocal: "22:00:00", zona: "America/Ciudad_Juarez" }] }),
    );
    expect(s).toEqual({ reservada: true, dia: "2026-09-14", servicios: [], circuitosSinHorario: ["Circuito 1"] });
  });

  it("dos asignaciones al mismo circuito en el día son un solo circuito", async () => {
    const c = { circuitoId: "k1", nombre: "Circuito 1", inicioLocal: "14:00:00", finLocal: "22:00:00", zona: "America/Ciudad_Juarez" };
    const s = await pedir("2026-09-15", repos({ circuitos: [c, c] }));
    expect(s && s.reservada && s.servicios).toHaveLength(1);
  });
});
