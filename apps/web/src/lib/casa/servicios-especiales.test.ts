import { describe, expect, it } from "vitest";
import type { OcurrenciaDeLaLista } from "@jtel/services";
import { CASAS, menuDe } from "@/lib/casa/casas";
import {
  SIN_FILTROS,
  VEREDICTOS,
  bloques,
  conteos,
  hayFilaDeContratos,
  laLista,
  loQueSeCuenta,
  palabraDelConteo,
  pasaBusqueda,
  turnosDeLaVentana,
  type Filtros,
} from "@/lib/casa/servicios-especiales";

/** Una ocurrencia sellada de ejemplo. Todo nombre aquí es ejemplo: el código no conoce ninguno. */
function oc(x: Partial<OcurrenciaDeLaLista> & { id: string }): OcurrenciaDeLaLista {
  return {
    fecha: "2026-09-17",
    contrato: { id: "cA", nombre: "Contrato A" },
    ruta: "R-01",
    turno: { id: "t1", nombre: "T1" },
    ventana: { desde: "06:45", hasta: "06:50" },
    llegadaExigida: "2026-09-17T12:45:00.000Z",
    veredicto: "cumplido",
    timing: "a_tiempo",
    unidadObservada: "2115",
    selladoAt: "2026-09-17T14:31:07.000Z",
    resellado: false,
    motivo: { clave: "llego", corto: "llegó 06:47 · a tiempo", largo: "", cifras: [], nota: null },
    ...x,
  };
}

const T2 = { id: "t2", nombre: "T2" };
const V2 = { desde: "14:45", hasta: "14:50" };

const MUESTRA: OcurrenciaDeLaLista[] = [
  oc({ id: "1" }),
  oc({ id: "2", ruta: "R-04", veredicto: "cumplido", timing: "tarde", unidadObservada: "2120" }),
  oc({ id: "3", ruta: "R-07", veredicto: "pendiente_evidencia", timing: null, unidadObservada: null, motivo: { clave: "llegada_sin_atribucion", corto: "llegada sin atribuir", largo: "", cifras: [], nota: null } }),
  oc({ id: "4", ruta: "R-11", turno: T2, ventana: V2, llegadaExigida: "2026-09-17T20:45:00.000Z", veredicto: "no_cumplido", timing: null, unidadObservada: null }),
  oc({ id: "5", ruta: "R-21", contrato: { id: "cB", nombre: "Contrato B" }, veredicto: "pendiente_evidencia", timing: null }),
  oc({ id: "6", fecha: "2026-09-16", ruta: "R-01", llegadaExigida: "2026-09-16T12:45:00.000Z" }),
  oc({ id: "7", fecha: "2026-09-16", ruta: "R-06", turno: T2, ventana: V2, llegadaExigida: "2026-09-16T20:45:00.000Z", contrato: { id: "cB", nombre: "Contrato B" } }),
];

describe("ley de coherencia: los conteos cuentan exactamente lo que la lista muestra (§6, prueba 1)", () => {
  const contratos = [null, "cA", "cB"];
  const turnos = [null, "t1", "t2"];
  const busquedas = ["", "R-0", "sin unidad", "tarde", "jue", "contrato b 16", "nada-que-coincida"];
  const veredictos = [null, ...VEREDICTOS];

  it("bajo cualquier combinación de contrato, turno, búsqueda y chip de veredicto", () => {
    let combinaciones = 0;
    for (const contratoId of contratos)
      for (const turnoId of turnos)
        for (const q of busquedas)
          for (const veredicto of veredictos) {
            const f: Filtros = { contratoId, turnoId, q, veredicto };
            const base = loQueSeCuenta(MUESTRA, f);
            const c = conteos(base);
            const lista = laLista(base, f.veredicto);
            // El total es lo que se ve sin chip; la suma de los tres, también.
            expect(c.total).toBe(laLista(base, null).length);
            expect(c.cumplido + c.pendiente_evidencia + c.no_cumplido).toBe(c.total);
            // Con un chip prendido, su número es exactamente lo que queda abajo.
            if (veredicto) expect(lista).toHaveLength(c[veredicto]);
            else expect(lista).toHaveLength(c.total);
            // Los bloques no pierden ni duplican una sola pieza.
            expect(bloques(lista, null).flatMap((b) => b.piezas)).toHaveLength(lista.length);
            combinaciones += 1;
          }
    expect(combinaciones).toBe(3 * 3 * 7 * 4);
  });

  it("el chip de veredicto no mueve los conteos: son de la base, no de la lista", () => {
    const sin = conteos(loQueSeCuenta(MUESTRA, SIN_FILTROS));
    const con = conteos(loQueSeCuenta(MUESTRA, { ...SIN_FILTROS, veredicto: "no_cumplido" }));
    expect(con).toEqual(sin);
  });
});

describe("el buscador: todas las palabras, dentro de la ventana", () => {
  it("cada término tiene que coincidir", () => {
    expect(pasaBusqueda(MUESTRA[1]!, "R-04 tarde")).toBe(true);
    expect(pasaBusqueda(MUESTRA[1]!, "R-04 pendiente")).toBe(false);
  });

  it("busca por ruta, unidad, turno, fecha, contrato y veredicto, sin acentos ni mayúsculas", () => {
    const o = MUESTRA[4]!;
    for (const q of ["r-21", "t1", "2026-09-17", "jue 17 sep", "jueves", "contrato b", "PENDIENTE de evidencia", "unidad 2115"]) {
      expect(pasaBusqueda(o, q), q).toBe(true);
    }
    expect(pasaBusqueda(MUESTRA[5]!, "miercoles")).toBe(true);
  });
});

describe("bloques cronológicos (§6, prueba 3)", () => {
  it("fechas descendentes, turnos ascendentes dentro del día; fecha en el título sólo con ventana de varios días", () => {
    const b = bloques(MUESTRA, null);
    expect(b.map((x) => x.titulo)).toEqual([
      "jue 17 sep · T1 · 06:45–06:50",
      "jue 17 sep · T2 · 14:45–14:50",
      "mié 16 sep · T1 · 06:45–06:50",
      "mié 16 sep · T2 · 14:45–14:50",
    ]);
  });

  it("con ventana de un solo día, el bloque omite la fecha", () => {
    const delDia = MUESTRA.filter((o) => o.fecha === "2026-09-17");
    expect(bloques(delDia, "2026-09-17").map((x) => x.titulo)).toEqual(["T1 · 06:45–06:50", "T2 · 14:45–14:50"]);
  });

  it("…salvo que una ocurrencia sea de otra fecha civil: callarla la haría pasar por la de hoy", () => {
    const b = bloques([oc({ id: "x", fecha: "2026-09-16" })], "2026-09-17");
    expect(b[0]!.titulo).toBe("mié 16 sep · T1 · 06:45–06:50");
  });

  it("dos turnos del mismo nombre en dos contratos no dan dos bloques con el mismo título", () => {
    const b = bloques(
      [oc({ id: "a" }), oc({ id: "b", turno: { id: "otro", nombre: "T1" }, contrato: { id: "cB", nombre: "Contrato B" } })],
      "2026-09-17",
    );
    expect(b.map((x) => x.titulo).sort()).toEqual(["T1 · Contrato A · 06:45–06:50", "T1 · Contrato B · 06:45–06:50"]);
  });

  it("el riesgo no ordena: dentro del bloque, por hora exigida y ruta, no por veredicto", () => {
    const b = bloques(MUESTRA.filter((o) => o.fecha === "2026-09-17" && o.turno.id === "t1"), null);
    expect(b[0]!.piezas.map((p) => p.ruta)).toEqual(["R-01", "R-04", "R-07", "R-21"]);
    // El mismo turno en dos contratos es un solo bloque: es el mismo turno.
    expect(b).toHaveLength(1);
  });
});

describe("los chips", () => {
  it("la palabra del conteo concuerda con su número", () => {
    expect(palabraDelConteo("cumplido", 1)).toBe("cumplido");
    expect(palabraDelConteo("cumplido", 4)).toBe("cumplidos");
    expect(palabraDelConteo("no_cumplido", 0)).toBe("no cumplidos");
    expect(palabraDelConteo("pendiente_evidencia", 2)).toBe("pendiente de evidencia");
  });

  it("los turnos salen de lo que hay en la ventana, en el orden del día, con su ventana sellada", () => {
    expect(turnosDeLaVentana(MUESTRA, null).map((t) => `${t.nombre} · ${t.ventana}`)).toEqual([
      "T1 · 06:45–06:50",
      "T2 · 14:45–14:50",
    ]);
    expect(turnosDeLaVentana(MUESTRA, "cA").map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("un turno con dos ventanas distintas lo dice, no elige una", () => {
    const chips = turnosDeLaVentana([oc({ id: "a" }), oc({ id: "b", ventana: { desde: "06:45", hasta: "06:55" } })], null);
    expect(chips[0]!.ventana).toBe("ventanas distintas");
  });

  it("dos turnos con el mismo nombre se separan por su contrato", () => {
    const chips = turnosDeLaVentana(
      [oc({ id: "a" }), oc({ id: "b", turno: { id: "otro", nombre: "T1" }, contrato: { id: "cB", nombre: "Contrato B" } })],
      null,
    );
    expect(chips.map((c) => c.nombre).sort()).toEqual(["T1 · Contrato A", "T1 · Contrato B"]);
  });

  it("con un solo contrato, la fila de contratos no existe (§6, prueba 6)", () => {
    expect(hayFilaDeContratos([{ id: "cA" }])).toBe(false);
    expect(hayFilaDeContratos([{ id: "cA" }, { id: "cB" }])).toBe(true);
  });
});

describe("el cuarto sólo existe con contrato (§6, prueba 5)", () => {
  const nombres = (conContrato: boolean) =>
    menuDe(CASAS.transportista, { conContrato, operaPublico: false }).flatMap((g) => g.lugares.map((l) => l.nombre));

  it("sin contrato no hay pestaña: ni apagada, ni con candado", () => {
    expect(nombres(false)).not.toContain("Servicios especiales");
  });

  it("con contrato aparece, bajo el sello Vernier", () => {
    expect(nombres(true)).toContain("Servicios especiales");
    const grupo = menuDe(CASAS.transportista, { conContrato: true, operaPublico: false }).find((g) =>
      g.lugares.some((l) => l.nombre === "Servicios especiales"),
    );
    expect(grupo?.sello).toBe("Vernier");
  });
});
