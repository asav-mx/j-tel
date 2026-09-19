import { describe, it, expect } from "vitest";
import {
  CASAS,
  conCuenta,
  cuartoDeLaRuta,
  cuentaEntradas,
  estaEnLugar,
  menuDe,
  selloActivo,
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
        // Una ruta DISTINTA por lugar, sacada de su nombre. Antes todas eran la
        // misma (`base/x`) y no se notaba, porque las pruebas de entonces sólo
        // miraban nombres. En cuanto algo pregunta «¿dónde estoy?» —el sello de
        // la sección— rutas repetidas hacen que siempre gane la primera.
        ruta: `${casa.base}/${ranura(lugar.nombre)}`,
        hijos: lugar.hijos?.map((hijo) => ({
          ...hijo,
          ruta: `${casa.base}/${ranura(lugar.nombre)}/${ranura(hijo.nombre)}`,
        })),
      })),
    })),
  };
}

/** Un trozo de ruta estable a partir de un nombre, sólo para las pruebas. */
function ranura(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  it("sin contrato no hay Servicios especiales, y sin público no hay Circuitos", () => {
    const menu = menuDe(conCuartos(CASAS.transportista), PELADO);
    const nombres = menu.flatMap((grupo) => grupo.lugares.map((lugar) => lugar.nombre));

    expect(nombres).toContain("Flota en vivo");
    expect(nombres).toContain("Expedientes");
    expect(nombres).not.toContain("Servicios especiales");
    expect(nombres).not.toContain("Circuitos");
  });

  it("con contrato y con público, los dos aparecen", () => {
    const menu = menuDe(conCuartos(CASAS.transportista), TODO);
    const nombres = menu.flatMap((grupo) => grupo.lugares.map((lugar) => lugar.nombre));

    expect(nombres).toContain("Servicios especiales");
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
    const servicios = menu
      .flatMap((grupo) => grupo.lugares)
      .find((lugar) => lugar.nombre === "Servicios especiales");

    expect(servicios?.hijos?.map((hijo) => hijo.nombre)).toEqual(["Contratos y perfiles"]);
  });
});

describe("un cuarto que no existe no se dibuja", () => {
  it("el menú lista lo construido: Flota en vivo, Expedientes y Servicios especiales en el transportista, Cuentas y demos en J-Staff", () => {
    // Esta prueba cambia cada vez que aterriza un cuarto. Lo que cuida no es la
    // lista de hoy: es que el menú liste lo construido y nada más.
    expect(menuDe(CASAS.transportista, TODO)).toEqual([
      {
        sello: "Compás",
        lugares: [
          { nombre: "Flota en vivo", ruta: "/casa/transportista/flota", condicion: "siempre", hijos: undefined },
        ],
      },
      { sello: null, lugares: [{ nombre: "Expedientes", ruta: "/casa/transportista/expedientes", condicion: "siempre", hijos: undefined }] },
      {
        sello: "Vernier",
        lugares: [
          // «Contratos y perfiles» está declarado pero sin cuarto: no se dibuja.
          { nombre: "Servicios especiales", ruta: "/casa/transportista/servicios-especiales", condicion: "con-contrato", hijos: [] },
        ],
      },
    ]);
    expect(menuDe(CASAS.jstaff, TODO)).toEqual([
      {
        sello: null,
        lugares: [
          {
            nombre: "Cuentas y demos",
            ruta: "/casa/jstaff/cuentas-y-demos",
            condicion: "siempre",
            hijos: [
              { nombre: "Catálogo de documentos", ruta: "/casa/jstaff/cuentas-y-demos/catalogo", condicion: "siempre" },
              { nombre: "Contratos", ruta: "/casa/jstaff/cuentas-y-demos/contratos", condicion: "siempre" },
            ],
          },
        ],
      },
    ]);
    for (const cara of ["planta", "corporativo"] as const) {
      expect(menuDe(CASAS[cara], TODO), `casa ${cara}`).toEqual([]);
    }
  });

  it("la puerta del transportista es Flota en vivo, y desde C2 tiene cuarto", () => {
    // El primer lugar del primer grupo. Construir Expedientes antes no le prestó la puerta.
    expect(CASAS.transportista.grupos[0]!.lugares[0]).toMatchObject({
      nombre: "Flota en vivo",
      ruta: "/casa/transportista/flota",
    });
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
    // coordinador sabe buscar lo que hace, no «Vernier».
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

describe("el sello de la sección, que es lo que el celular tenía perdido", () => {
  // En computadora los tres sellos se ven a la vez encima de sus pestañas. En
  // el teléfono no cabe ninguno, y sin esto «Compás» y «Vernier» no los vería
  // nunca quien sólo usa el celular — que vacía media razón de la opción B.
  const menu = menuDe(conCuartos(CASAS.transportista), TODO);
  const rutaDe = (nombre: string) =>
    menu.flatMap((g) => g.lugares).find((l) => l.nombre === nombre)!.ruta as string;

  it("estando en un lugar, el sello es el de su grupo", () => {
    expect(selloActivo(menu, rutaDe("Flota en vivo"))).toBe("Compás");
    expect(selloActivo(menu, rutaDe("Circuitos"))).toBe("Transporte público");
  });

  it("el segundo nivel conserva el sello de su padre", () => {
    // Dentro de «Contratos y perfiles» se sigue estando en Vernier: si el sello
    // se apagara al bajar un nivel, parpadearía al navegar.
    const servicios = menu.flatMap((g) => g.lugares).find((l) => l.nombre === "Servicios especiales")!;
    expect(selloActivo(menu, servicios.hijos![0].ruta as string)).toBe("Vernier");
  });

  it("un grupo sin producto no inventa uno", () => {
    // El mapa no le pone nombre de producto a Expedientes. Ponérselo por
    // simetría sería marca donde no la hay.
    expect(selloActivo(menu, rutaDe("Expedientes"))).toBeNull();
  });

  it("en la puerta de la casa todavía no hay sección, y no hay sello", () => {
    expect(selloActivo(menu, "/casa/transportista")).toBeNull();
  });
});

describe("«estoy aquí» es una sola regla", () => {
  it("vale para la ruta exacta y para lo que cuelga de ella", () => {
    // Así el padre sigue marcado mientras se navega su segundo nivel.
    expect(estaEnLugar("/casa/planta/el-dia", "/casa/planta/el-dia")).toBe(true);
    expect(estaEnLugar("/casa/planta/el-dia/10254", "/casa/planta/el-dia")).toBe(true);
  });

  it("no se deja engañar por un nombre que empieza igual", () => {
    // «/el-dia-anterior» no cuelga de «/el-dia»: sin la barra, dos lugares
    // distintos se marcarían activos al mismo tiempo.
    expect(estaEnLugar("/casa/planta/el-dia-anterior", "/casa/planta/el-dia")).toBe(false);
  });

  it("un lugar sin cuarto nunca está activo", () => {
    expect(estaEnLugar("/casa/planta", null)).toBe(false);
  });
});

/*
 * La cuenta al navegar (16 sep 2026). Se entraba con ?account=juarez-bus, se
 * tocaba Expedientes y se caía en «no hay cuenta»: las pestañas ligaban a la
 * ruta pelona. Estas dos reglas son las que el marco usa para no perderla.
 */
describe("conCuenta — arrastrar la cuenta", () => {
  it("sin cuenta, la ruta queda limpia", () => {
    expect(conCuenta("/casa/transportista/expedientes", null)).toBe("/casa/transportista/expedientes");
    expect(conCuenta("/casa/transportista/expedientes")).toBe("/casa/transportista/expedientes");
  });

  it("con cuenta, la agrega", () => {
    expect(conCuenta("/casa/transportista/expedientes", "juarez-bus")).toBe(
      "/casa/transportista/expedientes?account=juarez-bus",
    );
  });

  it("si la ruta ya trae parámetros, se suma con & y no con un segundo ?", () => {
    expect(conCuenta("/x/papel/t?accion=renovar", "juarez-bus")).toBe("/x/papel/t?accion=renovar&account=juarez-bus");
  });

  it("escapa el slug", () => {
    expect(conCuenta("/x", "a&b")).toBe("/x?account=a%26b");
  });
});

describe("cuartoDeLaRuta — cambiar de cuenta lleva al cuarto, no a la ficha", () => {
  const t = CASAS.transportista;

  it("desde la ficha de una unidad, a Expedientes", () => {
    expect(cuartoDeLaRuta(t, "/casa/transportista/expedientes/unidad/u-1042")).toBe("/casa/transportista/expedientes");
  });

  it("desde un papel, a Expedientes", () => {
    expect(cuartoDeLaRuta(t, "/casa/transportista/expedientes/unidad/u-1042/papel/p-1")).toBe(
      "/casa/transportista/expedientes",
    );
  });

  it("desde el cuarto mismo, a él", () => {
    expect(cuartoDeLaRuta(t, "/casa/transportista/flota")).toBe("/casa/transportista/flota");
  });

  it("un hijo gana a su padre", () => {
    expect(cuartoDeLaRuta(CASAS.jstaff, "/casa/jstaff/cuentas-y-demos/catalogo/tipo-9")).toBe(
      "/casa/jstaff/cuentas-y-demos/catalogo",
    );
  });

  it("no confunde un prefijo de texto con un lugar", () => {
    expect(cuartoDeLaRuta(t, "/casa/transportista/flotante")).toBe(t.base);
  });

  it("fuera de todo lugar, a la puerta de la casa", () => {
    expect(cuartoDeLaRuta(t, "/casa/transportista")).toBe(t.base);
  });
});
