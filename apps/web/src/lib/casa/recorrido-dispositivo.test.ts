import { describe, expect, it } from "vitest";
import {
  nombreDeEtapa,
  pausasDelDispositivo,
  pedazosDelDispositivo,
  quienDeEtapa,
  reglaDeEtapa,
  textoDelCambio,
  type EtapaJson,
  type RecorridoDeDispositivoJson,
} from "@/lib/casa/recorrido-dispositivo";

const h = (hhmm: string) => `2026-09-16T${hhmm}:00-06:00`;
const t = (hhmm: string) => Date.parse(h(hhmm));
const punto = (hhmm: string) => ({ lat: 31.7, lng: -106.4, at: h(hhmm), speed: 30 });
const vacio = { huecos: [], saltos: [], visitas: [], ocultos: [], paradas: [], simplificado: false, cifras: { puntos: 0, kmMedidos: 0, saltosDescartados: 0, minutosConSenal: 0, huecos: 0 } };

const U54: EtapaJson = {
  tipo: "unidad",
  desde: h("00:00"),
  hasta: h("07:42"),
  unidad: { id: "u54", etiqueta: "10254" },
  especiales: 0,
  asignadaPor: null,
  cerradaPor: "user_ana",
  motivoCierre: "Falla de alimentación, a taller",
  ...vacio,
  // Dos tramos con un hueco de por medio.
  tramos: [[punto("05:20"), punto("06:31")], [punto("06:44"), punto("07:41")]],
};
const BODEGA: EtapaJson = { tipo: "bodega", desde: h("07:42"), hasta: h("11:10"), ...vacio, tramos: [[punto("08:05"), punto("09:20")]] };
const U61: EtapaJson = {
  tipo: "unidad",
  desde: h("11:10"),
  hasta: h("23:59"),
  unidad: { id: "u61", etiqueta: "10261" },
  especiales: 1,
  asignadaPor: "user_ana",
  cerradaPor: null,
  motivoCierre: null,
  ...vacio,
  tramos: [[punto("11:24"), punto("12:48")], [punto("13:22"), punto("15:30")]],
  ocultos: [{ lugar: { id: "p47", nombre: "Planta 47", rol: "destino" }, desde: h("12:48"), entradaObservada: true, hasta: h("13:22"), salidaObservada: true }],
};
const SIN_PUNTOS: EtapaJson = { tipo: "sin_unidad_sin_puntos", desde: h("07:42"), hasta: h("11:10") };
const AUTORES = { user_ana: "ana@ejemplo.mx" };

const dia = (etapas: EtapaJson[]): Pick<RecorridoDeDispositivoJson, "etapas" | "autores"> => ({ etapas, autores: AUTORES });

describe("los pedazos del dispositivo", () => {
  it("cada pedazo sabe de qué etapa es, y la bodega va marcada sin unidad", () => {
    const p = pedazosDelDispositivo(dia([U54, BODEGA, U61]));
    expect(p.map((x) => [x.etapa, x.sinUnidad])).toEqual([
      [0, false],
      [0, false],
      [1, true],
      [2, false],
      [2, false],
    ]);
  });

  it("una etapa sin puntos no aporta pedazos", () => {
    expect(pedazosDelDispositivo(dia([U54, SIN_PUNTOS, U61])).map((x) => x.etapa)).toEqual([0, 0, 2, 2]);
  });
});

describe("dónde se detiene el playback", () => {
  it("hueco dentro de una etapa, cambio entre etapas, destino con los ocultos de su etapa", () => {
    const r = dia([U54, BODEGA, U61]);
    const pausas = pausasDelDispositivo(pedazosDelDispositivo(r), r);
    expect(pausas.map((p) => p.tipo)).toEqual(["hueco", "cambio", "cambio", "destino"]);
    expect(pausas[0]).toMatchObject({ desde: t("06:31"), hasta: t("06:44") });
    expect(pausas[3]).toMatchObject({ lugar: "Planta 47" });
  });

  it("el tiempo entre etapas nunca se llama hueco, aunque sean horas sin puntos", () => {
    const r = dia([U54, SIN_PUNTOS, U61]);
    const pausas = pausasDelDispositivo(pedazosDelDispositivo(r), r);
    expect(pausas[1]).toEqual({ tipo: "cambio", sale: 0, entra: 2, entre: [1] });
  });
});

describe("cómo se dice un cambio", () => {
  it("de unidad a bodega: quién lo soltó, en correo, y por qué", () => {
    const x = textoDelCambio(dia([U54, BODEGA, U61]), { tipo: "cambio", sale: 0, entra: 1, entre: [] }, t("08:05"));
    expect(x).toMatchObject({
      titulo: "Deja la 10254",
      rango: "07:42 · lo soltó ana@ejemplo.mx",
      motivo: "«Falla de alimentación, a taller»",
      accion: "Continuar en bodega · 08:05",
      entraABodega: true,
    });
  });

  it("de bodega a unidad: quién lo montó, y que lo que sigue se corta con los servicios de esa unidad", () => {
    const x = textoDelCambio(dia([U54, BODEGA, U61]), { tipo: "cambio", sale: 1, entra: 2, entre: [] }, t("11:24"));
    expect(x.titulo).toBe("Montado en la 10261");
    expect(x.rango).toBe("11:10 · lo asignó ana@ejemplo.mx");
    expect(x.porque).toBe("Lo que sigue es de la 10261 y se corta con sus servicios.");
    expect(x.accion).toBe("Continuar en la 10261 · 11:24");
  });

  it("de una unidad a otra sin bodega; sin autor registrado lo dice, no lo inventa", () => {
    const x = textoDelCambio(
      { etapas: [U54, { ...U61, desde: h("07:42"), asignadaPor: null }], autores: {} },
      { tipo: "cambio", sale: 0, entra: 1, entre: [] },
      t("08:00"),
    );
    expect(x.titulo).toBe("De la 10254 a la 10261");
    expect(x.rango).toBe("07:42 · sin registro de quién lo asignó");
  });

  it("si de por medio quedó un tramo sin unidad ni puntos, el aviso lo nombra con su alcance", () => {
    const x = textoDelCambio(dia([U54, SIN_PUNTOS, U61]), { tipo: "cambio", sale: 0, entra: 2, entre: [1] }, t("11:24"));
    expect(x.porque).toContain("Antes, 07:42–11:10: sin unidad y sin puntos en esta cuenta.");
    expect(x.titulo).toBe("Montado en la 10261");
  });
});

describe("las etapas en la lista", () => {
  it("nombre y regla: nunca «en bodega» para lo que no tiene puntos", () => {
    expect([U54, BODEGA, SIN_PUNTOS].map(nombreDeEtapa)).toEqual(["10254", "En bodega", "Sin unidad y sin puntos"]);
    expect(reglaDeEtapa(U61)).toBe("con servicio especial: se corta en destino");
    expect(reglaDeEtapa(U54)).toBe("sin servicio especial: la traza no se corta");
  });

  it("quién y por qué debajo de cada etapa", () => {
    const etapas = [U54, BODEGA, U61, SIN_PUNTOS];
    expect(quienDeEtapa(etapas, 0, AUTORES)).toBeNull();
    expect(quienDeEtapa(etapas, 1, AUTORES)).toBe("Lo soltó ana@ejemplo.mx · 07:42 · «Falla de alimentación, a taller»");
    expect(quienDeEtapa(etapas, 2, AUTORES)).toBe("Lo asignó ana@ejemplo.mx · 11:10");
    expect(quienDeEtapa(etapas, 3, AUTORES)).toBe("Aquí no tuvo unidad ni dio un solo punto. Con eso no se puede saber dónde estuvo.");
  });
});
