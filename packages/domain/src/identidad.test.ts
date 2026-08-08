import { describe, it, expect } from "vitest";
import { agruparPorId, contarPorId, idDe, indexarPorId } from "./identidad.js";

/**
 * Los dos casos reales, medidos contra producción el 7 de agosto de 2026.
 *
 * Se usan como fixture a propósito: una prueba con `a`/`b` demostraría lo
 * mismo y no diría por qué existe. Éstos son los que ya costaron una premisa.
 */
const TURNOS = [
  { id: "sh-planta-b", name: "Turno B", startTime: "15:30:00", contrato: "Tecma 47" },
  { id: "sh-campus-b", name: "Turno B", startTime: "18:00:00", contrato: "Campus" },
  { id: "sh-planta-a", name: "Turno A", startTime: "05:45:00", contrato: "Tecma 47" },
];

/** `Km 30 - B` existe en los DOS contratos: 48 perfiles por id, 47 por nombre. */
const PERFILES = [
  { id: "pf-campus-km30b", name: "Km 30 - B", contrato: "Campus" },
  { id: "pf-planta-km30b", name: "Km 30 - B", contrato: "Tecma 47" },
];

describe("C20 · agrupar por id no colapsa dos cosas con el mismo nombre", () => {
  it("los dos «Turno B» quedan separados", () => {
    const grupos = agruparPorId(TURNOS, idDe);

    expect(grupos.size).toBe(3);
    // El control: agrupando por nombre serían dos, y ésa es la cifra falsa.
    expect(new Set(TURNOS.map((t) => t.name)).size).toBe(2);
  });

  it("«Km 30 - B» de dos contratos cuenta dos, no uno", () => {
    const cuenta = contarPorId(PERFILES, idDe);

    expect(cuenta.size).toBe(2);
    for (const n of cuenta.values()) expect(n).toBe(1);
    // Es la diferencia entre 48 y 47 medida el 7 de agosto, en pequeño.
    expect(new Set(PERFILES.map((p) => p.name)).size).toBe(1);
  });

  it("indexar por id conserva las dos filas; por nombre se perdería una", () => {
    const indice = indexarPorId(TURNOS, idDe);

    expect(indice.size).toBe(3);
    expect(indice.get(idDe(TURNOS[0]!))?.startTime).toBe("15:30:00");
    expect(indice.get(idDe(TURNOS[1]!))?.startTime).toBe("18:00:00");
  });

  it("la clave es el id y nada más — no se le pega nada al valor", () => {
    // La marca del tipo no viaja en tiempo de ejecución: lo que sale es el id
    // tal cual, así que se puede comparar contra lo que devuelve la base.
    expect(idDe(TURNOS[0]!)).toBe("sh-planta-b");
    expect(typeof idDe(TURNOS[0]!)).toBe("string");
    expect(JSON.stringify({ k: idDe(TURNOS[0]!) })).toBe('{"k":"sh-planta-b"}');
  });
});

/**
 * La valla, comprobada donde vive: en el compilador.
 *
 * `@ts-expect-error` es una aserción invertida — **falla la compilación si la
 * línea de abajo NO tiene error**. O sea que si alguien afloja `IdEstable` y
 * agrupar por nombre vuelve a compilar, `pnpm typecheck` se pone rojo aquí.
 *
 * Es la única forma de probar esta defensa: ninguna aserción en tiempo de
 * ejecución puede distinguir un tipo que impide algo de uno que no, porque el
 * código que probaría la diferencia no llegaría a existir. Regla 12 — hay
 * defectos que solo el compilador ve, y hay vallas que solo él sostiene.
 */
describe("C20 · la valla del compilador", () => {
  it("agrupar por nombre no compila", () => {
    // @ts-expect-error — `name` es string, no IdEstable. Ésta es la valla.
    agruparPorId(TURNOS, (t) => t.name);

    // @ts-expect-error — contar por nombre tampoco.
    contarPorId(PERFILES, (p) => p.name);

    // @ts-expect-error — ni indexar.
    indexarPorId(TURNOS, (t) => t.name);

    // @ts-expect-error — y `idDe` pide la FILA, no una cadena: si aceptara
    // `string`, `idDe(t.name)` compilaría y todo lo de arriba se podría
    // rodear en una línea.
    idDe(TURNOS[0]!.name);

    // El control: por id sí compila. Sin esto, las cuatro líneas de arriba
    // pasarían igual con una función que no acepta nada.
    expect(agruparPorId(TURNOS, idDe).size).toBe(3);
  });
});
