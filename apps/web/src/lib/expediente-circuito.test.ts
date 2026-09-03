import { describe, expect, it } from "vitest";
import { ORIGEN_DEL_CIRCUITO } from "@jtel/domain/publico";
import {
  faltantesDelCircuito,
  loQueDiraLaApp,
  perillasDeMedicion,
  type CircuitoParaExpediente,
} from "./expediente-circuito";

const DE_ORIGEN: CircuitoParaExpediente = {
  staleAfterSeconds: ORIGEN_DEL_CIRCUITO.frescuraSegundos,
  serviceConfidenceMinutes: ORIGEN_DEL_CIRCUITO.confianzaMinutos,
  corridorToleranceMeters: ORIGEN_DEL_CIRCUITO.corredorEnRutaMetros,
  stopSnapToleranceMeters: ORIGEN_DEL_CIRCUITO.pegadoDeParadasMetros,
  arrivalRangeFloorSeconds: ORIGEN_DEL_CIRCUITO.pisoDelRangoSegundos,
  avgSpeedKmh: ORIGEN_DEL_CIRCUITO.velocidadKmh,
};

const perilla = (c: CircuitoParaExpediente, campo: string) => {
  const p = perillasDeMedicion(c).find((x) => x.campo === campo);
  if (!p) throw new Error(`no existe la perilla ${campo}`);
  return p;
};

describe("las dos distancias no se pueden volver a llamar igual", () => {
  /*
   * Ésta es la valla del arreglo, no una prueba de cortesía.
   *
   * El formulario viejo llamaba «Tolerancia de pegado (m)» a los 25 m del
   * editor, y los 150 m del corredor —que deciden qué camión ve el pasajero—
   * no tenían editor. Ahora los dos se editan en la misma pantalla, y juntos
   * es justo donde un rótulo genérico hace daño: quien busca «la tolerancia»
   * encuentra una de las dos y la mueve.
   */
  it("ningún rótulo usa la palabra «tolerancia»", () => {
    for (const p of perillasDeMedicion(DE_ORIGEN)) {
      expect(p.rotulo.toLowerCase()).not.toContain("tolerancia");
    }
  });

  it("cada una nombra lo que hace: una habla de paradas y la otra de ir en ruta", () => {
    expect(perilla(DE_ORIGEN, "pegadoParadasM").rotulo.toLowerCase()).toContain("parada");
    expect(perilla(DE_ORIGEN, "corredorEnRutaM").rotulo.toLowerCase()).toContain("ruta");
  });

  it("no hay dos perillas con el mismo campo ni con el mismo rótulo", () => {
    const perillas = perillasDeMedicion(DE_ORIGEN);
    expect(new Set(perillas.map((p) => p.campo)).size).toBe(perillas.length);
    expect(new Set(perillas.map((p) => p.rotulo)).size).toBe(perillas.length);
  });
});

describe("de dónde salió el valor que está guardado", () => {
  it("recién nacido, todas coinciden con su valor de origen", () => {
    for (const p of perillasDeMedicion(DE_ORIGEN)) {
      expect(p.igualAlOrigen, p.campo).toBe(true);
      expect(p.valor).toBe(p.origen);
    }
  });

  it("mover una sola no marca a las demás", () => {
    const ajustado = { ...DE_ORIGEN, corridorToleranceMeters: 90 };
    expect(perilla(ajustado, "corredorEnRutaM").igualAlOrigen).toBe(false);
    expect(perilla(ajustado, "corredorEnRutaM").origen).toBe(
      ORIGEN_DEL_CIRCUITO.corredorEnRutaMetros,
    );
    expect(perilla(ajustado, "frescuraSeg").igualAlOrigen).toBe(true);
    expect(perilla(ajustado, "pegadoParadasM").igualAlOrigen).toBe(true);
  });

  it("teclear a mano el mismo valor de origen es indistinguible, y por eso se lee como coincidencia", () => {
    /*
     * No hay forma de saber si alguien escribió 180 o si nunca se tocó. La
     * pantalla dice «igual al valor de origen» justamente porque «sin ajustar»
     * afirmaría sobre un humano algo que la base no sostiene. Cerrarlo pide un
     * registro de cambios, que no existe.
     */
    const tecleado = { ...DE_ORIGEN, staleAfterSeconds: ORIGEN_DEL_CIRCUITO.frescuraSegundos };
    expect(perilla(tecleado, "frescuraSeg").igualAlOrigen).toBe(true);
  });

  it("cada perilla trae su lectura y su procedencia, sin renglones vacíos", () => {
    for (const p of perillasDeMedicion(DE_ORIGEN)) {
      expect(p.lectura.length, p.campo).toBeGreaterThan(40);
      expect(p.procedencia.length, p.campo).toBeGreaterThan(20);
    }
  });

  it("la procedencia de la velocidad dice que se midió sobre otra flota", () => {
    // Es el motivo por el que el tiempo estimado nace apagado: si la pantalla
    // deja de decirlo, alguien va a encenderlo creyendo que 20.5 es de aquí.
    expect(perilla(DE_ORIGEN, "velocidadKmh").procedencia.toLowerCase()).toContain("otra flota");
  });
});

describe("la frecuencia vacía es una decisión, y la pantalla dice qué produce", () => {
  it("sin frecuencia, la lectura no contiene ningún número de minutos", () => {
    const texto = loQueDiraLaApp(null);
    expect(texto).toMatch(/se calla el número/);
    expect(texto).not.toMatch(/\d+\s*min/);
  });

  it("con frecuencia, la lectura cita exactamente la que está guardada", () => {
    expect(loQueDiraLaApp(12)).toContain("cada 12 min");
    expect(loQueDiraLaApp(12)).not.toContain("20");
  });
});

describe("lo que falta se enuncia, y lo decidido no se marca como carencia", () => {
  const vacio = {
    trazados: 0,
    paradas: 0,
    unidadesVigentes: 0,
    frecuenciaMin: null,
    rangoEncendido: false,
  };
  const renglon = (e: Parameters<typeof faltantesDelCircuito>[0], que: string) => {
    const r = faltantesDelCircuito(e).find((x) => x.que === que);
    if (!r) throw new Error(`no existe el renglón ${que}`);
    return r;
  };

  it("la frecuencia sin declarar dice «sin declarar», nunca un número", () => {
    expect(renglon(vacio, "Frecuencia declarada").cuanto).toBe("sin declarar");
  });

  it("el tiempo estimado APAGADO no se marca como falta", () => {
    /*
     * La valla del defecto que encontró mirar la pantalla. Apagado es el estado
     * con que nace y el correcto hasta calibrar la velocidad contra la calle:
     * marcarlo «falta» empuja a encenderlo, y encenderlo antes de calibrar es
     * presentar una suposición como medición.
     */
    expect(renglon(vacio, "Tiempo estimado de llegada").estado).toBe("decidido");
    expect(renglon({ ...vacio, rangoEncendido: true }, "Tiempo estimado de llegada").estado).toBe(
      "decidido",
    );
  });

  it("la frecuencia sin declarar tampoco: es una respuesta, no un hueco", () => {
    expect(renglon(vacio, "Frecuencia declarada").estado).toBe("decidido");
    expect(renglon({ ...vacio, frecuenciaMin: 20 }, "Frecuencia declarada").estado).toBe("decidido");
  });

  it("lo que sí le falta al pasajero se marca: trazado, paradas y unidades", () => {
    for (const que of ["Trazado", "Paradas", "Unidades corriendo"]) {
      expect(renglon(vacio, que).estado, que).toBe("falta");
    }
  });

  it("un circuito armado no deja ningún renglón en falta", () => {
    const listo = faltantesDelCircuito({
      trazados: 2,
      paradas: 7,
      unidadesVigentes: 3,
      frecuenciaMin: 20,
      rangoEncendido: true,
    });
    expect(listo.some((x) => x.estado === "falta")).toBe(false);
  });

  it("cero paradas se enuncia como cero, no se esconde", () => {
    expect(renglon(vacio, "Paradas").cuanto).toBe("0");
  });
});
