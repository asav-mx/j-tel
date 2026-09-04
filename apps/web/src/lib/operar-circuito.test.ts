import { describe, it, expect } from "vitest";
import { armarOperacion, type UnidadDelPlan } from "./operar-circuito";
import type { TrazadoDeSentido } from "@jtel/domain/publico";

/*
 * Un tramo recto de avenida como circuito. La geometría ya tiene sus pruebas en
 * el dominio; lo que se prueba aquí es el REPARTO — qué unidad cae en qué cajón
 * y qué se puede afirmar de cada una.
 */
const TRAZADOS: TrazadoDeSentido[] = [
  {
    sentido: "ida",
    coordinates: [
      [-106.45, 31.71],
      [-106.44, 31.71],
    ],
  },
];

/** Mediodía en Ciudad Juárez, con el circuito abierto de 05:00 a 23:00. */
const AHORA = new Date("2026-08-29T18:00:00.000Z");

const CIRCUITO = {
  /** Sin fecha de arranque: el circuito ya opera, que es el caso de siempre. */
  serviceLaunchDate: null as string | null,
  serviceStartLocal: "05:00",
  serviceEndLocal: "23:00",
  timeZone: "America/Ciudad_Juarez",
  corridorToleranceMeters: 150,
  staleAfterSeconds: 180,
  serviceConfidenceMinutes: 15,
};

const PARADAS = [{ name: "Terminal Oriente", latitude: 31.71, longitude: -106.4499 }];

let n = 0;
function unidad(parcial: Partial<UnidadDelPlan> = {}): UnidadDelPlan {
  n += 1;
  return {
    assignmentId: `a-${n}`,
    unitId: `u-${n}`,
    unitLabel: `${10_000 + n}`,
    plateNumber: null,
    carrierAccountId: "carrier-1",
    carrierName: "Transportista de prueba",
    assignedFrom: new Date("2026-08-01T00:00:00.000Z"),
    latitude: null,
    longitude: null,
    heading: null,
    recordedAt: null,
    ...parcial,
  };
}

/** Sobre la avenida, con `hace` segundos de antigüedad. */
const enLaRuta = (hace: number, extra: Partial<UnidadDelPlan> = {}) =>
  unidad({
    latitude: 31.71,
    longitude: -106.445,
    recordedAt: new Date(AHORA.getTime() - hace * 1000),
    ...extra,
  });

/** A nueve kilómetros del trazado — el patio, el taller, otra ruta. */
const lejos = (hace: number, extra: Partial<UnidadDelPlan> = {}) =>
  unidad({
    latitude: 31.63,
    longitude: -106.445,
    recordedAt: new Date(AHORA.getTime() - hace * 1000),
    ...extra,
  });

const armar = (plan: UnidadDelPlan[], circuito = CIRCUITO) =>
  armarOperacion({ ahora: AHORA, circuito, trazados: TRAZADOS, paradas: PARADAS, plan });

describe("el número grande y su denominador", () => {
  it("cuenta EN RUTA sobre el plan entero: 3 de 5", () => {
    const op = armar([
      enLaRuta(30),
      enLaRuta(45),
      enLaRuta(60),
      enLaRuta(900), // en el corredor pero callada
      lejos(10), // reportando desde lejos
    ]);
    expect(op.enRuta).toBe(3);
    expect(op.enElPlan).toBe(5);
  });

  it("las situaciones reparten el plan ENTERO, sin traslape ni sobrantes", () => {
    const op = armar([enLaRuta(30), enLaRuta(900), lejos(10), unidad()]);
    const cuenta = (s: string) => op.unidades.filter((u) => u.situacion === s).length;
    expect(cuenta("en_ruta")).toBe(1);
    expect(cuenta("sin_senal")).toBe(1);
    expect(cuenta("no_ha_salido")).toBe(2);
    expect(cuenta("en_ruta") + cuenta("sin_senal") + cuenta("no_ha_salido")).toBe(op.enElPlan);
  });

  it("el plan vacío no inventa nada: 0 de 0 y sin nada que atender", () => {
    const op = armar([]);
    expect(op.enRuta).toBe(0);
    expect(op.enElPlan).toBe(0);
    expect(op.atencion).toEqual([]);
    expect(op.estado).toBe("sin_evidencia");
  });
});

describe("el número grande NUNCA se separa del que ve el pasajero", () => {
  it("con al menos una en ruta, el circuito está en vivo", () => {
    const op = armar([enLaRuta(30), lejos(1)]);
    expect(op.enRuta).toBe(1);
    expect(op.estado).toBe("en_vivo");
  });

  it("EL CAMIÓN DEL PATIO: fresquísimo y lejos no cuenta para ninguno de los dos", () => {
    const op = armar([lejos(1), lejos(2)]);
    expect(op.enRuta).toBe(0);
    expect(op.estado).toBe("sin_evidencia");
  });

  it("cero en ruta y una vista hace rato en el corredor: por horario, y el número es 0", () => {
    const op = armar([enLaRuta(600)]);
    expect(op.enRuta).toBe(0);
    expect(op.estado).toBe("por_horario");
  });

  it("las unidades SIN una sola señal no empujan la escalera", () => {
    /*
     * Es la trampa que este archivo existe para no caer: cinco unidades
     * asignadas y ninguna reportando no es «hay servicio». La asignación es
     * plan, no evidencia.
     */
    const op = armar([unidad(), unidad(), unidad(), unidad(), unidad()]);
    expect(op.enElPlan).toBe(5);
    expect(op.estado).toBe("sin_evidencia");
    expect(op.atencion).toHaveLength(5);
  });
});

describe("los dos problemas distintos", () => {
  it("SIN SEÑAL: estaba en el corredor y dejó de reportar — conserva dónde y cuándo", () => {
    const u = armar([enLaRuta(2400)]).unidades[0];
    expect(u.situacion).toBe("sin_senal");
    expect(u.medida?.enCorredor).toBe(true);
    expect(u.medida?.fresco).toBe(false);
    expect(u.medida?.antiguedadSeg).toBe(2400);
    expect(u.recordedAt).not.toBeNull();
    expect(u.paradaMasCercana?.name).toBe("Terminal Oriente");
  });

  it("NO HA SALIDO con señal: su GPS la ve, y se puede decir a cuánto del corredor", () => {
    const u = armar([lejos(10)]).unidades[0];
    expect(u.situacion).toBe("no_ha_salido");
    expect(u.medida?.enCorredor).toBe(false);
    expect(u.distanciaAlCorredorMetros).toBeGreaterThan(8_000);
  });

  it("NO HA SALIDO sin señal: no se finge una distancia ni una hora", () => {
    const u = armar([unidad()]).unidades[0];
    expect(u.situacion).toBe("no_ha_salido");
    expect(u.medida).toBeNull();
    expect(u.distanciaAlCorredorMetros).toBeNull();
    expect(u.paradaMasCercana).toBeNull();
    expect(u.recordedAt).toBeNull();
  });

  it("una unidad callada desde hace meses sigue siendo del plan y sigue enunciándose", () => {
    /*
     * El caso de las unidades que se asignaron para probar la asignación y no
     * reportan. No es un hallazgo ni una falla del circuito: es el estado del
     * mundo, y la pantalla lo dice sin adjetivos.
     */
    const hace3meses = new Date(AHORA.getTime() - 90 * 24 * 3600 * 1000);
    const op = armar([lejos(0, { recordedAt: hace3meses })]);
    expect(op.unidades[0].situacion).toBe("no_ha_salido");
    expect(op.unidades[0].medida?.antiguedadSeg).toBe(90 * 24 * 3600);
    expect(op.enElPlan).toBe(1);
  });

  it("sin nada que atender, la lista de atención va vacía y la sección no se dibuja", () => {
    expect(armar([enLaRuta(30), enLaRuta(31)]).atencion).toEqual([]);
  });
});

describe("fuera de horario", () => {
  const cerrado = { ...CIRCUITO, serviceStartLocal: "23:00", serviceEndLocal: "23:30" };

  it("con el circuito cerrado nadie «no ha salido»: no se reprocha un horario que no existe", () => {
    const op = armar([lejos(10), unidad(), enLaRuta(900)], cerrado);
    expect(op.enHorario).toBe(false);
    expect(op.estado).toBe("fuera_de_horario");
    expect(op.unidades.every((u) => u.situacion === "fuera_de_horario")).toBe(true);
    expect(op.atencion).toEqual([]);
  });

  it("ni siquiera una fresca sobre la ruta cuenta como en ruta con el circuito cerrado", () => {
    // El camión que regresa al patio pasando por la avenida.
    const op = armar([enLaRuta(30)], cerrado);
    expect(op.enRuta).toBe(0);
  });
});

describe("los umbrales son del circuito, ninguno horneado", () => {
  it("mover la frescura mueve el número grande", () => {
    const plan = [enLaRuta(300)];
    expect(armar(plan).enRuta).toBe(0);
    expect(armar(plan, { ...CIRCUITO, staleAfterSeconds: 600 }).enRuta).toBe(1);
  });

  it("mover el corredor mueve quién está dentro", () => {
    const aMedioCuadra = unidad({
      latitude: 31.7105,
      longitude: -106.445,
      recordedAt: AHORA,
    });
    expect(armar([aMedioCuadra]).unidades[0].situacion).toBe("en_ruta");
    expect(
      armar([aMedioCuadra], { ...CIRCUITO, corridorToleranceMeters: 25 }).unidades[0].situacion,
    ).toBe("no_ha_salido");
  });
});

describe("el circuito que todavía no arranca", () => {
  /** El mismo circuito, pero declarado para arrancar quince días después. */
  const PORARRANCAR = { ...CIRCUITO, serviceLaunchDate: "2026-09-15" };
  const armarSinArrancar = (plan: UnidadDelPlan[]) =>
    armarOperacion({
      ahora: AHORA, // 29 de agosto: faltan diecisiete días
      circuito: PORARRANCAR,
      trazados: TRAZADOS,
      paradas: PARADAS,
      plan,
    });

  it("NADIE cae en «no ha salido» — eso sería un reproche antes de que exista el servicio", () => {
    const op = armarSinArrancar([enLaRuta(30), enLaRuta(900), lejos(10), unidad()]);
    expect(op.unidades.every((u) => u.situacion === "por_arrancar")).toBe(true);
    expect(op.unidades.filter((u) => u.situacion === "no_ha_salido")).toHaveLength(0);
  });

  it("LA SECCIÓN DE ATENCIÓN QUEDA VACÍA, que es el ruido que esto apaga", () => {
    /*
     * Sin la fecha, estas cuatro unidades llenaban la caja ámbar de «qué
     * necesita atención» tres semanas antes del arranque. No hay nada que
     * atender: el servicio no ha empezado.
     */
    const op = armarSinArrancar([enLaRuta(900), lejos(10), unidad(), unidad()]);
    expect(op.atencion).toHaveLength(0);
  });

  it("el estado del circuito es POR ARRANCAR, aunque haya una unidad en ruta", () => {
    const op = armarSinArrancar([enLaRuta(30)]);
    expect(op.estado).toBe("por_arrancar");
    expect(op.yaArranco).toBe(false);
    // Y el número grande no cuenta a nadie: la pantalla no dibuja «0 de 1».
    expect(op.enRuta).toBe(0);
    expect(op.enElPlan).toBe(1);
  });

  it("NO HAY APERTURA DE JORNADA, aunque el reloj caiga dentro del horario", () => {
    // Son las 12:00 y el circuito abre a las 05:00, pero la jornada no empezó:
    // «desde que abrió, hace 7 h» mediría una jornada que no existe.
    const op = armarSinArrancar([]);
    expect(op.enHorario).toBe(true);
    expect(op.aperturaDelHorario).toBeNull();
  });

  it("pasada la fecha, el reparto vuelve a ser el de siempre", () => {
    const yaArrancado = { ...CIRCUITO, serviceLaunchDate: "2026-08-01" };
    const op = armarOperacion({
      ahora: AHORA,
      circuito: yaArrancado,
      trazados: TRAZADOS,
      paradas: PARADAS,
      plan: [enLaRuta(30), lejos(10)],
    });
    expect(op.yaArranco).toBe(true);
    expect(op.enRuta).toBe(1);
    expect(op.unidades[1].situacion).toBe("no_ha_salido");
  });

  it("EL DÍA MISMO ya arrancó: el borde se decide, no se deja al azar", () => {
    const hoyMismo = { ...CIRCUITO, serviceLaunchDate: "2026-08-29" };
    const op = armarOperacion({
      ahora: AHORA, // 29 de agosto, 12:00 en Juárez
      circuito: hoyMismo,
      trazados: TRAZADOS,
      paradas: PARADAS,
      plan: [enLaRuta(30)],
    });
    expect(op.yaArranco).toBe(true);
    expect(op.estado).toBe("en_vivo");
  });
});

describe("sin trazado cargado", () => {
  it("no se afirma distancia ni corredor: el circuito sin KML no puede decir dónde va nadie", () => {
    const op = armarOperacion({
      ahora: AHORA,
      circuito: CIRCUITO,
      trazados: [],
      paradas: [],
      plan: [enLaRuta(30)],
    });
    expect(op.unidades[0].distanciaAlCorredorMetros).toBeNull();
    expect(op.unidades[0].situacion).toBe("no_ha_salido");
    expect(op.enRuta).toBe(0);
    expect(op.estado).toBe("sin_evidencia");
  });
});

describe("la apertura del horario es del CIRCUITO, y aguanta la medianoche", () => {
  it("con el circuito abierto, dice a qué hora abrió hoy", () => {
    // AHORA son las 12:00 en Ciudad Juárez; el circuito abre a las 05:00.
    const op = armar([]);
    expect(op.aperturaDelHorario?.toISOString()).toBe("2026-08-29T11:00:00.000Z");
    expect((AHORA.getTime() - op.aperturaDelHorario!.getTime()) / 3_600_000).toBe(7);
  });

  it("SERVICIO NOCTURNO: a las 02:00 con ventana 22:00–06:00, abrió AYER", () => {
    /*
     * Tomar la apertura de hoy daría una duración negativa —«abrió en 20 h»—
     * dibujada como si el turno todavía no empezara, justo en el turno donde
     * más falta hace saberlo.
     */
    const madrugada = new Date("2026-08-29T08:00:00.000Z"); // 02:00 en Juárez
    const nocturno = { ...CIRCUITO, serviceStartLocal: "22:00", serviceEndLocal: "06:00" };
    const op = armarOperacion({
      ahora: madrugada,
      circuito: nocturno,
      trazados: TRAZADOS,
      paradas: PARADAS,
      plan: [],
    });
    expect(op.enHorario).toBe(true);
    expect(op.aperturaDelHorario?.toISOString()).toBe("2026-08-29T04:00:00.000Z");
    expect(op.aperturaDelHorario!.getTime()).toBeLessThan(madrugada.getTime());
  });

  it("con el circuito cerrado no hay apertura que enseñar", () => {
    const op = armar([], { ...CIRCUITO, serviceStartLocal: "23:00", serviceEndLocal: "23:30" });
    expect(op.aperturaDelHorario).toBeNull();
  });
});

describe("cuándo el nombre del transportista distingue algo", () => {
  it("un solo transportista: el nombre no distingue, y el renglón no lo gasta", () => {
    expect(armar([enLaRuta(30), enLaRuta(60), lejos(10)]).variosTransportistas).toBe(false);
  });

  it("dos transportistas: sí distingue, y entonces es información", () => {
    const op = armar([
      enLaRuta(30, { carrierAccountId: "carrier-1", carrierName: "Uno" }),
      enLaRuta(60, { carrierAccountId: "carrier-2", carrierName: "Dos" }),
    ]);
    expect(op.variosTransportistas).toBe(true);
  });

  it("se cuenta por CUENTA, no por nombre: dos que se llamen igual son dos", () => {
    /*
     * Es §D en chico: contar rótulos en vez de cuentas fundiría a dos
     * transportistas homónimos en uno, y el renglón dejaría de decir de quién
     * es el camión justo donde hace falta.
     */
    const op = armar([
      enLaRuta(30, { carrierAccountId: "carrier-1", carrierName: "Transportes del Norte" }),
      enLaRuta(60, { carrierAccountId: "carrier-2", carrierName: "Transportes del Norte" }),
    ]);
    expect(op.variosTransportistas).toBe(true);
  });

  it("el plan vacío no afirma nada", () => {
    expect(armar([]).variosTransportistas).toBe(false);
  });
});
