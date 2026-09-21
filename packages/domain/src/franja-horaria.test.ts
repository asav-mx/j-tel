import { describe, it, expect } from "vitest";
import {
  franjaDentroDelHorario,
  validarFranjas,
  promesaEnInstante,
  promesaAhora,
  proximaFronteraDeLoPublicado,
  explicarRechazoFranja,
  type FranjaCapturada,
} from "./franja-horaria.js";

const HORARIO_OASIS = { inicioLocal: "05:00", finLocal: "23:00" };

function franja(partial: Partial<FranjaCapturada> & Pick<FranjaCapturada, "desdeLocal" | "hastaLocal">): FranjaCapturada {
  return {
    diaTipo: "entre_semana",
    sentido: null,
    frequencyMinutes: 20,
    ...partial,
  };
}

describe("franjaDentroDelHorario", () => {
  it("una franja completa dentro del horario cabe", () => {
    expect(franjaDentroDelHorario({ desdeLocal: "06:00", hastaLocal: "09:00" }, "05:00", "23:00")).toBe(true);
  });

  it("una franja que empieza antes de que abra el circuito se rechaza ENTERA", () => {
    // Aunque termine dentro del horario — aceptar el pedazo sería inventar.
    expect(franjaDentroDelHorario({ desdeLocal: "04:30", hastaLocal: "09:00" }, "05:00", "23:00")).toBe(false);
  });

  it("una franja que termina después del cierre se rechaza", () => {
    expect(franjaDentroDelHorario({ desdeLocal: "22:00", hastaLocal: "23:30" }, "05:00", "23:00")).toBe(false);
  });

  it("los bordes exactos del horario sí caben", () => {
    expect(franjaDentroDelHorario({ desdeLocal: "05:00", hastaLocal: "23:00" }, "05:00", "23:00")).toBe(true);
  });

  it("horario nocturno (cruza medianoche): una franja de la noche cabe", () => {
    expect(franjaDentroDelHorario({ desdeLocal: "23:00", hastaLocal: "23:59" }, "22:00", "06:00")).toBe(true);
  });

  it("horario nocturno: una franja de la madrugada cabe", () => {
    expect(franjaDentroDelHorario({ desdeLocal: "00:00", hastaLocal: "05:00" }, "22:00", "06:00")).toBe(true);
  });

  it("horario nocturno: una franja del mediodía NO cabe", () => {
    expect(franjaDentroDelHorario({ desdeLocal: "12:00", hastaLocal: "13:00" }, "22:00", "06:00")).toBe(false);
  });

  it("servicio 24 horas: todo cabe", () => {
    expect(franjaDentroDelHorario({ desdeLocal: "03:00", hastaLocal: "03:30" }, "00:00", "00:00")).toBe(true);
  });

  it("una franja que ella misma cruza medianoche se rechaza — no es el alcance de esta versión", () => {
    expect(franjaDentroDelHorario({ desdeLocal: "23:00", hastaLocal: "01:00" }, "22:00", "06:00")).toBe(false);
  });
});

describe("validarFranjas", () => {
  it("Oasis–Centro: cada 10 min de 6 a 9, cada 20 el resto del día — el ejemplo del Marco", () => {
    const franjas = [
      franja({ desdeLocal: "06:00", hastaLocal: "09:00", frequencyMinutes: 10 }),
      franja({ desdeLocal: "09:00", hastaLocal: "23:00", frequencyMinutes: 20 }),
      franja({ desdeLocal: "05:00", hastaLocal: "06:00", frequencyMinutes: 30 }),
    ];
    const { validas, rechazadas } = validarFranjas(franjas, HORARIO_OASIS);
    expect(validas).toHaveLength(3);
    expect(rechazadas).toHaveLength(0);
  });

  it("rechaza la que cae fuera del horario, y guarda las demás", () => {
    const franjas = [
      franja({ desdeLocal: "06:00", hastaLocal: "09:00" }),
      franja({ desdeLocal: "23:30", hastaLocal: "23:59" }), // fuera: el circuito cierra a las 23:00
    ];
    const { validas, rechazadas } = validarFranjas(franjas, HORARIO_OASIS);
    expect(validas).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0]!.motivo).toBe("fuera_de_horario_de_servicio");
  });

  it("rechaza dos franjas que se traslapan el mismo día", () => {
    const franjas = [
      franja({ desdeLocal: "06:00", hastaLocal: "10:00" }),
      franja({ desdeLocal: "09:00", hastaLocal: "12:00" }), // se traslapa 9-10 con la anterior
    ];
    const { validas, rechazadas } = validarFranjas(franjas, HORARIO_OASIS);
    expect(validas).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0]!.motivo).toBe("se_encima_con_otra");
  });

  it("NO rechaza franjas contiguas — que terminen donde empieza la siguiente está bien", () => {
    const franjas = [
      franja({ desdeLocal: "06:00", hastaLocal: "09:00" }),
      franja({ desdeLocal: "09:00", hastaLocal: "12:00" }),
    ];
    const { validas, rechazadas } = validarFranjas(franjas, HORARIO_OASIS);
    expect(validas).toHaveLength(2);
    expect(rechazadas).toHaveLength(0);
  });

  it("misma hora, días distintos, no se traslapan", () => {
    const franjas = [
      franja({ desdeLocal: "06:00", hastaLocal: "09:00", diaTipo: "entre_semana" }),
      franja({ desdeLocal: "06:00", hastaLocal: "09:00", diaTipo: "sabado" }),
    ];
    const { validas } = validarFranjas(franjas, HORARIO_OASIS);
    expect(validas).toHaveLength(2);
  });

  it("una franja de 'ida' y una de 'vuelta' a la misma hora no se traslapan — son sentidos distintos", () => {
    const franjas = [
      franja({ desdeLocal: "06:00", hastaLocal: "09:00", sentido: "ida" }),
      franja({ desdeLocal: "06:00", hastaLocal: "09:00", sentido: "vuelta" }),
    ];
    const { validas, rechazadas } = validarFranjas(franjas, HORARIO_OASIS);
    expect(validas).toHaveLength(2);
    expect(rechazadas).toHaveLength(0);
  });

  it("una franja de 'ida' SÍ se traslapa con una de los dos sentidos (null) a la misma hora", () => {
    const franjas = [
      franja({ desdeLocal: "06:00", hastaLocal: "09:00", sentido: null }),
      franja({ desdeLocal: "06:00", hastaLocal: "09:00", sentido: "ida" }),
    ];
    const { validas, rechazadas } = validarFranjas(franjas, HORARIO_OASIS);
    expect(validas).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0]!.motivo).toBe("se_encima_con_otra");
  });
});

describe("promesaEnInstante", () => {
  const franjas = [
    franja({ desdeLocal: "06:00", hastaLocal: "09:00", frequencyMinutes: 10 }),
    franja({ desdeLocal: "09:00", hastaLocal: "23:00", frequencyMinutes: 20 }),
  ];

  it("la hora pico da su propia frecuencia — el ejemplo del Marco §D", () => {
    expect(promesaEnInstante(franjas, { diaTipo: "entre_semana", horaLocal: "07:30", sentido: "ida" })).toEqual({
      declarada: true,
      frequencyMinutes: 10,
      franja: franjas[0],
    });
  });

  it("el valle da la suya, no el promedio del día", () => {
    const r = promesaEnInstante(franjas, { diaTipo: "entre_semana", horaLocal: "14:00", sentido: "ida" });
    expect(r).toMatchObject({ declarada: true, frequencyMinutes: 20 });
  });

  it("un hueco que ninguna franja cubre dice 'sin promesa declarada' — no se rellena con la vecina", () => {
    // Sólo hay franjas de 6 a 23; las 3 de la madrugada no las cubre ninguna.
    const r = promesaEnInstante(franjas, { diaTipo: "entre_semana", horaLocal: "03:00", sentido: "ida" });
    expect(r).toEqual({ declarada: false });
  });

  it("un sábado sin tabla propia no hereda la de entre semana — es la decisión 2", () => {
    const r = promesaEnInstante(franjas, { diaTipo: "sabado", horaLocal: "07:30", sentido: "ida" });
    expect(r).toEqual({ declarada: false });
  });

  it("una franja sin sentido declarado (null) promete igual a ida y a vuelta", () => {
    const ambosSentidos = [franja({ desdeLocal: "06:00", hastaLocal: "09:00", sentido: null })];
    expect(promesaEnInstante(ambosSentidos, { diaTipo: "entre_semana", horaLocal: "07:00", sentido: "ida" }).declarada).toBe(true);
    expect(promesaEnInstante(ambosSentidos, { diaTipo: "entre_semana", horaLocal: "07:00", sentido: "vuelta" }).declarada).toBe(true);
  });

  it("el borde de salida de una franja ya NO cuenta — [desde, hasta)", () => {
    const r = promesaEnInstante(franjas, { diaTipo: "entre_semana", horaLocal: "09:00", sentido: "ida" });
    // Las 9:00 en punto ya es la segunda franja, no la primera.
    expect(r).toMatchObject({ declarada: true, frequencyMinutes: 20 });
  });
});

describe("explicarRechazoFranja", () => {
  it("las dos razones se leen sin conocer el código", () => {
    for (const motivo of ["fuera_de_horario_de_servicio", "se_encima_con_otra"] as const) {
      const texto = explicarRechazoFranja({
        franja: franja({ desdeLocal: "06:00", hastaLocal: "09:00" }),
        motivo,
      });
      expect(texto.length).toBeGreaterThan(20);
      expect(texto).not.toContain("_");
    }
  });
});

describe("promesaAhora — lo que se le dice al pasajero en este momento (8.2)", () => {
  const ZONA = "America/Ciudad_Juarez";
  // Lunes 21 sep 2026. Juárez es UTC-6: 13:00Z = 07:00 local, 17:00Z = 11:00 local.
  const picoLunes = new Date("2026-09-21T13:00:00Z");
  const valleLunes = new Date("2026-09-21T17:00:00Z");
  const noche = new Date("2026-09-22T04:00:00Z"); // 22:00 local
  const pico: FranjaCapturada = { diaTipo: "entre_semana", sentido: null, desdeLocal: "06:00", hastaLocal: "09:00", frequencyMinutes: 10 };
  const valleIda: FranjaCapturada = { diaTipo: "entre_semana", sentido: "ida", desdeLocal: "09:00", hastaLocal: "20:00", frequencyMinutes: 20 };
  const valleVuelta: FranjaCapturada = { diaTipo: "entre_semana", sentido: "vuelta", desdeLocal: "09:00", hastaLocal: "20:00", frequencyMinutes: 30 };

  it("sin promesa vigente: sin_capturar — nunca una cadencia inventada", () => {
    expect(promesaAhora(null, picoLunes, ZONA)).toEqual({ estado: "sin_capturar" });
  });

  it("la franja de los dos sentidos promete lo mismo a la ida y a la vuelta", () => {
    expect(promesaAhora([pico, valleIda, valleVuelta], picoLunes, ZONA)).toEqual({ estado: "declarada", ida: 10, vuelta: 10 });
  });

  it("por sentido cuando la tabla distingue — nunca un promedio (9.1c)", () => {
    expect(promesaAhora([pico, valleIda, valleVuelta], valleLunes, ZONA)).toEqual({ estado: "declarada", ida: 20, vuelta: 30 });
  });

  it("un sentido sin franja a esta hora dice null, no el del otro sentido", () => {
    expect(promesaAhora([pico, valleIda], valleLunes, ZONA)).toEqual({ estado: "declarada", ida: 20, vuelta: null });
  });

  it("hora que ninguna franja cubre: sin_franja — no se rellena con la vecina", () => {
    expect(promesaAhora([pico, valleIda, valleVuelta], noche, ZONA)).toEqual({ estado: "sin_franja" });
  });

  it("una promesa vacía (el concesionario dejó de declarar) es sin_franja a toda hora", () => {
    expect(promesaAhora([], picoLunes, ZONA)).toEqual({ estado: "sin_franja" });
  });
});

describe("proximaFronteraDeLoPublicado — hasta cuándo vale lo que dice la lista", () => {
  const ZONA = "America/Ciudad_Juarez"; // UTC-6
  const a07 = new Date("2026-09-21T13:00:00Z"); // 07:00 local

  it("la siguiente frontera del día: el fin de la franja del pico", () => {
    const t = proximaFronteraDeLoPublicado(["06:00", "09:00:00", "20:00"], a07, ZONA);
    expect(t.toISOString()).toBe("2026-09-21T15:00:00.000Z"); // 09:00 local
  });

  it("lo ya pasado no cuenta: después de la última, la medianoche local", () => {
    const a21 = new Date("2026-09-22T03:00:00Z"); // 21:00 local del 21
    const t = proximaFronteraDeLoPublicado(["06:00", "20:00"], a21, ZONA);
    expect(t.toISOString()).toBe("2026-09-22T06:00:00.000Z"); // 00:00 local del 22
  });

  it("sin horas, la medianoche: ahí cambia el tipo de día", () => {
    expect(proximaFronteraDeLoPublicado([], a07, ZONA).toISOString()).toBe("2026-09-22T06:00:00.000Z");
  });

  it("justo en la frontera no se queda en ella: busca la siguiente", () => {
    const a09 = new Date("2026-09-21T15:00:00Z");
    expect(proximaFronteraDeLoPublicado(["09:00", "12:00"], a09, ZONA).toISOString()).toBe("2026-09-21T18:00:00.000Z");
  });
});
