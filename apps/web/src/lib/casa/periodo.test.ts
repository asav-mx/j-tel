import { describe, expect, it } from "vitest";
import { atajoDelPeriodo, atajosDeTiempo, etiquetaDelPeriodo, periodoDeLaDireccion } from "@/lib/casa/periodo";

/**
 * «Esta semana» = lunes 00:00 de la zona de la cuenta → el momento de mirar,
 * sin importar el día (ficha Vernier §2; prueba 2 de §6: en lunes y en domingo).
 */

const JUAREZ = "America/Ciudad_Juarez";
/** Instante de una hora civil de Juárez en septiembre (UTC-6). */
const j = (s: string) => Date.parse(`${s}-06:00`);
const semana = (ahora: number, zona = JUAREZ) => atajosDeTiempo(ahora, zona)[2]!;

describe("Esta semana arranca el lunes a las 00:00 de la zona", () => {
  it("en lunes: es el mismo día, desde la medianoche", () => {
    const lunes = j("2026-09-14T09:30:00");
    expect(semana(lunes)).toEqual({ nombre: "Esta semana", periodo: { desde: j("2026-09-14T00:00:00"), hasta: lunes } });
  });

  it("en domingo: desde el lunes anterior, no desde hace siete días", () => {
    const domingo = j("2026-09-20T22:15:00");
    expect(semana(domingo).periodo.desde).toBe(j("2026-09-14T00:00:00"));
  });

  it("el domingo a las 23:59 de Juárez sigue siendo esa semana aunque en UTC ya sea lunes", () => {
    const tarde = j("2026-09-20T23:59:00");
    expect(semana(tarde).periodo.desde).toBe(j("2026-09-14T00:00:00"));
  });

  it("la zona es la de la cuenta: el lunes de Tijuana empieza una hora después que el de Juárez", () => {
    // 15 sep 2026 09:00 en Juárez (UTC-6) = 08:00 en Tijuana (UTC-7): mismo martes.
    const ahora = j("2026-09-15T09:00:00");
    const tijuana = semana(ahora, "America/Tijuana").periodo.desde;
    expect(tijuana).toBe(Date.parse("2026-09-14T00:00:00-07:00"));
    expect(tijuana - semana(ahora).periodo.desde).toBe(60 * 60_000);
  });

  it("no existe «Últimos 7 días»", () => {
    expect(atajosDeTiempo(j("2026-09-17T10:00:00"), JUAREZ).map((a) => a.nombre)).toEqual([
      "Hoy",
      "Ayer",
      "Esta semana",
      "Este mes",
    ]);
  });
});

describe("la dirección y el atajo activo", () => {
  const ahora = j("2026-09-18T10:00:00");

  it("sin ventana en la dirección, el atajo por omisión de quien pregunta", () => {
    expect(periodoDeLaDireccion(undefined, undefined, ahora, { zona: JUAREZ, porOmision: 1 })).toEqual(
      atajosDeTiempo(ahora, JUAREZ)[1]!.periodo,
    );
  });

  it("reconoce el atajo aunque el «hasta ahora» se haya movido unos segundos", () => {
    const hoy = { desde: j("2026-09-18T00:00:00"), hasta: ahora - 20_000 };
    expect(atajoDelPeriodo(hoy, ahora, JUAREZ)).toBe("Hoy");
    expect(atajoDelPeriodo({ desde: j("2026-09-18T06:00:00"), hasta: ahora }, ahora, JUAREZ)).toBeNull();
  });

  it("la etiqueta habla en la zona que se le da", () => {
    const ayer = atajosDeTiempo(ahora, JUAREZ)[1]!.periodo;
    expect(etiquetaDelPeriodo(ayer, ahora, JUAREZ)).toBe("jue 17 sep · todo el día");
  });
});
