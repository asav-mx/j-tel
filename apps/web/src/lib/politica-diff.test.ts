import { describe, expect, it } from "vitest";
import type { ContractPolicy } from "@jtel/domain";
import {
  cambiosEntre,
  firmaDeEdicion,
  leerHistoria,
  valorEscrito,
  vigenteCoincide,
  type EdicionCruda,
} from "./politica-diff";
import { PERILLAS } from "./perillas-contrato";

const perillaDe = (llave: string) => PERILLAS.find((p) => p.llave === llave)!;

const base = {
  toleranceMinutes: 5,
  kmlMatchMinPct: 60,
  kmlCorridorMinPct: 60,
  kmlOriginToleranceFraction: 0.15,
  permitirConsolidacion: false,
  excusableReasons: ["lluvia_nieve", "obstruccion"],
} as unknown as ContractPolicy;

describe("qué cambió entre dos versiones", () => {
  it("dos políticas iguales no producen un solo cambio", () => {
    expect(cambiosEntre(base, { ...base })).toEqual([]);
  });

  it("compara los arreglos por contenido, no por referencia", () => {
    // La política viaja como jsonb: cada lectura trae arreglos nuevos con el
    // mismo contenido. Por referencia, cada guardado marcaría un cambio falso.
    const otro = { ...base, excusableReasons: ["lluvia_nieve", "obstruccion"] } as ContractPolicy;
    expect(cambiosEntre(base, otro)).toEqual([]);
  });

  it("el orden de las llaves no es un cambio", () => {
    /*
     * Postgres devuelve las llaves de un jsonb en su propio orden y zod en el
     * del esquema, así que la misma política leída por dos caminos trae los
     * campos en distinto orden. Cuando esto se comparaba con JSON.stringify,
     * la pantalla anunciaba "alguien escribió la política por fuera del
     * registro" en un contrato donde no había pasado nada.
     */
    const alReves = Object.fromEntries(
      Object.entries(base as Record<string, unknown>).reverse(),
    ) as unknown as ContractPolicy;

    expect(Object.keys(alReves)).not.toEqual(Object.keys(base));
    expect(cambiosEntre(base, alReves)).toEqual([]);
    expect(vigenteCoincide(alReves, {
      id: "1",
      policyBefore: {},
      policyAfter: base,
      actorKind: "human",
      actorId: null,
      note: null,
      changedAt: new Date("2026-08-01T10:00:00.000Z"),
    })).toBe(true);
  });

  it("reordenar una lista SÍ es un cambio", () => {
    // En los motivos excusables el orden lo eligió alguien a propósito.
    const otro = { ...base, excusableReasons: ["obstruccion", "lluvia_nieve"] } as ContractPolicy;
    expect(cambiosEntre(base, otro)).toHaveLength(1);
  });

  it("nombra el cambio como se llama en la oficina, no con la llave", () => {
    const [c] = cambiosEntre(base, { ...base, kmlMatchMinPct: 70 } as ContractPolicy);

    expect(c!.llave).toBe("kmlMatchMinPct");
    expect(c!.nombre).toBe(perillaDe("kmlMatchMinPct").nombre);
    expect(c!.nombre).not.toContain("kmlMatchMinPct");
    expect(c!.antes).toBe(60);
    expect(c!.despues).toBe(70);
  });

  it("arrastra el riesgo y quién decide desde el catálogo", () => {
    const conRiesgo = PERILLAS.find((p) => p.riesgo)!;
    const [c] = cambiosEntre(
      { [conRiesgo.llave]: 1 } as unknown as ContractPolicy,
      { [conRiesgo.llave]: 2 } as unknown as ContractPolicy,
    );

    expect(c!.riesgo).toBe(conRiesgo.riesgo);
    expect(c!.decide).toBe(conRiesgo.decide);
  });

  it("una llave que el catálogo no nombra sale igual, con su llave cruda", () => {
    // Si el esquema agrega una perilla y esta pantalla no se actualiza, callar
    // el cambio escondería una edición real. Sale fea a propósito: es la señal.
    const [c] = cambiosEntre(
      { perillaNueva: 1 } as unknown as ContractPolicy,
      { perillaNueva: 2 } as unknown as ContractPolicy,
    );

    expect(c!.nombre).toBe("perillaNueva");
    expect(c!.perilla).toBeNull();
    expect(c!.riesgo).toBeNull();
  });

  it("una llave que aparece o desaparece es un cambio", () => {
    const sin = { toleranceMinutes: 5 } as unknown as ContractPolicy;
    const con = { toleranceMinutes: 5, shiftCloseMinutesAfterStart: 90 } as unknown as ContractPolicy;

    expect(cambiosEntre(sin, con)).toHaveLength(1);
    expect(cambiosEntre(con, sin)[0]!.despues).toBeUndefined();
  });

  it("varios cambios salen en el orden de la oficina", () => {
    const cambios = cambiosEntre(base, {
      ...base,
      kmlCorridorMinPct: 70,
      toleranceMinutes: 10,
    } as ContractPolicy);

    const posicion = (l: string) => PERILLAS.findIndex((p) => p.llave === l);
    expect(cambios).toHaveLength(2);
    expect(posicion(cambios[0]!.llave)).toBeLessThan(posicion(cambios[1]!.llave));
  });
});

describe("los valores se escriben con su unidad", () => {
  it("un porcentaje lleva su signo y su decimal", () => {
    expect(valorEscrito(60, perillaDe("kmlMatchMinPct"))).toBe("60.0%");
  });

  it("una fracción se escribe como porcentaje, no como 0.15", () => {
    // `0.15` suelto en una lista de cambios no dice si son quince por ciento
    // o quince minutos.
    expect(valorEscrito(0.15, perillaDe("kmlOriginToleranceFraction"))).toBe("15.0%");
  });

  it("un entero lleva su unidad", () => {
    expect(valorEscrito(5, perillaDe("toleranceMinutes"))).toContain("5 ");
  });

  it("un booleano se dice encendido o apagado", () => {
    expect(valorEscrito(true, null)).toBe("encendido");
    expect(valorEscrito(false, null)).toBe("apagado");
  });

  it("ausente se dice, no se deja en blanco", () => {
    expect(valorEscrito(undefined, null)).toBe("sin configurar");
    expect(valorEscrito(null, null)).toBe("sin configurar");
  });

  it("una lista vacía no es lo mismo que sin configurar", () => {
    expect(valorEscrito([], null)).toBe("ninguno");
    expect(valorEscrito(["lluvia_nieve"], null)).toBe("lluvia_nieve");
  });
});

describe("la cadena de ediciones", () => {
  const edicion = (
    id: string,
    antes: Partial<ContractPolicy>,
    despues: Partial<ContractPolicy>,
  ): EdicionCruda => ({
    id,
    policyBefore: antes,
    policyAfter: despues,
    actorKind: "human",
    actorId: null,
    note: null,
    changedAt: new Date(`2026-08-0${id}T10:00:00.000Z`),
  });

  const v1 = { toleranceMinutes: 5 } as ContractPolicy;
  const v2 = { toleranceMinutes: 10 } as ContractPolicy;
  const v3 = { toleranceMinutes: 15 } as ContractPolicy;

  it("una historia que encadena no reporta ningún hueco", () => {
    // Llega de la más reciente a la más antigua, como la devuelve la consulta.
    const leidas = leerHistoria([edicion("2", v2, v3), edicion("1", v1, v2)]);

    expect(leidas.every((e) => !e.cadenaRota)).toBe(true);
    expect(leidas[0]!.cambios[0]!.antes).toBe(10);
    expect(leidas[0]!.cambios[0]!.despues).toBe(15);
  });

  it("detecta que alguien escribió la política sin registrar", () => {
    // La edición vieja dejó toleranceMinutes en 10; la nueva encontró 99.
    // Entre las dos hubo una escritura que no dejó rastro.
    const fantasma = { toleranceMinutes: 99 } as ContractPolicy;
    const leidas = leerHistoria([edicion("2", fantasma, v3), edicion("1", v1, v2)]);

    expect(leidas[0]!.cadenaRota).toBe(true);
    expect(leidas[1]!.cadenaRota).toBe(false);
  });

  it("la más antigua nunca se marca rota: no hay contra qué comparar", () => {
    const leidas = leerHistoria([edicion("1", v1, v2)]);
    expect(leidas[0]!.cadenaRota).toBe(false);
  });

  it("la política vigente tiene que ser la que dejó la última edición", () => {
    const ultima = edicion("2", v2, v3);

    expect(vigenteCoincide(v3, ultima)).toBe(true);
    expect(vigenteCoincide({ toleranceMinutes: 42 } as ContractPolicy, ultima)).toBe(false);
    // Sin ediciones no hay nada que contradecir.
    expect(vigenteCoincide(v1, undefined)).toBe(true);
  });
});

describe("la firma de una edición", () => {
  it("sin control de acceso se firma el rol, nunca un nombre inventado", () => {
    const firma = firmaDeEdicion("human", null);
    expect(firma).toContain("una persona");
    expect(firma).toContain("sin identificar");
  });

  it("cuando el identificador exista, se usa", () => {
    expect(firmaDeEdicion("human", "ana@tecma.mx")).toBe("ana@tecma.mx");
  });

  it("distingue proceso de persona", () => {
    expect(firmaDeEdicion("system:cron", null)).toContain("automático");
    expect(firmaDeEdicion("system:cli", null)).toContain("línea de comandos");
  });
});
