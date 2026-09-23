import { describe, it, expect } from "vitest";
import { crearPortador, emitirBoleto, type BoletoSellado } from "./boleto.js";
import { LLAVE_DE_LABORATORIO } from "./boleto-llave.js";
import {
  HORAS_DE_SERVICIO_PARA_MUDO,
  firmarLote,
  hallazgoDeDobleUso,
  horasDeServicioEntre,
  loteBienFormado,
  saludDelLector,
  verificarFirmaDelLote,
  type LoteDelLector,
  type PasoEntregado,
} from "./sincronizacion.js";
import { instanteZonificado } from "./tiempo.js";

const LECTOR = crearPortador(new Uint8Array([1, 2, 3]));
const OTRO_LECTOR = crearPortador(new Uint8Array([9, 9, 9]));
const publicaHex = (p: typeof LECTOR) =>
  [...p.publica].map((b) => b.toString(16).padStart(2, "0")).join("");

const AHORA = Date.UTC(2026, 8, 23, 18, 0, 0);

function boleto(folio: string): BoletoSellado {
  return emitirBoleto(
    {
      folio,
      ruta: "cualquier-circuito",
      emitido: AHORA - 1000,
      vence: AHORA + 86_400_000,
      portador: crearPortador(new Uint8Array([7])).publica,
    },
    LLAVE_DE_LABORATORIO,
  );
}

function paso(extra: Partial<PasoEntregado> = {}): PasoEntregado {
  const folio = extra.folio ?? "ONT-00000001";
  return {
    paso: "11111111-1111-4111-8111-111111111111",
    folio,
    via: "qr",
    cuando: AHORA,
    conSenal: false,
    boleto: boleto(folio),
    ...extra,
  };
}

function lote(extra: Partial<LoteDelLector> = {}): LoteDelLector {
  return {
    lector: "22222222-2222-4222-8222-222222222222",
    dia: "2026-09-23",
    armadoEn: AHORA,
    pasos: [paso()],
    ...extra,
  };
}

describe("el lote firmado del lector", () => {
  it("verifica con la pública del lector que lo firmó", () => {
    const l = lote();
    const firma = firmarLote(l, LECTOR.privada);
    expect(verificarFirmaDelLote(l, firma, publicaHex(LECTOR))).toBe(true);
  });

  it("no verifica con la pública de otro lector — es lo que la revocación necesita", () => {
    const l = lote();
    const firma = firmarLote(l, LECTOR.privada);
    expect(verificarFirmaDelLote(l, firma, publicaHex(OTRO_LECTOR))).toBe(false);
  });

  it("no verifica si alguien le cambia un folio en el camino", () => {
    const l = lote();
    const firma = firmarLote(l, LECTOR.privada);
    const alterado = { ...l, pasos: [paso({ folio: "ONT-99999999" })] };
    expect(verificarFirmaDelLote(alterado, firma, publicaHex(LECTOR))).toBe(false);
  });

  it("no verifica si le agregan un paso que el lector no firmó", () => {
    const l = lote();
    const firma = firmarLote(l, LECTOR.privada);
    const inflado = {
      ...l,
      pasos: [...l.pasos, paso({ paso: "33333333-3333-4333-8333-333333333333", folio: "ONT-00000002" })],
    };
    expect(verificarFirmaDelLote(inflado, firma, publicaHex(LECTOR))).toBe(false);
  });

  it("el latido —un lote sin pasos— se firma y verifica igual", () => {
    const latido = lote({ pasos: [] });
    const firma = firmarLote(latido, LECTOR.privada);
    expect(verificarFirmaDelLote(latido, firma, publicaHex(LECTOR))).toBe(true);
  });

  /*
   * La trampa que los separadores existen para cerrar: dos lotes distintos que
   * se serializaran a la misma cadena harían que una firma valiera para los
   * dos. Aquí se mueve la frontera entre campos a propósito.
   */
  it("dos lotes distintos no comparten firma aunque los campos se peguen", () => {
    const a = lote({ lector: "aa", dia: "2026-09-23", pasos: [] });
    const b = lote({ lector: "aa\n2026-09-23", dia: "2026-09-23", pasos: [] });
    const firma = firmarLote(a, LECTOR.privada);
    expect(loteBienFormado(b)).toBe(false);
    expect(verificarFirmaDelLote(b, firma, publicaHex(LECTOR))).toBe(false);
  });

  it("un lote con un separador adentro no se firma", () => {
    expect(() => firmarLote(lote({ dia: "2026-09-23\nmentira" }), LECTOR.privada)).toThrow();
  });

  it("la vía dictada no puede traer boleto, y el QR no puede venir sin él", () => {
    expect(loteBienFormado(lote({ pasos: [paso({ via: "codigo_dictado" })] }))).toBe(false);
    expect(loteBienFormado(lote({ pasos: [paso({ via: "codigo_dictado", boleto: undefined })] }))).toBe(true);
    expect(loteBienFormado(lote({ pasos: [paso({ boleto: undefined })] }))).toBe(false);
  });

  it("una firma ilegible es un no, no una explosión", () => {
    expect(verificarFirmaDelLote(lote(), "no-es-hex", publicaHex(LECTOR))).toBe(false);
    expect(verificarFirmaDelLote(lote(), firmarLote(lote(), LECTOR.privada), "corta")).toBe(false);
  });
});

describe("el doble uso, al recibir", () => {
  const nuevo = { operacionId: "op-2", lector: "lector-B", cuando: 200 };

  it("dos aparatos con el mismo folio: hallazgo, con los dos en orden de hora", () => {
    const h = hallazgoDeDobleUso("ONT-1", nuevo, [
      { operacionId: "op-1", lector: "lector-A", cuando: 100 },
    ]);
    expect(h).not.toBeNull();
    expect(h!.lectores).toEqual(["lector-A", "lector-B"]);
    expect(h!.operaciones).toEqual(["op-1", "op-2"]);
  });

  /*
   * Ésta es la que evita la alarma falsa: un reenvío del mismo lector NO es
   * doble uso. El aparato ya rechaza el segundo paso en el momento, así que un
   * segundo renglón suyo sólo puede venir de haber mandado el lote dos veces.
   */
  it("el mismo lector dos veces no es doble uso", () => {
    expect(
      hallazgoDeDobleUso("ONT-1", nuevo, [{ operacionId: "op-1", lector: "lector-B", cuando: 100 }]),
    ).toBeNull();
  });

  it("un folio que nadie había quemado no levanta nada", () => {
    expect(hallazgoDeDobleUso("ONT-1", nuevo, [])).toBeNull();
  });

  it("tres aparatos salen los tres, sin repetir ninguno", () => {
    const h = hallazgoDeDobleUso("ONT-1", nuevo, [
      { operacionId: "op-1", lector: "lector-A", cuando: 100 },
      { operacionId: "op-0", lector: "lector-C", cuando: 50 },
      { operacionId: "op-3", lector: "lector-A", cuando: 300 },
    ]);
    expect(h!.lectores).toEqual(["lector-C", "lector-A", "lector-B"]);
    expect(h!.operaciones).toEqual(["op-0", "op-1", "op-2", "op-3"]);
  });
});

describe("el lector callado", () => {
  const horario = { inicioLocal: "05:00", finLocal: "23:00", zona: "America/Ciudad_Juarez" };
  const enElDia = (hhmm: string, dia = "2026-09-23") => {
    const [hh, mm] = hhmm.split(":").map(Number);
    return instanteZonificado(dia, hh! * 60 + mm!, horario.zona).getTime();
  };

  it("cuenta las horas que caen dentro del horario", () => {
    expect(horasDeServicioEntre(enElDia("08:00"), enElDia("11:00"), horario)).toBeCloseTo(3, 6);
  });

  /* La razón de ser de la regla: el camión dormido no está mudo. */
  it("la noche no cuenta: de las 22:00 a las 06:00 son 2 h de servicio, no 8", () => {
    expect(horasDeServicioEntre(enElDia("22:00"), enElDia("06:00", "2026-09-24"), horario)).toBeCloseTo(2, 6);
  });

  it("un servicio de 24 h cuenta el reloj entero", () => {
    const todoElDia = { ...horario, inicioLocal: "00:00", finLocal: "00:00" };
    expect(horasDeServicioEntre(enElDia("22:00"), enElDia("06:00", "2026-09-24"), todoElDia)).toBeCloseTo(8, 6);
  });

  it("un horario que cruza la medianoche cuenta la madrugada del servicio que empezó ayer", () => {
    const nocturno = { ...horario, inicioLocal: "22:00", finLocal: "02:00" };
    /* De la 01:00 a la 01:30 del día 24: dentro del servicio que abrió el 23. */
    expect(
      horasDeServicioEntre(enElDia("01:00", "2026-09-24"), enElDia("01:30", "2026-09-24"), nocturno),
    ).toBeCloseTo(0.5, 6);
  });

  it("sin circuito asignado no se contesta ni sí ni no", () => {
    const s = saludDelLector({ ultimoContacto: enElDia("05:00"), ahora: enElDia("23:00"), horario: null });
    expect(s).toEqual({ estado: "no_se_puede_decir", motivo: "sin_circuito_asignado" });
  });

  it("tres horas de servicio callado todavía no es mudo; cinco sí", () => {
    expect(saludDelLector({ ultimoContacto: enElDia("08:00"), ahora: enElDia("11:00"), horario }).estado)
      .toBe("en_contacto");
    expect(saludDelLector({ ultimoContacto: enElDia("08:00"), ahora: enElDia("13:00"), horario }).estado)
      .toBe("mudo");
  });

  /* El número vive en una sola constante: si alguien lo mueve, esto lo dice. */
  it("el umbral son 4 horas de servicio, y justo en el umbral ya es mudo", () => {
    expect(HORAS_DE_SERVICIO_PARA_MUDO).toBe(4);
    const justo = saludDelLector({
      ultimoContacto: enElDia("08:00"),
      ahora: enElDia("12:00"),
      horario,
    });
    expect(justo.estado).toBe("mudo");
  });

  it("un lector recién dado de alta no lleva callado desde el principio de los tiempos", () => {
    const alta = enElDia("10:00");
    expect(saludDelLector({ ultimoContacto: alta, ahora: enElDia("11:00"), horario }).estado)
      .toBe("en_contacto");
  });
});
