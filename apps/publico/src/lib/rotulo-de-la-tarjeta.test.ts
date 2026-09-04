import { describe, it, expect } from "vitest";
import {
  fuenteDelTitular,
  minutosDesdeQueSeVio,
  rotuloDeLaTarjeta,
  SEGUN_EL_CONCESIONARIO,
  type ModoDeLaTarjeta,
} from "./rotulo-de-la-tarjeta";

const ENVIVO = {
  conRango: true,
  hayProxima: true,
  pisoMin: 3,
  velocidadKmh: 20.5,
  velocidadMedida: false,
};

/** Con cadencia declarada, que es lo que hace suyo el titular de POR HORARIO. */
const VIVO = { hayFrecuenciaDeclarada: true, vistoHaceMin: 6, enVivo: ENVIVO };
/** Sin ella: el titular es «En servicio», y ése lo vimos nosotros. */
const MEDIDO = { hayFrecuenciaDeclarada: false, vistoHaceMin: 6, enVivo: ENVIVO };

const TODOS: ModoDeLaTarjeta[] = [
  "por_arrancar",
  "fuera_de_horario",
  "en_vivo",
  "por_horario",
  "sin_evidencia",
  "sin_conexion",
  "cargando",
];

const DECLARADOS: ModoDeLaTarjeta[] = [
  "por_arrancar",
  "fuera_de_horario",
  "sin_evidencia",
  /* Con cadencia declarada. Sin ella su titular es nuestro — ver el bloque de
     «la fuente manda sobre el estado». */
  "por_horario",
];

describe("el rótulo dice de dónde sale la afirmación", () => {
  it("todo lo declarado se atribuye al concesionario, con la MISMA copia", () => {
    /*
     * La fuente es la misma persona en los cuatro. Darle a cada uno su variante
     * —«arranque declarado», «horario declarado»— insinuaría que hay cuatro
     * fuentes distintas, y es por donde se coló la repetición del titular.
     */
    for (const modo of DECLARADOS) {
      expect(rotuloDeLaTarjeta(modo, VIVO), modo).toBe(SEGUN_EL_CONCESIONARIO);
    }
  });

  it("NO REPITE LO QUE EL TITULAR YA DICE — la valla de esta regla", () => {
    /*
     * Los sustantivos que el titular y la frase ya dicen en estos estados:
     * «Arranca 15 sep», «Abre 05:00», «05:00 a 23:00», «Cada 20 min». Si
     * alguno vuelve al rótulo, esto se cae — que es lo único que impide que la
     * corrección de hoy se deshaga sola dentro de tres pantallas.
     */
    for (const modo of DECLARADOS) {
      const r = rotuloDeLaTarjeta(modo, VIVO).toLowerCase();
      expect(r, modo).not.toContain("horario");
      expect(r, modo).not.toContain("frecuencia");
      expect(r, modo).not.toContain("arranque");
    }
  });

  it("pero la ATRIBUCIÓN se queda: sin ella la app afirma con su propia autoridad", () => {
    // Acortar no es callar de dónde viene. El horario no lo medimos nosotros.
    for (const modo of DECLARADOS) {
      expect(rotuloDeLaTarjeta(modo, VIVO).toLowerCase(), modo).toContain("concesionario");
    }
  });

  it("lo que no se pudo preguntar no se le atribuye a nadie", () => {
    /*
     * Sin conexión no hay afirmación sobre el servicio, así que no hay fuente.
     * Decir «según el concesionario» ahí le colgaría a él un silencio que es
     * nuestro.
     */
    expect(rotuloDeLaTarjeta("sin_conexion", VIVO)).toBe("Sin conexión");
    expect(rotuloDeLaTarjeta("cargando", VIVO)).toBe("Consultando…");
    for (const modo of ["sin_conexion", "cargando"] as ModoDeLaTarjeta[]) {
      expect(rotuloDeLaTarjeta(modo, VIVO).toLowerCase()).not.toContain("concesionario");
    }
  });

  it("EN VIVO nombra el instrumento, con sus números", () => {
    expect(rotuloDeLaTarjeta("en_vivo", VIVO)).toBe("En vivo · ±3 min · 20.5 km/h declarados");
    expect(
      rotuloDeLaTarjeta("en_vivo", { ...VIVO, enVivo: { ...ENVIVO, velocidadMedida: true } }),
    ).toContain("medidos");
  });

  it("«medidos» y «declarados» no son sinónimos, y el rótulo los distingue", () => {
    // Una velocidad declarada es un punto de partida, no una medición de esta
    // calle: es el motivo por el que el tiempo estimado nace apagado.
    const medida = rotuloDeLaTarjeta("en_vivo", {
      ...VIVO,
      enVivo: { ...ENVIVO, velocidadMedida: true },
    });
    const declarada = rotuloDeLaTarjeta("en_vivo", VIVO);
    expect(medida).not.toBe(declarada);
  });

  it("sin permiso de rango, EN VIVO no promete un tiempo ni lo insinúa", () => {
    expect(
      rotuloDeLaTarjeta("en_vivo", { ...VIVO, enVivo: { ...ENVIVO, conRango: false } }),
    ).toBe("En vivo · sin tiempo estimado");
    expect(
      rotuloDeLaTarjeta("en_vivo", { ...VIVO, enVivo: { ...ENVIVO, hayProxima: false } }),
    ).toBe("En vivo · activa tu ubicación para el tiempo");
  });

  it("NINGÚN RÓTULO NOMBRA SU MODO — eso es vocabulario nuestro, no del pasajero", () => {
    /*
     * «Por horario» era el último que lo hacía. Ninguno de los otros nombraba
     * su estado, y por eso se iba de todas formas, con atribución o sin ella.
     */
    const todos: ModoDeLaTarjeta[] = [
      "por_arrancar",
      "fuera_de_horario",
      "por_horario",
      "sin_evidencia",
    ];
    for (const modo of todos) {
      const r = rotuloDeLaTarjeta(modo, VIVO).toLowerCase();
      expect(r, modo).not.toContain("por horario");
      expect(r, modo).not.toContain("sin evidencia");
    }
  });

  it("ningún estado se queda sin rótulo, con cadencia o sin ella", () => {
    for (const modo of TODOS) {
      expect(rotuloDeLaTarjeta(modo, VIVO).length, modo).toBeGreaterThan(0);
      expect(rotuloDeLaTarjeta(modo, MEDIDO).length, modo).toBeGreaterThan(0);
    }
  });
});

describe("la fuente manda sobre el estado", () => {
  it("EL MISMO ESTADO CAMBIA DE FIRMA según de quién sea el titular", () => {
    /*
     * `por_horario` es el caso que obligó a la regla. Con cadencia declarada el
     * titular es «Cada 20 min» y es suya; sin ella el titular es «En servicio»,
     * que salió de nuestro GPS.
     */
    expect(fuenteDelTitular("por_horario", true)).toBe("declarada");
    expect(fuenteDelTitular("por_horario", false)).toBe("medida");
    expect(rotuloDeLaTarjeta("por_horario", VIVO)).toBe(SEGUN_EL_CONCESIONARIO);
    expect(rotuloDeLaTarjeta("por_horario", MEDIDO)).not.toBe(SEGUN_EL_CONCESIONARIO);
  });

  it("NUESTRA MEDICIÓN NUNCA SE FIRMA CON SU NOMBRE — la valla de esta regla", () => {
    /*
     * El día que el GPS se equivoque —un aparato reportando desde el patio, una
     * posición vieja que se coló— un rótulo con su nombre le carga a él nuestra
     * falla delante del pasajero. Es la ley de no exponer al operador,
     * invertida.
     */
    for (const modo of TODOS) {
      for (const datos of [VIVO, MEDIDO]) {
        if (fuenteDelTitular(modo, datos.hayFrecuenciaDeclarada) === "medida") {
          expect(rotuloDeLaTarjeta(modo, datos).toLowerCase(), modo).not.toContain(
            "concesionario",
          );
        }
      }
    }
  });

  it("lo medido dice QUÉ vimos y CUÁNDO, y en pasado", () => {
    const r = rotuloDeLaTarjeta("por_horario", MEDIDO);
    expect(r).toBe("Vimos una unidad en la ruta hace 6 min");
    // En presente prometería que la estamos viendo ahorita — y si así fuera,
    // el circuito estaría EN VIVO y no en este estado.
    expect(r.toLowerCase()).not.toContain("hay unidades");
  });

  it("sin saber cuándo, dice qué vimos y NO inventa el minuto", () => {
    expect(rotuloDeLaTarjeta("por_horario", { ...MEDIDO, vistoHaceMin: null })).toBe(
      "Vimos una unidad en la ruta",
    );
  });

  it("el minuto se redondea igual que la pastilla del camión del mapa", () => {
    /*
     * Hablan del mismo camión en la misma pantalla: «hace 6 min» arriba con
     * «hace 7 min» abajo es una contradicción que el pasajero sí ve.
     */
    expect(minutosDesdeQueSeVio(360)).toBe(6);
    expect(minutosDesdeQueSeVio(380)).toBe(6);
    expect(minutosDesdeQueSeVio(390)).toBe(7);
    // Y nunca «hace 0 min», que es una forma rara de decir «ahorita».
    expect(minutosDesdeQueSeVio(20)).toBe(1);
    expect(minutosDesdeQueSeVio(0)).toBe(1);
  });

  it("cada estado tiene una fuente, y sólo una", () => {
    for (const modo of TODOS) {
      for (const conFrecuencia of [true, false]) {
        expect(["declarada", "medida", "ninguna"], modo).toContain(
          fuenteDelTitular(modo, conFrecuencia),
        );
      }
    }
  });
});
