import { describe, it, expect } from "vitest";
import {
  construirDia,
  construirDias,
  posicionEnFranja,
  REGLAS_POR_DEFECTO,
  type PuntoDeUnidad,
} from "./historial-unidad";

const TZ = "America/Ciudad_Juarez";

/** Un punto a `minuto` minutos del arranque, en la posición dada. */
function punto(
  base: Date,
  minuto: number,
  lat: number,
  lng: number,
  imei = "equipo-1",
): PuntoDeUnidad {
  return {
    recordedAt: new Date(base.getTime() + minuto * 60_000),
    latitude: lat,
    longitude: lng,
    imei,
  };
}

/** 2026-07-22, 00:00 hora de Juárez (UTC-6). */
const ARRANQUE = new Date("2026-07-22T06:00:00Z");
const FIN = new Date("2026-07-23T06:00:00Z");

/** ~0.0009° de latitud ≈ 100 m. Sirve para quedarse dentro del radio. */
const CIEN_METROS = 0.0009;

describe("un hueco es ausencia de observación, no un estado de la unidad", () => {
  it("la franja sin un solo punto es un hueco del ancho de la franja", () => {
    const dia = construirDia({
      fecha: "2026-07-22",
      desde: ARRANQUE,
      hasta: FIN,
      puntos: [],
    });

    expect(dia.segmentos).toHaveLength(1);
    expect(dia.segmentos[0]!.clase).toBe("sin_dato");
    expect(dia.minutosSinDato).toBe(24 * 60);
    expect(dia.huecoMayorMinutos).toBe(24 * 60);
    // Un hueco no tiene puntos ni kilómetros: no hay nada que afirmar.
    expect(dia.segmentos[0]!.puntos).toBe(0);
    expect(dia.segmentos[0]!.kmAproximados).toBe(0);
  });

  it("el tiempo entre el borde de la franja y el primer punto también es hueco", () => {
    const dia = construirDia({
      fecha: "2026-07-22",
      desde: ARRANQUE,
      hasta: FIN,
      puntos: [
        punto(ARRANQUE, 300, 31.7, -106.4),
        punto(ARRANQUE, 305, 31.72, -106.42),
      ],
    });

    const primero = dia.segmentos[0]!;
    expect(primero.clase).toBe("sin_dato");
    expect(primero.minutos).toBe(300);
    // Y el cierre del día, desde el último punto hasta el borde.
    const ultimo = dia.segmentos[dia.segmentos.length - 1]!;
    expect(ultimo.clase).toBe("sin_dato");
    expect(ultimo.hasta.getTime()).toBe(FIN.getTime());
  });

  it("un silencio mayor al umbral parte el día; uno menor, no", () => {
    const corto = construirDia({
      fecha: "2026-07-22",
      desde: ARRANQUE,
      hasta: new Date(ARRANQUE.getTime() + 60 * 60_000),
      puntos: [
        punto(ARRANQUE, 0, 31.7, -106.4),
        // 9 minutos: por debajo del umbral de 10, no es hueco.
        punto(ARRANQUE, 9, 31.75, -106.45),
        punto(ARRANQUE, 60, 31.8, -106.5),
      ],
    });

    // El de 9 min no parte; el de 51 min sí.
    expect(corto.huecos).toBe(1);
    expect(Math.round(corto.huecoMayorMinutos!)).toBe(51);
    expect(REGLAS_POR_DEFECTO.huecoMinutos).toBe(10);
  });
});

describe("detenida y en movimiento son observación, no juicio", () => {
  it("una hora en el mismo lugar es una detención, no doce alto seguidos", () => {
    const puntos: PuntoDeUnidad[] = [];
    // Doce lecturas de 5 min, todas dentro de 100 m del ancla.
    for (let i = 0; i <= 12; i++) {
      puntos.push(punto(ARRANQUE, i * 5, 31.7 + (i % 2) * CIEN_METROS, -106.4));
    }

    const dia = construirDia({
      fecha: "2026-07-22",
      desde: ARRANQUE,
      hasta: new Date(ARRANQUE.getTime() + 60 * 60_000),
      puntos,
    });

    const detenidas = dia.segmentos.filter((s) => s.clase === "detenida");
    expect(detenidas).toHaveLength(1);
    expect(detenidas[0]!.minutos).toBe(60);
    expect(dia.minutosDetenida).toBe(60);
  });

  it("una quietud corta no es detención: sigue siendo movimiento", () => {
    const dia = construirDia({
      fecha: "2026-07-22",
      desde: ARRANQUE,
      hasta: new Date(ARRANQUE.getTime() + 30 * 60_000),
      puntos: [
        punto(ARRANQUE, 0, 31.7, -106.4),
        // Diez minutos en el mismo lugar — por debajo de los 15 del umbral.
        punto(ARRANQUE, 5, 31.7 + CIEN_METROS * 0.5, -106.4),
        punto(ARRANQUE, 10, 31.7 + CIEN_METROS * 0.5, -106.4),
        punto(ARRANQUE, 15, 31.74, -106.44),
        punto(ARRANQUE, 20, 31.78, -106.48),
        punto(ARRANQUE, 25, 31.82, -106.52),
        punto(ARRANQUE, 30, 31.85, -106.55),
      ],
    });

    expect(dia.segmentos.every((s) => s.clase !== "detenida")).toBe(true);
    expect(dia.minutosEnMovimiento).toBe(30);
  });

  it("la tira no deja huecos: los segmentos se tocan de borde a borde", () => {
    const puntos: PuntoDeUnidad[] = [];
    for (let i = 0; i <= 8; i++) puntos.push(punto(ARRANQUE, i * 5, 31.7, -106.4));
    for (let i = 1; i <= 6; i++) {
      puntos.push(punto(ARRANQUE, 40 + i * 5, 31.7 + i * 0.02, -106.4 + i * 0.02));
    }

    const dia = construirDia({
      fecha: "2026-07-22",
      desde: ARRANQUE,
      hasta: new Date(ARRANQUE.getTime() + 70 * 60_000),
      puntos,
    });

    for (let i = 1; i < dia.segmentos.length; i++) {
      expect(dia.segmentos[i]!.desde.getTime()).toBe(dia.segmentos[i - 1]!.hasta.getTime());
    }
    expect(dia.segmentos[0]!.desde.getTime()).toBe(ARRANQUE.getTime());
  });
});

describe("los kilómetros son aproximados y el descarte se cuenta", () => {
  it("un salto imposible del equipo se descarta y queda registrado", () => {
    const dia = construirDia({
      fecha: "2026-07-22",
      desde: ARRANQUE,
      hasta: new Date(ARRANQUE.getTime() + 10 * 60_000),
      puntos: [
        punto(ARRANQUE, 0, 31.7, -106.4),
        // Un minuto después, a 90 km: 5 400 km/h. Eso no es un camión.
        punto(ARRANQUE, 1, 32.5, -106.4),
        punto(ARRANQUE, 2, 32.5, -106.4),
      ],
    });

    expect(dia.saltosDescartados).toBe(1);
    // El tramo descartado no suma: la distancia queda por debajo de la real,
    // y por eso el número se muestra siempre como aproximado.
    expect(dia.kmAproximados).toBeLessThan(1);
  });

  it("cuenta los equipos distintos que reportaron por la misma unidad", () => {
    const dia = construirDia({
      fecha: "2026-07-22",
      desde: ARRANQUE,
      hasta: new Date(ARRANQUE.getTime() + 20 * 60_000),
      puntos: [
        punto(ARRANQUE, 0, 31.7, -106.4, "equipo-1"),
        punto(ARRANQUE, 5, 31.72, -106.42, "equipo-2"),
      ],
    });

    expect(dia.equipos).toBe(2);
  });
});

describe("un rango de días son N tiras comparables, no una tira larga", () => {
  it("devuelve un día por fecha pedida, en el orden pedido", () => {
    const dias = construirDias({
      fechas: ["2026-07-22", "2026-07-23"],
      minutosDesde: 0,
      minutosHasta: 0,
      timeZone: TZ,
      puntos: [punto(ARRANQUE, 60, 31.7, -106.4)],
    });

    expect(dias.map((d) => d.fecha)).toEqual(["2026-07-22", "2026-07-23"]);
    expect(dias[0]!.puntos).toBe(1);
  });

  it("un día sin un solo punto aparece igual, entero sin dato", () => {
    const dias = construirDias({
      fechas: ["2026-07-22", "2026-07-23"],
      minutosDesde: 0,
      minutosHasta: 0,
      timeZone: TZ,
      puntos: [punto(ARRANQUE, 60, 31.7, -106.4)],
    });

    // Omitirlo se leería como un día que no existió.
    expect(dias[1]!.puntos).toBe(0);
    expect(dias[1]!.minutosSinDato).toBe(24 * 60);
  });

  it("el turno de noche pertenece al día en que empezó, aunque cierre al siguiente", () => {
    // 22:00 del 22 a 06:00 del 23 — la franja cruza medianoche.
    const dias = construirDias({
      fechas: ["2026-07-22"],
      minutosDesde: 22 * 60,
      minutosHasta: 6 * 60,
      timeZone: TZ,
      // 02:00 del 23 de julio, hora de Juárez: dentro del turno del 22.
      puntos: [
        punto(new Date("2026-07-23T08:00:00Z"), 0, 31.7, -106.4),
        punto(new Date("2026-07-23T08:00:00Z"), 8, 31.74, -106.44),
      ],
    });

    expect(dias).toHaveLength(1);
    expect(dias[0]!.puntos).toBe(2);
    // La franja del turno mide 8 h y hubo observación dentro: no puede ser
    // un día entero sin dato, que es como se leía antes de asignar bien.
    expect(dias[0]!.minutosSinDato).toBeLessThan(8 * 60);
    expect(dias[0]!.minutosEnMovimiento).toBe(8);
  });

  it("un punto aislado no inventa un tramo: cuenta como punto, no como tiempo", () => {
    const dias = construirDias({
      fechas: ["2026-07-22"],
      minutosDesde: 0,
      minutosHasta: 0,
      timeZone: TZ,
      puntos: [punto(ARRANQUE, 300, 31.7, -106.4)],
    });

    expect(dias[0]!.puntos).toBe(1);
    // Un punto no cubre tiempo, así que no hay tramo de duración cero en la
    // tira — pero el día tampoco pretende haberlo observado.
    expect(dias[0]!.segmentos.every((s) => s.minutos > 0)).toBe(true);
    expect(dias[0]!.minutosEnMovimiento).toBe(0);
  });
});

describe("posicionEnFranja", () => {
  it("mapea el instante a su porcentaje dentro de la franja", () => {
    const mitad = new Date(ARRANQUE.getTime() + 12 * 60 * 60_000);
    expect(posicionEnFranja(ARRANQUE, ARRANQUE, FIN)).toBe(0);
    expect(posicionEnFranja(mitad, ARRANQUE, FIN)).toBe(50);
    expect(posicionEnFranja(FIN, ARRANQUE, FIN)).toBe(100);
  });

  it("recorta lo que cae fuera en vez de desbordar la tira", () => {
    const antes = new Date(ARRANQUE.getTime() - 60 * 60_000);
    const despues = new Date(FIN.getTime() + 60 * 60_000);
    expect(posicionEnFranja(antes, ARRANQUE, FIN)).toBe(0);
    expect(posicionEnFranja(despues, ARRANQUE, FIN)).toBe(100);
  });
});
