/**
 * Lo que estas pruebas cercan es la clasificación de tres vías, que es donde
 * este guion puede producir una afirmación falsa con el dato correcto.
 *
 * El caso que importa: un contrato declara `kmlCorridorMeters: 120` y el otro
 * no lo declara. **El motor aplica 120 en los dos** —porque 120 es el valor de
 * fábrica—, así que un comparador ingenuo diría «igual» y estaría diciendo la
 * verdad sobre el comportamiento y una mentira sobre el acuerdo: en un contrato
 * alguien eligió 120 y en el otro nadie eligió nada. Esa distinción es C16
 * entera, y sin ella este guion no sirve.
 */
import { describe, expect, it } from "vitest";
import { compararPoliticas, representar } from "./comparar-politicas.js";

const CAMPOS = ["kmlCorridorMeters", "kmlMatchMinPct", "routeStrictness"];

describe("compararPoliticas", () => {
  it("dos contratos que declaran lo mismo salen «igual»", () => {
    const r = compararPoliticas(
      [{ kmlCorridorMeters: 120 }, { kmlCorridorMeters: 120 }],
      ["kmlCorridorMeters"],
    );
    expect(r[0]!.clase).toBe("igual");
  });

  it("dos contratos que declaran distinto salen «difiere»", () => {
    const r = compararPoliticas(
      [{ kmlCorridorMeters: 150 }, { kmlCorridorMeters: 120 }],
      ["kmlCorridorMeters"],
    );
    expect(r[0]!.clase).toBe("difiere");
  });

  /*
   * El corazón de la ficha: declarado-igual-al-default NO es lo mismo que no
   * declarado. Si esto se colapsa a «igual», los siete campos que el Campus
   * corre de fábrica desaparecen de la tabla y la conversación con la Planta se
   * hace sobre una lista incompleta.
   */
  it("declarar el valor de fábrica NO es lo mismo que no declararlo", () => {
    const r = compararPoliticas([{}, { kmlCorridorMeters: 120 }], ["kmlCorridorMeters"]);
    expect(r[0]!.clase).toBe("solo en uno");
    expect(r[0]!.declarado[0]).toBeUndefined();
    // Y el efectivo sí es el de fábrica: el motor aplica 120 igual.
    expect(r[0]!.efectivo[0]).toBe(120);
  });

  it("un campo que NINGUNO declara sale «igual», pero con su valor de fábrica visible", () => {
    const r = compararPoliticas([{}, {}], ["kmlCorridorMeters"]);
    expect(r[0]!.clase).toBe("igual");
    expect(r[0]!.declarado).toEqual([undefined, undefined]);
    expect(r[0]!.efectivo).toEqual([120, 120]);
  });

  /*
   * Se recorre el ESQUEMA y no las llaves presentes: recorrer las llaves no
   * puede ver un campo que ninguno de los dos declara, que es justo el caso de
   * `frechetMaxKm` — los dos contratos corren con 0.8 de fábrica y ninguno lo
   * dice.
   */
  it("informa de un campo aunque ninguna de las dos políticas lo mencione", () => {
    const r = compararPoliticas([{}, {}], CAMPOS);
    expect(r.map((x) => x.campo)).toEqual(CAMPOS);
  });

  it("marca cuáles campos deciden un veredicto", () => {
    const r = compararPoliticas([{}, {}], ["kmlMatchMinPct", "windowSlackPct"]);
    expect(r.find((x) => x.campo === "kmlMatchMinPct")!.decide).toBe(true);
    expect(r.find((x) => x.campo === "windowSlackPct")!.decide).toBe(false);
  });

  it("una lista con distinto contenido difiere aunque tenga el mismo largo", () => {
    const r = compararPoliticas(
      [{ excusableReasons: ["marchas"] }, { excusableReasons: ["ponchadura"] }],
      ["excusableReasons"],
    );
    expect(r[0]!.clase).toBe("difiere");
  });
});

describe("representar", () => {
  it("distingue una lista vacía de un campo ausente", () => {
    expect(representar([])).toBe("[] (vacío)");
    expect(representar(undefined)).toBe("—");
  });

  /*
   * `[object Object]` sería un valor correcto convertido en una afirmación
   * vacía: «tiene reglas» y «tiene ESTAS reglas» se verían idénticas.
   */
  it("una lista de objetos no se colapsa en [object Object]", () => {
    const salida = representar([{ tipo: "no_pago", minutos: 5 }]);
    expect(salida).not.toContain("[object Object]");
    expect(salida).toContain("no_pago");
  });
});
