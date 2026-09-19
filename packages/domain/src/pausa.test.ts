import { describe, expect, it } from "vitest";
import {
  caeEnPausa,
  inicioDeFecha,
  intervalosDePausa,
  lineaDePausa,
  pausaTocaVentana,
  pausaVigente,
  periodoDePausaEnPalabras,
  revisarPausa,
  revisarReanudacion,
  type EventoDeVerificacion,
} from "./pausa.js";

const ZONA = "America/Ciudad_Juarez";
const d = (fecha: string, hhmm = "00:00") => new Date(`${fecha}T${hhmm}:00-06:00`);
const MOTIVO = "Sin telemetría: el proveedor anterior se desconectó";

const pausa = (desde: Date, registrado = new Date("2026-09-19T12:00:00Z")): EventoDeVerificacion => ({
  tipo: "pausa",
  valeDesde: desde,
  motivo: MOTIVO,
  registradoAt: registrado,
});
const reanuda = (desde: Date): EventoDeVerificacion => ({ tipo: "reanudacion", valeDesde: desde, motivo: null, registradoAt: desde });

describe("los intervalos de pausa salen de los eventos", () => {
  it("una pausa abierta: desde, sin hasta", () => {
    expect(intervalosDePausa([pausa(d("2026-09-05"))])).toEqual([{ desde: d("2026-09-05"), hasta: null, motivo: MOTIVO }]);
  });

  it("pausa y reanudación cierran el intervalo; una segunda pausa abre otro", () => {
    const i = intervalosDePausa([reanuda(d("2026-09-20", "10:00")), pausa(d("2026-09-05")), pausa(d("2026-10-01"))]);
    expect(i.map((x) => [x.desde, x.hasta])).toEqual([
      [d("2026-09-05"), d("2026-09-20", "10:00")],
      [d("2026-10-01"), null],
    ]);
  });

  it("una reanudación sin pausa abierta no abre nada", () => {
    expect(intervalosDePausa([reanuda(d("2026-09-05"))])).toEqual([]);
  });
});

describe("¿cae en pausa?", () => {
  const i = intervalosDePausa([pausa(d("2026-09-05")), reanuda(d("2026-09-20", "10:00"))]);

  it("el inicio cuenta; el instante de reanudar ya no", () => {
    expect(caeEnPausa(i, d("2026-09-05"))).toBe(true);
    expect(caeEnPausa(i, d("2026-09-20", "09:59"))).toBe(true);
    expect(caeEnPausa(i, d("2026-09-20", "10:00"))).toBe(false);
    expect(caeEnPausa(i, d("2026-09-04", "23:59"))).toBe(false);
  });

  it("la vigente es la que no ha terminado", () => {
    expect(pausaVigente(i, d("2026-09-10"))).toBeNull();
    expect(pausaVigente(intervalosDePausa([pausa(d("2026-09-05"))]), d("2026-09-19"))?.motivo).toBe(MOTIVO);
  });

  it("la fecha del primer uso es la medianoche del 5 sep en la zona del contrato", () => {
    expect(inicioDeFecha("2026-09-05", ZONA).toISOString()).toBe("2026-09-05T06:00:00.000Z");
  });
});

describe("revisar una pausa antes de escribirla", () => {
  const ahora = new Date("2026-09-19T12:00:00Z");

  it("la del primer uso pasa: fecha pasada y motivo", () => {
    expect(revisarPausa({ eventos: [], valeDesde: d("2026-09-05"), motivo: `  ${MOTIVO}  `, ahora })).toEqual({ ok: true, motivo: MOTIVO });
  });

  it("no se agenda hacia el futuro", () => {
    expect(revisarPausa({ eventos: [], valeDesde: d("2026-09-25"), motivo: MOTIVO, ahora })).toEqual({ ok: false, error: "fecha_futura" });
  });

  it("no se pausa lo pausado", () => {
    expect(revisarPausa({ eventos: [pausa(d("2026-09-05"))], valeDesde: d("2026-09-10"), motivo: MOTIVO, ahora })).toEqual({
      ok: false,
      error: "ya_en_pausa",
    });
  });

  it("no empieza antes de la última reanudación: dos pausas no se enciman", () => {
    const eventos = [pausa(d("2026-09-01")), reanuda(d("2026-09-10"))];
    expect(revisarPausa({ eventos, valeDesde: d("2026-09-08"), motivo: MOTIVO, ahora })).toEqual({ ok: false, error: "antes_del_evento_anterior" });
  });

  it("el motivo es obligatorio y cabe en una línea", () => {
    expect(revisarPausa({ eventos: [], valeDesde: d("2026-09-05"), motivo: "   ", ahora })).toEqual({ ok: false, error: "motivo_vacio" });
    expect(revisarPausa({ eventos: [], valeDesde: d("2026-09-05"), motivo: "x".repeat(161), ahora })).toEqual({ ok: false, error: "motivo_largo" });
  });

  it("sólo se reanuda lo que está en pausa", () => {
    expect(revisarReanudacion({ eventos: [] })).toEqual({ ok: false, error: "no_esta_en_pausa" });
    expect(revisarReanudacion({ eventos: [pausa(d("2026-09-05"))] })).toEqual({ ok: true });
  });
});

describe("la línea de Servicios especiales", () => {
  it("pausa abierta: «desde el 5 sep»", () => {
    const [i] = intervalosDePausa([pausa(d("2026-09-05"))]);
    expect(lineaDePausa(i!, { zona: ZONA })).toBe(`Verificación en pausa desde el 5 sep · ${MOTIVO}`);
  });

  it("pausa terminada: «del 5 al 20 sep»; reanudar a medianoche no cuenta ese día", () => {
    const [i] = intervalosDePausa([pausa(d("2026-09-05")), reanuda(d("2026-09-21"))]);
    expect(periodoDePausaEnPalabras(i!, ZONA)).toBe("del 5 al 20 sep");
  });

  it("entre dos meses dice los dos", () => {
    const [i] = intervalosDePausa([pausa(d("2026-08-28")), reanuda(d("2026-09-03", "12:00"))]);
    expect(periodoDePausaEnPalabras(i!, ZONA)).toBe("del 28 ago al 3 sep");
  });

  it("el contrato va adelante sólo cuando se le da (más de un contrato)", () => {
    const [i] = intervalosDePausa([pausa(d("2026-09-05"))]);
    expect(lineaDePausa(i!, { zona: ZONA, contrato: "Contrato Norte" })).toBe(
      `Contrato Norte · Verificación en pausa desde el 5 sep · ${MOTIVO}`,
    );
  });

  it("toca la ventana si se enciman", () => {
    const [i] = intervalosDePausa([pausa(d("2026-09-05")), reanuda(d("2026-09-10"))]);
    expect(pausaTocaVentana(i!, d("2026-09-09"), d("2026-09-15"))).toBe(true);
    expect(pausaTocaVentana(i!, d("2026-09-10"), d("2026-09-15"))).toBe(false);
    expect(pausaTocaVentana(i!, d("2026-09-01"), d("2026-09-04", "23:59"))).toBe(false);
  });
});
