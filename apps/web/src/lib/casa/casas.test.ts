import { describe, it, expect } from "vitest";
import {
  CASAS,
  cuentaEntradas,
  menuDe,
  type Alcance,
  type Cara,
  type Casa,
} from "@/lib/casa/casas";

/**
 * Las reglas del mapa de la casa, comprobadas.
 *
 * `docs/Mapa-De-La-Casa.md` las escribe en prosa; aquí se vuelven algo que se
 * rompe cuando alguien las contradice. Sin esto, «dos niveles como máximo» y
 * «lo que no aplica no aparece» son buenas intenciones que se erosionan cuarto
 * por cuarto, y nadie se entera hasta que la casa ya está mal partida.
 */

const CARAS: Cara[] = ["transportista", "planta", "corporativo", "jstaff"];

const TODO: Alcance = { conContrato: true, operaPublico: true };
const PELADO: Alcance = { conContrato: false, operaPublico: false };

/** Le pone cuarto a todos los lugares, para poder probar el filtro de la regla 4
 *  sin que el de «todavía no existe» se coma la respuesta antes. */
function conCuartos(casa: Casa): Casa {
  return {
    ...casa,
    grupos: casa.grupos.map((grupo) => ({
      ...grupo,
      lugares: grupo.lugares.map((lugar) => ({
        ...lugar,
        ruta: `${casa.base}/x`,
        hijos: lugar.hijos?.map((hijo) => ({ ...hijo, ruta: `${casa.base}/x/y` })),
      })),
    })),
  };
}

describe("regla 3 — dos niveles como máximo, y pocos lugares", () => {
  it("ninguna casa pasa de seis entradas de primer nivel", () => {
    for (const cara of CARAS) {
      // Con el alcance abierto de par en par, que es el peor caso: una cuenta
      // con contrato y con transporte público ve todo lo que su casa puede dar.
      expect(cuentaEntradas(CASAS[cara], TODO), `casa ${cara}`).toBeLessThanOrEqual(6);
    }
  });

  it("el segundo nivel es el último: ningún hijo tiene hijos", () => {
    // El tipo `Lugar` ya lo impide, pero el tipo se puede aflojar sin querer y
    // esto lo nota. La casa que necesita un tercer nivel está mal partida.
    for (const cara of CARAS) {
      for (const grupo of CASAS[cara].grupos) {
        for (const lugar of grupo.lugares) {
          for (const hijo of lugar.hijos ?? []) {
            expect(Object.keys(hijo), `${cara} · ${lugar.nombre} · ${hijo.nombre}`).not.toContain(
              "hijos",
            );
          }
        }
      }
    }
  });
});

describe("regla 4 — lo que no aplica, no aparece", () => {
  it("sin contrato no hay Cumplimiento, y sin público no hay Circuitos", () => {
    const menu = menuDe(conCuartos(CASAS.transportista), PELADO);
    const nombres = menu.flatMap((grupo) => grupo.lugares.map((lugar) => lugar.nombre));

    expect(nombres).toContain("Flota en vivo");
    expect(nombres).toContain("Expedientes");
    expect(nombres).not.toContain("Cumplimiento");
    expect(nombres).not.toContain("Circuitos");
  });

  it("con contrato y con público, los dos aparecen", () => {
    const menu = menuDe(conCuartos(CASAS.transportista), TODO);
    const nombres = menu.flatMap((grupo) => grupo.lugares.map((lugar) => lugar.nombre));

    expect(nombres).toContain("Cumplimiento");
    expect(nombres).toContain("Circuitos");
  });

  it("un grupo que se queda sin lugares desaparece con su sello", () => {
    // Un sello suelto anunciaría una sección que no está: «Vernier» encima de
    // nada es exactamente la promesa que la pantalla no puede cumplir.
    const sellos = menuDe(conCuartos(CASAS.transportista), PELADO).map((grupo) => grupo.sello);

    expect(sellos).toContain("Compás");
    expect(sellos).not.toContain("Vernier");
    expect(sellos).not.toContain("Transporte público");
  });

  it("el segundo nivel se filtra igual que el primero", () => {
    const menu = menuDe(conCuartos(CASAS.transportista), TODO);
    const cumplimiento = menu
      .flatMap((grupo) => grupo.lugares)
      .find((lugar) => lugar.nombre === "Cumplimiento");

    expect(cumplimiento?.hijos?.map((hijo) => hijo.nombre)).toEqual(["Contratos y perfiles"]);
  });
});

describe("un cuarto que no existe no se dibuja", () => {
  it("hoy ninguna casa tiene lugares: el cascarón entró sin un solo cuarto", () => {
    // Esta prueba se cae —a propósito— el día que aterrice el primer cuarto.
    // Cuando eso pase, se cambia por la afirmación de que ESE lugar aparece y
    // los demás no: la regla que cuida es que el menú liste lo construido, no
    // que esté vacío para siempre.
    for (const cara of CARAS) {
      expect(menuDe(CASAS[cara], TODO), `casa ${cara}`).toEqual([]);
    }
  });

  it("un lugar con cuarto aparece aunque sus hermanos no lo tengan", () => {
    const casa = CASAS.planta;
    const conUno: Casa = {
      ...casa,
      grupos: casa.grupos.map((grupo) => ({
        ...grupo,
        lugares: grupo.lugares.map((lugar) =>
          lugar.nombre === "El día" ? { ...lugar, ruta: "/casa/planta/el-dia" } : lugar,
        ),
      })),
    };

    const menu = menuDe(conUno, TODO);
    expect(menu.flatMap((grupo) => grupo.lugares.map((lugar) => lugar.nombre))).toEqual(["El día"]);
  });
});

describe("los nombres son de cosa, no de producto (opción B)", () => {
  it("ninguna entrada del menú se llama como el producto", () => {
    // El producto va como sello encima de su sección, nunca como entrada: un
    // coordinador sabe buscar «cumplimiento», no «Vernier».
    const productos = ["Compás", "Vernier"];

    for (const cara of CARAS) {
      for (const grupo of CASAS[cara].grupos) {
        for (const lugar of grupo.lugares) {
          expect(productos, `casa ${cara}`).not.toContain(lugar.nombre);
        }
      }
    }
  });

  it("los sellos del transportista son los tres del mapa", () => {
    expect(CASAS.transportista.grupos.map((grupo) => grupo.sello)).toEqual([
      "Compás",
      null,
      "Vernier",
      "Transporte público",
    ]);
  });
});

describe("cada casa tiene una puerta, y responde una sola pregunta", () => {
  it("las cuatro preguntas son las del mapa", () => {
    expect(CASAS.transportista.pregunta).toBe("¿Dónde está mi flota?");
    expect(CASAS.planta.pregunta).toBe("¿Qué pasó hoy?");
    expect(CASAS.corporativo.pregunta).toBe("¿Cómo vamos, y con quién?");
    expect(CASAS.jstaff.pregunta).toBe("¿Está sana la plataforma?");
  });
});
