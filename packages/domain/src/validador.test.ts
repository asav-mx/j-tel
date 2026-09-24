import { describe, it, expect } from "vitest";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import {
  LLAVE_DE_LABORATORIO,
  crearPortador,
  emitirBoleto,
  presentarBoleto,
  type Presentacion,
} from "./boleto.js";
import {
  TOPE_SIN_SENAL,
  TOPE_CODIGO_DICTADO,
  SEGUNDOS_ANTES_DE_DICTAR,
  PALABRAS_DEL_MOTIVO,
  jornadaNueva,
  validarPresentacion,
  validarCodigoDictado,
  validadosHoy,
  sinSenalAceptados,
  codigosDictados,
  porSincronizar,
  marcarEntregados,
  jornadaEntregada,
  jornadasQueSeGuardan,
  porEntregarEnTodas,
  type JornadaDelLector,
  type RegistroDePaso,
} from "./validador.js";

const MEDIODIA = Date.UTC(2026, 8, 23, 12, 0, 0);
const LECTOR = () => jornadaNueva("J-VAL-01", "2026-09-23");
const LLAVE = LLAVE_DE_LABORATORIO.publica;

function boletoNuevo(semilla: string): Presentacion {
  const portador = crearPortador(utf8ToBytes(semilla));
  const sellado = emitirBoleto(
    {
      folio: `ONT-${semilla.padStart(8, "0").slice(-8)}`,
      ruta: "cualquier-circuito",
      emitido: MEDIODIA - 1000,
      vence: MEDIODIA + 90 * 24 * 60 * 60 * 1000,
      portador: portador.publica,
    },
    LLAVE_DE_LABORATORIO,
  );
  return presentarBoleto(sellado, portador, MEDIODIA);
}

/*
 * El id del paso lo pone quien llama (P3.5): el módulo es puro y no inventa
 * azar. Aquí va un contador, para que lo que sale de cada prueba sea fijo.
 */
let numeroDePaso = 0;
const idDePaso = () => `paso-${++numeroDePaso}`;

const conSenal = (jornada: JornadaDelLector) => ({
  jornada,
  llavePublicaDeJTel: LLAVE,
  ahora: MEDIODIA,
  haySenal: true,
  idDelPaso: idDePaso(),
});

describe("la vía buena: el QR", () => {
  it("un boleto bueno pasa y queda registrado", () => {
    const { resultado, jornada } = validarPresentacion(boletoNuevo("1"), conSenal(LECTOR()));
    expect(resultado).toMatchObject({ pasa: true, folio: "ONT-00000001", via: "qr", conSenal: true });
    expect(validadosHoy(jornada)).toBe(1);
    /* Recién aceptado, todavía no le consta a nadie más: falta entregarlo. */
    expect(porSincronizar(jornada)).toBe(1);
    expect(jornada.pasos[0]?.id).toBe(resultado.pasa ? resultado.idDelPaso : "");
  });

  it("el segundo paso del mismo boleto no pasa", () => {
    const uno = boletoNuevo("1");
    const { jornada } = validarPresentacion(uno, conSenal(LECTOR()));
    const otra = validarPresentacion(uno, conSenal(jornada));
    expect(otra.resultado).toEqual({ pasa: false, motivo: "ya_quemado_en_este_aparato" });
    expect(validadosHoy(otra.jornada)).toBe(1);
  });

  /* Un rechazo no puede ensuciar el día: si contara, un falsificador subiría
     las cifras del lector con puro boleto malo. */
  it("un rechazo no toca la jornada", () => {
    const antes = LECTOR();
    const falso: Presentacion = { ...boletoNuevo("1"), pruebaDelPortador: "00".repeat(64) };
    const { jornada } = validarPresentacion(falso, conSenal(antes));
    expect(jornada).toBe(antes);
  });
});

describe("el tope sin señal — la ventana del doble uso", () => {
  it("son 20, y el número está en una constante", () => {
    expect(TOPE_SIN_SENAL).toBe(20);
  });

  it("acepta hasta el tope sin señal y rechaza el siguiente", () => {
    let jornada = LECTOR();
    for (let i = 0; i < TOPE_SIN_SENAL; i++) {
      const paso = validarPresentacion(boletoNuevo(`${i}`), {
        ...conSenal(jornada),
        haySenal: false,
      });
      expect(paso.resultado.pasa).toBe(true);
      jornada = paso.jornada;
    }
    expect(sinSenalAceptados(jornada)).toBe(TOPE_SIN_SENAL);

    const unoMas = validarPresentacion(boletoNuevo("de-mas"), {
      ...conSenal(jornada),
      haySenal: false,
    });
    expect(unoMas.resultado).toEqual({ pasa: false, motivo: "tope_sin_senal" });
  });

  /* El tope es de lo que nadie más sabe todavía. Con señal, el lector puede
     responder por lo que acepta, así que no tiene por qué parar. */
  it("con señal el tope no aplica", () => {
    let jornada = LECTOR();
    for (let i = 0; i < TOPE_SIN_SENAL + 3; i++) {
      jornada = validarPresentacion(boletoNuevo(`c${i}`), conSenal(jornada)).jornada;
    }
    expect(validadosHoy(jornada)).toBe(TOPE_SIN_SENAL + 3);
    /* Aceptados con señal, pero entregados todavía no: eso lo dice el P3.5. */
    expect(porSincronizar(jornada)).toBe(TOPE_SIN_SENAL + 3);
  });

  /* Primero la criptografía: un boleto falso no debe llevarse la explicación
     del tope, que le diría cómo anda el lector. */
  it("un boleto falso se rechaza por falso aunque el día esté lleno", () => {
    let jornada = LECTOR();
    for (let i = 0; i < TOPE_SIN_SENAL; i++) {
      jornada = validarPresentacion(boletoNuevo(`t${i}`), {
        ...conSenal(jornada),
        haySenal: false,
      }).jornada;
    }
    const base = boletoNuevo("x");
    /* La firma de J-Tel vive DENTRO de `boleto`: cambiarla en el nivel de
       arriba dejaría el boleto intacto, y la prueba pasaría por la razón
       equivocada. Pasó al escribirla. */
    const falso: Presentacion = {
      ...base,
      boleto: { ...base.boleto, firmaDeJTel: "00".repeat(64) },
    };
    const { resultado } = validarPresentacion(falso, { ...conSenal(jornada), haySenal: false });
    expect(resultado).toEqual({ pasa: false, motivo: "firma_no_es_de_jtel" });
  });
});

/*
 * Lo que el P3.5 le agregó al lector: cada paso lleva su id, y el tope cuenta
 * lo que J-Tel todavía no acusó.
 */
describe("lo entregado deja de contar para el tope", () => {
  it("un paso entregado libera lugar; uno sin entregar no", () => {
    let jornada = LECTOR();
    const ids: string[] = [];
    for (let i = 0; i < TOPE_SIN_SENAL; i++) {
      const paso = validarPresentacion(boletoNuevo(`e${i}`), {
        ...conSenal(jornada),
        haySenal: false,
      });
      if (paso.resultado.pasa) ids.push(paso.resultado.idDelPaso);
      jornada = paso.jornada;
    }
    /* Con el día lleno, el siguiente no entra. */
    expect(
      validarPresentacion(boletoNuevo("lleno"), { ...conSenal(jornada), haySenal: false }).resultado,
    ).toEqual({ pasa: false, motivo: "tope_sin_senal" });

    /* J-Tel acusa recibo de cinco: esos cinco ya le constan a alguien más. */
    jornada = marcarEntregados(jornada, ids.slice(0, 5), MEDIODIA + 1000);
    expect(porSincronizar(jornada)).toBe(TOPE_SIN_SENAL - 5);
    expect(
      validarPresentacion(boletoNuevo("despues"), { ...conSenal(jornada), haySenal: false })
        .resultado.pasa,
    ).toBe(true);

    /* Y los pasos del día siguen ahí: entregar no borra nada. */
    expect(validadosHoy(jornada)).toBe(TOPE_SIN_SENAL);
  });

  it("marcar un id que no existe no cambia nada, y no se marca dos veces", () => {
    const { jornada, resultado } = validarPresentacion(boletoNuevo("m1"), conSenal(LECTOR()));
    expect(resultado.pasa).toBe(true);
    if (!resultado.pasa) return;

    expect(marcarEntregados(jornada, [], MEDIODIA)).toBe(jornada);
    expect(marcarEntregados(jornada, ["no-existe"], MEDIODIA).pasos[0]?.entregadoEn).toBeUndefined();

    const una = marcarEntregados(jornada, [resultado.idDelPaso], MEDIODIA);
    const otra = marcarEntregados(una, [resultado.idDelPaso], MEDIODIA + 99_999);
    /* La hora del primer acuse es la que vale, como el primer quemado. */
    expect(otra.pasos[0]?.entregadoEn).toBe(MEDIODIA);
  });

  it("los ids de dos pasos del mismo lector son distintos", () => {
    const uno = validarPresentacion(boletoNuevo("i1"), conSenal(LECTOR()));
    const dos = validarPresentacion(boletoNuevo("i2"), conSenal(uno.jornada));
    const idDe = (r: typeof uno.resultado) => (r.pasa ? r.idDelPaso : null);
    expect(idDe(uno.resultado)).not.toBe(idDe(dos.resultado));
  });
});

describe("la vía dictada — acotada por tres lados", () => {
  const dictando = (jornada: JornadaDelLector) => ({
    jornada,
    ahora: MEDIODIA,
    haySenal: true,
    laCamaraFallo: true,
    idDelPaso: idDePaso(),
  });

  it("no se abre si la cámara sí podía", () => {
    const { resultado } = validarCodigoDictado("ONT-00000001", {
      ...dictando(LECTOR()),
      laCamaraFallo: false,
    });
    expect(resultado).toEqual({ pasa: false, motivo: "la_camara_si_podia" });
  });

  it("queda marcado como dictado, no como QR", () => {
    const { resultado, jornada } = validarCodigoDictado("ONT-00000001", dictando(LECTOR()));
    expect(resultado).toMatchObject({
      pasa: true,
      folio: "ONT-00000001",
      via: "codigo_dictado",
      conSenal: true,
    });
    expect(jornada.pasos[0]?.via).toBe("codigo_dictado");
    expect(codigosDictados(jornada)).toBe(1);
  });

  /* Los dos números de esta vía, fijados: moverlos cambia cuánto se abre el
     único hueco por donde una captura todavía sirve. */
  it("tiene su propio tope, y son 5; y la vía no se ofrece antes de 15 s", () => {
    expect(TOPE_CODIGO_DICTADO).toBe(5);
    expect(SEGUNDOS_ANTES_DE_DICTAR).toBe(15);
    let jornada = LECTOR();
    for (let i = 0; i < TOPE_CODIGO_DICTADO; i++) {
      jornada = validarCodigoDictado(`ONT-0000000${i}`, dictando(jornada)).jornada;
    }
    const unoMas = validarCodigoDictado("ONT-99999999", dictando(jornada));
    expect(unoMas.resultado).toEqual({ pasa: false, motivo: "tope_de_codigo_dictado" });
  });

  it("un folio ya quemado por QR tampoco cuela dictado", () => {
    const uno = boletoNuevo("7");
    const { jornada } = validarPresentacion(uno, conSenal(LECTOR()));
    const dictado = validarCodigoDictado(uno.boleto.cuerpo.folio, dictando(jornada));
    expect(dictado.resultado).toEqual({ pasa: false, motivo: "ya_quemado_en_este_aparato" });
  });

  /* El tope sin señal cuenta las dos vías: lo que nadie sabe es lo que nadie
     sabe, lo haya dicho una cámara o una persona. */
  it("los dictados también cuentan para el tope sin señal", () => {
    let jornada = LECTOR();
    for (let i = 0; i < TOPE_SIN_SENAL; i++) {
      jornada = validarPresentacion(boletoNuevo(`s${i}`), {
        ...conSenal(jornada),
        haySenal: false,
      }).jornada;
    }
    const dictado = validarCodigoDictado("ONT-55555555", {
      ...dictando(jornada),
      haySenal: false,
    });
    expect(dictado.resultado).toEqual({ pasa: false, motivo: "tope_sin_senal" });
  });
});

describe("lo que el aparato le dice al chofer", () => {
  it("cada motivo tiene su frase, corta", () => {
    for (const [motivo, frase] of Object.entries(PALABRAS_DEL_MOTIVO)) {
      expect(frase.length, motivo).toBeGreaterThan(0);
      expect(frase.length, motivo).toBeLessThan(55);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

/** Una jornada de mentira con los pasos que se le pidan. */
const jornadaCon = (dia: string, pasos: Array<Partial<RegistroDePaso>>): JornadaDelLector => ({
  ...jornadaNueva("J-VAL-01", dia),
  pasos: pasos.map((p, i) => ({
    id: `${dia}-${i}`,
    folio: `ONT-${dia}-${i}`,
    cuando: MEDIODIA,
    via: "qr" as const,
    conSenal: false,
    ...p,
  })),
});

describe("qué se guarda en el aparato: hasta que esté entregado", () => {
  const HOY = "2026-09-23";

  it("la jornada de hoy se guarda siempre, aunque esté vacía", () => {
    const hoy = jornadaCon(HOY, []);
    expect(jornadasQueSeGuardan([hoy], HOY)).toEqual([hoy]);
  });

  /*
   * El defecto que esto cierra: antes se guardaban DOS jornadas, la de hoy y
   * una vieja cualquiera. Un lector que pasaba tres cambios de día sin señal
   * tiraba los pasos del día más viejo **aunque nadie los hubiera recibido**, y
   * sin decir nada.
   */
  it("una jornada vieja con pasos sin entregar NO se tira, por vieja que sea", () => {
    const hoy = jornadaCon(HOY, []);
    const ayer = jornadaCon("2026-09-22", [{}]);
    const anteayer = jornadaCon("2026-09-21", [{}]);
    const laSemanaPasada = jornadaCon("2026-09-16", [{}]);

    const guardadas = jornadasQueSeGuardan([hoy, ayer, anteayer, laSemanaPasada], HOY);
    expect(guardadas.map((j) => j.dia)).toEqual([HOY, "2026-09-22", "2026-09-21", "2026-09-16"]);
  });

  it("una jornada vieja ya entregada se suelta: su evidencia vive en el libro de J-Tel", () => {
    const hoy = jornadaCon(HOY, []);
    const ayer = jornadaCon("2026-09-22", [{ entregadoEn: MEDIODIA }, { entregadoEn: MEDIODIA }]);
    expect(jornadasQueSeGuardan([hoy, ayer], HOY).map((j) => j.dia)).toEqual([HOY]);
  });

  /* Un rechazo también quedó entregado: no se reintenta, y no se carga para siempre. */
  it("una vieja cuyos renglones J-Tel rechazó también se suelta", () => {
    const hoy = jornadaCon(HOY, []);
    const ayer = jornadaCon("2026-09-22", [
      { entregadoEn: MEDIODIA, rechazoDeJTel: "no lo firmó J-Tel" },
    ]);
    expect(jornadasQueSeGuardan([hoy, ayer], HOY).map((j) => j.dia)).toEqual([HOY]);
  });

  it("una vieja a medio entregar se queda entera: no se parte por la mitad", () => {
    const hoy = jornadaCon(HOY, []);
    const ayer = jornadaCon("2026-09-22", [{ entregadoEn: MEDIODIA }, {}]);
    const guardadas = jornadasQueSeGuardan([hoy, ayer], HOY);
    expect(guardadas.map((j) => j.dia)).toEqual([HOY, "2026-09-22"]);
    expect(guardadas[1]!.pasos.length).toBe(2);
  });

  it("las viejas salen de la más reciente a la más antigua", () => {
    const hoy = jornadaCon(HOY, []);
    const viejas = ["2026-09-18", "2026-09-22", "2026-09-20"].map((d) => jornadaCon(d, [{}]));
    expect(jornadasQueSeGuardan([hoy, ...viejas], HOY).map((j) => j.dia)).toEqual([
      HOY,
      "2026-09-22",
      "2026-09-20",
      "2026-09-18",
    ]);
  });

  it("una jornada vacía está entregada: no hay nada que deber", () => {
    expect(jornadaEntregada(jornadaCon(HOY, []))).toBe(true);
  });

  it("lo que el aparato debe se cuenta en TODAS sus jornadas, no sólo en la de hoy", () => {
    const jornadas = [
      jornadaCon(HOY, [{}, { entregadoEn: MEDIODIA }]),
      jornadaCon("2026-09-22", [{}, {}]),
    ];
    expect(porSincronizar(jornadas[0]!)).toBe(1);
    expect(porEntregarEnTodas(jornadas)).toBe(3);
  });
});
