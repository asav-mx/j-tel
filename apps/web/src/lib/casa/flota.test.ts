import { describe, expect, it } from "vitest";
import type { FlotaEnVivo } from "@jtel/services";
import { flotaParaPantalla, horaCorta } from "./flota";

const LEIDA = new Date("2026-09-16T12:41:00Z"); // 06:41 en Juárez
const hace = (s: number) => new Date(LEIDA.getTime() - s * 1000);

function flota(): FlotaEnVivo {
  return {
    unidades: [
      {
        unidad: { id: "u1", label: "10254" },
        grupo: "en_linea",
        estado: {
          tipo: "en_linea",
          dispositivoId: "d1",
          postura: "en_movimiento",
          ultimaSenalAt: hace(14),
          velocidadKmh: 42.7,
          rumbo: 135,
        },
      },
      {
        unidad: { id: "u2", label: "6284" },
        grupo: "en_destino",
        estado: {
          tipo: "en_destino",
          dispositivoId: "d2",
          destino: {
            lugarId: "p47",
            lugarNombre: "Planta 47",
            llegadaAt: new Date("2026-09-16T12:08:00Z"),
            entradaObservada: true,
          },
          ultimaSenalAt: hace(40 * 60),
        },
      },
      {
        unidad: { id: "u3", label: "10288" },
        grupo: "sin_senal",
        estado: { tipo: "sin_senal", dispositivoId: "d3", ultimaSenalAt: null },
      },
      {
        unidad: { id: "u4", label: "10290" },
        grupo: "desconectado",
        estado: { tipo: "desconectado", dispositivoId: "d4", ultimaSenalAt: hace(3 * 86400) },
      },
      { unidad: { id: "u5", label: "10301" }, grupo: "sin_dispositivo", estado: { tipo: "sin_dispositivo" } },
    ],
    dispositivos: [],
    anomalias: { unidadesConVariosDispositivos: [], dispositivosEnVariasUnidades: [], dispositivosDeBajaMontados: [] },
    unidadesInactivas: 1,
    lugares: [{ id: "p47", nombre: "Planta 47", rol: "destino", poligono: [] }],
    posicionPorUnidad: new Map([
      ["u1", { lat: 31.7, lng: -106.4 }],
      ["u2", { lat: 31.75, lng: -106.39 }],
    ]),
  };
}

describe("flotaParaPantalla", () => {
  const p = flotaParaPantalla(flota(), { leida: LEIDA, cuenta: "Juárez Bus", cuentaEnRuta: "juarez-bus" });
  const de = (nombre: string) => p.unidades.find((u) => u.nombre === nombre)!;

  it("en línea: la edad viaja como instante y va en cobre; el apoyo es la velocidad", () => {
    expect(de("10254")).toMatchObject({
      glifo: "en-movimiento",
      rumbo: 135,
      apoyo: "42.7 km/h",
      dato: { tipo: "edad", desdeIso: hace(14).toISOString(), etiqueta: "última señal", vivo: true },
      apagada: false,
    });
  });

  it("en destino: la hora de llegada en la zona de la operación, nunca la edad", () => {
    expect(de("6284")).toMatchObject({
      glifo: "en-destino",
      apoyo: "Planta 47",
      dato: { tipo: "hora", texto: "06:08", etiqueta: "llegó" },
    });
  });

  it("sin señal recién montada no inventa una edad", () => {
    expect(de("10288")).toMatchObject({
      apoyo: "montada, sin reportar",
      dato: { tipo: "ninguno", etiqueta: "nunca reportó" },
    });
  });

  it("lo apagado se apaga: desconectado y sin dispositivo", () => {
    expect(de("10290").apagada).toBe(true);
    expect(de("10301")).toMatchObject({ glifo: "sin-dispositivo", apagada: true, posicion: null });
  });

  it("la ficha lleva la cuenta si venía en la dirección", () => {
    expect(de("10254").ficha).toBe("/casa/transportista/expedientes/unidad/u1?account=juarez-bus");
  });

  it("sale JSON y vuelve igual: la lectura de cada 30 s traduce idéntico a la carga", () => {
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
    expect(p.leidaIso).toBe(LEIDA.toISOString());
    expect(p.unidadesInactivas).toBe(1);
  });

  it("horaCorta es de reloj de 24 h", () => {
    expect(horaCorta(new Date("2026-09-16T21:05:00Z"))).toBe("15:05");
  });
});
