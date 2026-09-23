import { describe, it, expect } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  LLAVE_DE_LABORATORIO,
  PUBLICA_DE_LABORATORIO_HEX,
  FRASE_DE_LABORATORIO,
  type LlaveDeFirma,
} from "./boleto-llave.js";
import {
  VENTANA_MS,
  TOLERANCIA_VENTANAS,
  VIDA_DE_UNA_CAPTURA_MS,
  ventanaDe,
  crearPortador,
  emitirBoleto,
  presentarBoleto,
  verificarBoleto,
  MEMORIA_VACIA,
  quemar,
  estaQuemado,
  cotejarQuemados,
  type BoletoSellado,
  type Presentacion,
} from "./boleto.js";

/* Todo con datos falsos: es la raya de la ficha, y también de las pruebas. */
const MEDIODIA = Date.UTC(2026, 8, 23, 12, 0, 0);
const PORTADOR = crearPortador(utf8ToBytes("portador de prueba"));
const OTRO_PORTADOR = crearPortador(utf8ToBytes("otro portador de prueba"));

/** Una llave que NO es la de J-Tel — el que quisiera falsificar boletos. */
const LLAVE_DEL_FALSIFICADOR: LlaveDeFirma = (() => {
  const privada = sha256(utf8ToBytes("no soy j-tel"));
  return {
    privada,
    publica: ed25519.getPublicKey(privada),
    esDeProduccion: false,
    queEs: "Llave de un falsificador, para las pruebas.",
  };
})();

function boletoDePrueba(llave: LlaveDeFirma = LLAVE_DE_LABORATORIO): BoletoSellado {
  return emitirBoleto(
    {
      folio: "ONT-000123",
      ruta: "circuito-juarez-1",
      emitido: MEDIODIA - 60 * 60 * 1000,
      vence: MEDIODIA + 60 * 60 * 1000,
      portador: PORTADOR.publica,
    },
    llave,
  );
}

const CONTEXTO = { llavePublicaDeJTel: LLAVE_DE_LABORATORIO.publica, ahora: MEDIODIA };

describe("la llave de laboratorio", () => {
  it("se deriva de la frase que está escrita en el repo, y por eso es reproducible", () => {
    expect(bytesToHex(LLAVE_DE_LABORATORIO.privada)).toBe(
      bytesToHex(sha256(utf8ToBytes(FRASE_DE_LABORATORIO))),
    );
  });

  it("dice que no es de producción, en el tipo y en el texto", () => {
    expect(LLAVE_DE_LABORATORIO.esDeProduccion).toBe(false);
    expect(LLAVE_DE_LABORATORIO.queEs).toMatch(/LABORATORIO/);
  });

  /* Si esta prueba se cae, alguien cambió la frase o la derivación. Puede estar
     bien —pero tiene que ser a propósito, y aquí se lee. */
  it("su pública está fijada: cambiarla sin querer se lee en rojo", () => {
    expect(PUBLICA_DE_LABORATORIO_HEX).toMatchInlineSnapshot(`"54f1acae032f7fb7fc6919433b596efe5e83806e168d64a34a76c5b66eedb778"`);
  });
});

describe("emitir y verificar, sin red", () => {
  it("un boleto recién emitido pasa", () => {
    const presentacion = presentarBoleto(boletoDePrueba(), PORTADOR, MEDIODIA);
    expect(verificarBoleto(presentacion, CONTEXTO)).toEqual({ pasa: true, folio: "ONT-000123" });
  });

  /* «Verifica sin internet» es ley de la ficha, no un detalle de implementación:
     si algún día alguien mete una consulta aquí, esta prueba se cae. */
  it("verifica con la red apagada", () => {
    const presentacion = presentarBoleto(boletoDePrueba(), PORTADOR, MEDIODIA);
    const antes = Reflect.get(globalThis, "fetch");
    Reflect.set(globalThis, "fetch", () => {
      throw new Error("el validador no puede salir a la red");
    });
    try {
      expect(verificarBoleto(presentacion, CONTEXTO).pasa).toBe(true);
    } finally {
      Reflect.set(globalThis, "fetch", antes);
    }
  });

  it("un boleto firmado por otro no es de J-Tel", () => {
    const presentacion = presentarBoleto(boletoDePrueba(LLAVE_DEL_FALSIFICADOR), PORTADOR, MEDIODIA);
    expect(verificarBoleto(presentacion, CONTEXTO)).toEqual({
      pasa: false,
      motivo: "firma_no_es_de_jtel",
    });
  });

  it("cambiarle la ruta a un boleto bueno rompe la firma", () => {
    const boleto = boletoDePrueba();
    const alterado: BoletoSellado = {
      ...boleto,
      cuerpo: { ...boleto.cuerpo, ruta: "circuito-que-no-pago" },
    };
    const presentacion = presentarBoleto(alterado, PORTADOR, MEDIODIA);
    expect(verificarBoleto(presentacion, CONTEXTO)).toEqual({
      pasa: false,
      motivo: "firma_no_es_de_jtel",
    });
  });

  it("no se puede emitir un folio con un salto de línea adentro", () => {
    expect(() =>
      emitirBoleto(
        {
          folio: "ONT-1\ncircuito-otro",
          ruta: "circuito-juarez-1",
          emitido: MEDIODIA,
          vence: MEDIODIA + 1000,
          portador: PORTADOR.publica,
        },
        LLAVE_DE_LABORATORIO,
      ),
    ).toThrow(/saltos de línea/);
  });

  /* El cuerpo que llega al validador lo controla quien enseña el QR: el salto
     de línea movería la frontera entre dos campos y una firma valdría para otro
     boleto. Se rechaza antes de mirar la firma. */
  it("un cuerpo con un salto de línea se rechaza por mal formado, no por la firma", () => {
    const boleto = boletoDePrueba();
    const colado: BoletoSellado = {
      ...boleto,
      cuerpo: { ...boleto.cuerpo, folio: "ONT-1\ncircuito-otro" },
    };
    expect(verificarBoleto(presentarBoleto(colado, PORTADOR, MEDIODIA), CONTEXTO)).toEqual({
      pasa: false,
      motivo: "cuerpo_mal_formado",
    });
  });

  it("antes de su hora no vale, y después tampoco", () => {
    const boleto = boletoDePrueba();
    const { emitido, vence } = boleto.cuerpo;

    const temprano = emitido - 1;
    expect(
      verificarBoleto(presentarBoleto(boleto, PORTADOR, temprano), {
        ...CONTEXTO,
        ahora: temprano,
      }),
    ).toEqual({ pasa: false, motivo: "aun_no_vigente" });

    const tarde = vence + 1;
    expect(
      verificarBoleto(presentarBoleto(boleto, PORTADOR, tarde), { ...CONTEXTO, ahora: tarde }),
    ).toEqual({ pasa: false, motivo: "vencido" });
  });
});

describe("el código rotante y la deriva del reloj", () => {
  /* El número que Asav eligió, fijado. Si alguien mueve la tolerancia, esta
     prueba dice en voz alta cuánto acaba de durar una captura de pantalla. */
  it("rota cada 5 s, tolera ±2 min exactos, y una captura sirve 4 min 5 s", () => {
    expect(VENTANA_MS).toBe(5_000);
    expect(TOLERANCIA_VENTANAS * VENTANA_MS).toBe(2 * 60 * 1000);
    expect(VIDA_DE_UNA_CAPTURA_MS).toBe(4 * 60 * 1000 + 5 * 1000);
  });

  it("acepta justo en el borde de la tolerancia y rechaza una ventana más allá", () => {
    const boleto = boletoDePrueba();
    const presentacion = presentarBoleto(boleto, PORTADOR, MEDIODIA);

    for (const lado of [-1, 1]) {
      const enElBorde = MEDIODIA + lado * TOLERANCIA_VENTANAS * VENTANA_MS;
      expect(verificarBoleto(presentacion, { ...CONTEXTO, ahora: enElBorde }).pasa).toBe(true);

      const unaMas = MEDIODIA + lado * (TOLERANCIA_VENTANAS + 1) * VENTANA_MS;
      expect(verificarBoleto(presentacion, { ...CONTEXTO, ahora: unaMas })).toEqual({
        pasa: false,
        motivo: "codigo_fuera_de_ventana",
      });
    }
  });

  /* La historia completa: alguien fotografía el QR y se lo manda a otro. */
  it("una captura deja de servir en otro validador pasados los 4 min 5 s", () => {
    const captura = presentarBoleto(boletoDePrueba(), PORTADOR, MEDIODIA);
    const otroValidador = { ...CONTEXTO, ahora: MEDIODIA + VIDA_DE_UNA_CAPTURA_MS };
    expect(verificarBoleto(captura, otroValidador)).toEqual({
      pasa: false,
      motivo: "codigo_fuera_de_ventana",
    });
  });

  it("la prueba de otro portador no sirve aunque el boleto sea bueno", () => {
    const boleto = boletoDePrueba();
    const suplantada: Presentacion = {
      ...presentarBoleto(boleto, PORTADOR, MEDIODIA),
      pruebaDelPortador: presentarBoleto(boleto, OTRO_PORTADOR, MEDIODIA).pruebaDelPortador,
    };
    expect(verificarBoleto(suplantada, CONTEXTO)).toEqual({
      pasa: false,
      motivo: "prueba_no_es_del_portador",
    });
  });

  /* Sin esto, quien copiara una prueba vieja podría reetiquetarla como la
     ventana de ahora: la ventana va firmada dentro de la prueba. */
  it("una prueba vieja reetiquetada como la ventana de ahora no cuela", () => {
    const boleto = boletoDePrueba();
    const vieja = presentarBoleto(boleto, PORTADOR, MEDIODIA - 10 * VENTANA_MS);
    const reetiquetada: Presentacion = { ...vieja, ventana: ventanaDe(MEDIODIA) };
    expect(verificarBoleto(reetiquetada, CONTEXTO)).toEqual({
      pasa: false,
      motivo: "prueba_no_es_del_portador",
    });
  });

  /* El folio va firmado dentro de la prueba: una prueba no se muda de boleto. */
  it("la prueba de un boleto no sirve para otro boleto del mismo portador", () => {
    const otroBoleto = emitirBoleto(
      {
        folio: "ONT-000999",
        ruta: "circuito-juarez-1",
        emitido: MEDIODIA - 1000,
        vence: MEDIODIA + 1000,
        portador: PORTADOR.publica,
      },
      LLAVE_DE_LABORATORIO,
    );
    const mudada: Presentacion = {
      ...presentarBoleto(boletoDePrueba(), PORTADOR, MEDIODIA),
      pruebaDelPortador: presentarBoleto(otroBoleto, PORTADOR, MEDIODIA).pruebaDelPortador,
    };
    expect(verificarBoleto(mudada, CONTEXTO)).toEqual({
      pasa: false,
      motivo: "prueba_no_es_del_portador",
    });
  });
});

describe("un solo uso — dentro de un aparato, absoluto", () => {
  it("el segundo paso en el mismo validador no pasa", () => {
    const boleto = boletoDePrueba();
    const primera = presentarBoleto(boleto, PORTADOR, MEDIODIA);
    const primerVeredicto = verificarBoleto(primera, { ...CONTEXTO, quemados: MEMORIA_VACIA });
    expect(primerVeredicto.pasa).toBe(true);

    const memoria = quemar(MEMORIA_VACIA, boleto.cuerpo.folio, MEDIODIA);
    const segunda = presentarBoleto(boleto, PORTADOR, MEDIODIA + VENTANA_MS);
    expect(
      verificarBoleto(segunda, { ...CONTEXTO, ahora: MEDIODIA + VENTANA_MS, quemados: memoria }),
    ).toEqual({ pasa: false, motivo: "ya_quemado_en_este_aparato" });
  });

  it("volver a quemar no mueve la hora del primer paso", () => {
    const primera = quemar(MEMORIA_VACIA, "ONT-000123", MEDIODIA);
    const otraVez = quemar(primera, "ONT-000123", MEDIODIA + 60_000);
    expect(otraVez.get("ONT-000123")).toBe(MEDIODIA);
    expect(estaQuemado(otraVez, "ONT-000123")).toBe(true);
  });

  it("quemar no muta la memoria que recibió", () => {
    const memoria = quemar(MEMORIA_VACIA, "ONT-000123", MEDIODIA);
    expect(estaQuemado(MEMORIA_VACIA, "ONT-000123")).toBe(false);
    expect(estaQuemado(memoria, "ONT-000123")).toBe(true);
  });

  /* Un boleto falso no debe enterarse de si su folio estaba quemado: eso le
     diría a un falsificador qué folios existen. */
  it("un boleto falso Y quemado se rechaza por falso, no por quemado", () => {
    const falso = presentarBoleto(boletoDePrueba(LLAVE_DEL_FALSIFICADOR), PORTADOR, MEDIODIA);
    const memoria = quemar(MEMORIA_VACIA, "ONT-000123", MEDIODIA);
    expect(verificarBoleto(falso, { ...CONTEXTO, quemados: memoria })).toEqual({
      pasa: false,
      motivo: "firma_no_es_de_jtel",
    });
  });
});

describe("un solo uso — entre aparatos, diferido hasta sincronizar", () => {
  it("el mismo folio en dos lectores salta al cotejar, en orden de hora", () => {
    const lectores = new Map([
      ["lector-camion-7", quemar(MEMORIA_VACIA, "ONT-000123", MEDIODIA + 5_000)],
      ["lector-camion-2", quemar(MEMORIA_VACIA, "ONT-000123", MEDIODIA)],
    ]);
    expect(cotejarQuemados(lectores)).toEqual([
      {
        folio: "ONT-000123",
        pasos: [
          { aparato: "lector-camion-2", instante: MEDIODIA },
          { aparato: "lector-camion-7", instante: MEDIODIA + 5_000 },
        ],
      },
    ]);
  });

  it("un folio quemado en un solo lector no es doble uso", () => {
    const lectores = new Map([
      ["lector-camion-2", quemar(MEMORIA_VACIA, "ONT-000123", MEDIODIA)],
      ["lector-camion-7", quemar(MEMORIA_VACIA, "ONT-000999", MEDIODIA)],
    ]);
    expect(cotejarQuemados(lectores)).toEqual([]);
  });

  /* El cotejo levanta el hallazgo; no deshace nada. Los dos pasos ocurrieron y
     los dos siguen ahí — la misma ley de la medición. */
  it("el cotejo conserva los dos pasos: no borra el segundo", () => {
    const lectores = new Map([
      ["a", quemar(MEMORIA_VACIA, "ONT-000123", MEDIODIA)],
      ["b", quemar(MEMORIA_VACIA, "ONT-000123", MEDIODIA + 1_000)],
    ]);
    const [hallazgo] = cotejarQuemados(lectores);
    expect(hallazgo?.pasos).toHaveLength(2);
  });
});
