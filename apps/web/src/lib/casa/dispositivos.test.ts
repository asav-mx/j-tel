import { describe, expect, it } from "vitest";
import { apoyoDeInventario, puertaDe, quienYPorQue, rutasDeDispositivos, senalViva, textoDeRuta } from "./dispositivos";

const AHORA = new Date("2026-09-17T13:42:00Z");

describe("el apoyo de un dispositivo en el inventario", () => {
  it("montado dice en qué unidad; en bodega, sin unidad (el «nunca» lo dice el dato)", () => {
    expect(apoyoDeInventario({ unidad: "10254", estado: { grupo: "en_unidad", unidadId: "u", montadoDesde: AHORA, ultimaSenalAt: AHORA } })).toBe("en 10254");
    expect(apoyoDeInventario({ unidad: null, estado: { grupo: "en_bodega", ultimaSenalAt: AHORA } })).toBe("sin unidad");
    expect(apoyoDeInventario({ unidad: null, estado: { grupo: "en_bodega", ultimaSenalAt: null } })).toBe("sin unidad");
  });

  it("de baja dice su motivo, y si no lo tiene lo dice también", () => {
    expect(apoyoDeInventario({ unidad: null, estado: { grupo: "de_baja", retiredAt: AHORA, retiredReason: "Umbrella cortó", ultimaSenalAt: null } })).toBe("Umbrella cortó");
    expect(apoyoDeInventario({ unidad: null, estado: { grupo: "de_baja", retiredAt: AHORA, retiredReason: null, ultimaSenalAt: null } })).toBe("sin motivo");
  });
});

describe("el cobre del inventario", () => {
  const montado = (minutos: number | null) => ({
    grupo: "en_unidad" as const,
    unidadId: "u",
    montadoDesde: AHORA,
    ultimaSenalAt: minutos === null ? null : new Date(AHORA.getTime() - minutos * 60_000),
  });

  it("sólo lo montado que habló dentro de los 15 min", () => {
    expect(senalViva(montado(1), AHORA)).toBe(true);
    expect(senalViva(montado(15), AHORA)).toBe(true);
    // «hace 3.8 h» en cobre fue lo que se vio con el escenario sembrado.
    expect(senalViva(montado(228), AHORA)).toBe(false);
    expect(senalViva(montado(null), AHORA)).toBe(false);
  });

  it("en bodega no es vida aunque acabe de hablar", () => {
    expect(senalViva({ grupo: "en_bodega", ultimaSenalAt: AHORA }, AHORA)).toBe(false);
  });
});

describe("quién y por qué en la historia", () => {
  const correo = (id: string) => `${id}@jtel.mx`;
  const a = { vigente: false, asignadaPor: null, cerradaPor: null, motivoCierre: null };

  it("la vigente dice quién la abrió; sin registro, lo dice", () => {
    expect(quienYPorQue({ ...a, vigente: true, asignadaPor: "asav" }, correo)).toBe("asignó asav@jtel.mx");
    expect(quienYPorQue({ ...a, vigente: true }, correo)).toBe("asignación sin registro de quién");
  });

  it("la cerrada dice por qué y quién; el motivo del sistema sin quién (alta vieja) lo dice también", () => {
    expect(quienYPorQue({ ...a, cerradaPor: "asav", motivoCierre: "Entró a taller" }, correo)).toBe("Entró a taller · asav@jtel.mx");
    expect(quienYPorQue({ ...a, motivoCierre: "Se asignó a la unidad 10254" }, correo)).toBe("Se asignó a la unidad 10254 · sin registro de quién");
    expect(quienYPorQue(a, correo)).toBe("cierre sin registro de quién ni por qué");
  });
});

describe("las rutas", () => {
  it("el cuarto, con su panel o su hecho, y la cuenta al final", () => {
    expect(rutasDeDispositivos.cuarto()).toBe("/casa/transportista/dispositivos");
    expect(rutasDeDispositivos.cuarto("juarez-bus", { accion: "alta" })).toBe("/casa/transportista/dispositivos?accion=alta&account=juarez-bus");
  });

  it("la ficha vive en Expedientes y sólo escribe la puerta cuando no es la de siempre", () => {
    expect(rutasDeDispositivos.ver("d1")).toBe("/casa/transportista/expedientes/dispositivo/d1");
    expect(rutasDeDispositivos.ver("d1", null, { desde: "expedientes" })).toBe("/casa/transportista/expedientes/dispositivo/d1");
    expect(rutasDeDispositivos.ver("d1", "jb", { desde: "dispositivos" })).toBe("/casa/transportista/expedientes/dispositivo/d1?desde=dispositivos&account=jb");
  });

  it("el recorrido lleva la puerta en `puerta`: `desde` es de la ventana", () => {
    expect(rutasDeDispositivos.recorrido("d1")).toBe("/casa/transportista/expedientes/dispositivo/d1/recorrido");
    expect(rutasDeDispositivos.recorrido("d1", "jb", "dispositivos")).toBe(
      "/casa/transportista/expedientes/dispositivo/d1/recorrido?puerta=dispositivos&account=jb",
    );
  });

  it("la puerta no se cree lo que venga en la dirección", () => {
    expect(puertaDe("dispositivos")).toBe("dispositivos");
    expect(puertaDe("https://otro.sitio")).toBe("expedientes");
    expect(puertaDe(["dispositivos"])).toBe("expedientes");
  });

  it("un texto de la dirección se recorta, y uno vacío no es texto", () => {
    expect(textoDeRuta("  ")).toBeNull();
    expect(textoDeRuta("x".repeat(500))).toHaveLength(300);
  });
});
