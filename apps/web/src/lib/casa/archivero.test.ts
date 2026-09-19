import { describe, expect, it } from "vitest";
import type { CuartoDeExpedientes, DispositivoDelCuarto, UnidadDelCuarto } from "@jtel/services";
import {
  CHIPS,
  armarArchivero,
  buscarEnTodo,
  claseDeUnidad,
  conteosDeChips,
  destinoDeLaDireccionVieja,
  laBase,
  piezasQuePidenAtencion,
  rutaDelCajon,
  seccionesDelCajon,
  tarjetaDeCajon,
  type Cajon,
} from "./archivero";

const AHORA = new Date("2026-09-19T18:00:00Z");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

const alDia = { estado: "con_datos" as const, valor: { pidenAlgo: 0, faltaLaRegla: 0, peor: "vigente" as const, estaAlDia: true } };
const piden = (n: number) => ({ estado: "con_datos" as const, valor: { pidenAlgo: n, faltaLaRegla: 0, peor: "vencido" as const, estaAlDia: false } });
const sinRegla = { estado: "con_datos" as const, valor: { pidenAlgo: 0, faltaLaRegla: 4, peor: "falta_la_regla" as const, estaAlDia: false } };

function unidad(id: string, papeles: UnidadDelCuarto["papeles"], extra: Partial<UnidadDelCuarto> = {}): UnidadDelCuarto {
  return { id, numeroEconomico: id, placa: `ABC-${id}`, vin: null, activa: true, papeles, ...extra };
}

function dispositivo(id: string, estado: DispositivoDelCuarto["estado"], unidadMontada: string | null = null): DispositivoDelCuarto {
  return { id, nombre: `TK-FTC927-${id}`, imei: `86${id}000000000`, estado, unidad: unidadMontada };
}

const montado = { unidadId: "u", montadoDesde: hace(500) };

function cuarto(): CuartoDeExpedientes {
  return {
    mercado: { nombre: "Chihuahua", hoy: "2026-09-19" },
    unidades: [
      unidad("2101", piden(2), { vin: "3HGCM82633A004352" }),
      unidad("2109", sinRegla),
      unidad("2120", sinRegla),
      unidad("2126", alDia),
      unidad("1846", alDia, { activa: false }),
    ],
    dispositivos: {
      enServicio: [
        dispositivo("001", { grupo: "desconectado", ...montado, ultimaSenalAt: hace(120) }, "2109"),
        dispositivo("003", { grupo: "en_unidad", ...montado, ultimaSenalAt: hace(0.05) }, "2120"),
        dispositivo("004", { grupo: "en_unidad", ...montado, ultimaSenalAt: hace(3) }, "2101"),
        dispositivo("005", { grupo: "en_bodega", ultimaSenalAt: null }),
        dispositivo("006", { grupo: "en_bodega", ultimaSenalAt: hace(200) }),
      ],
      deBaja: [dispositivo("900", { grupo: "de_baja", retiredAt: hace(300), retiredReason: "Se quemó", ultimaSenalAt: hace(400) })],
    },
    choferes: { estado: "vacia" },
    papelesQuePidenAlgo: 2,
  };
}

const archivero = () => armarArchivero(cuarto(), AHORA, "juarez-bus");
const nombres = (ps: { nombre: string }[]) => ps.map((p) => p.nombre);

describe("la clase de una unidad: al día sólo lo que se juzgó (enmienda 1)", () => {
  it("una unidad sin regla en su mercado queda sin juzgar, no al día", () => {
    expect(claseDeUnidad(unidad("x", sinRegla))).toEqual({ clase: "sin_juzgar", causa: "sin_regla" });
  });

  it("sin mercado y sin catálogo también quedan sin juzgar, cada una con su causa", () => {
    expect(claseDeUnidad(unidad("x", { estado: "aun_no_disponible", fuente: "mercado_de_la_cuenta" }))).toEqual({
      clase: "sin_juzgar",
      causa: "sin_mercado",
    });
    expect(claseDeUnidad(unidad("x", { estado: "vacia" }))).toEqual({ clase: "sin_juzgar", causa: "sin_catalogo" });
  });

  it("lo que pide algo gana aunque otro papel no tenga regla", () => {
    const mixta = { estado: "con_datos" as const, valor: { pidenAlgo: 1, faltaLaRegla: 3, peor: "vencido" as const, estaAlDia: false } };
    expect(claseDeUnidad(unidad("x", mixta)).clase).toBe("piden");
  });

  it("una inactiva es inactiva, pida lo que pida", () => {
    expect(claseDeUnidad(unidad("x", piden(3), { activa: false })).clase).toBe("inactiva");
  });
});

describe("1 · el buscador del tablero atraviesa los tres cajones", () => {
  it("agrupa por cajón y busca todas las palabras", () => {
    const r = buscarEnTodo(archivero(), "2109");
    expect(nombres(r.unidades)).toEqual(["2109"]);
    // El 001 está montado en la 2109: se le encuentra por la unidad donde está.
    expect(nombres(r.dispositivos)).toEqual(["TK-FTC927-001"]);
    expect(buscarEnTodo(archivero(), "ftc 005").dispositivos).toHaveLength(1);
  });

  it("encuentra la unidad por su VIN y por su placa, sin importar mayúsculas", () => {
    expect(nombres(buscarEnTodo(archivero(), "3hgcm82633").unidades)).toEqual(["2101"]);
    expect(nombres(buscarEnTodo(archivero(), "abc-2126").unidades)).toEqual(["2126"]);
  });

  it("encuentra el dispositivo por su IMEI, y el de bodega por «bodega»", () => {
    expect(nombres(buscarEnTodo(archivero(), "86004").dispositivos)).toEqual(["TK-FTC927-004"]);
    expect(nombres(buscarEnTodo(archivero(), "bodega").dispositivos)).toEqual(["TK-FTC927-005", "TK-FTC927-006"]);
  });

  it("sin texto, todo pasa: la pantalla vuelve al tablero", () => {
    const r = buscarEnTodo(archivero(), "   ");
    expect(r.unidades).toHaveLength(5);
    expect(r.dispositivos).toHaveLength(6);
  });
});

describe("2 · los chips cuentan lo que la lista muestra, con la búsqueda aplicada", () => {
  const casos: Array<[Cajon, string]> = [
    ["unidades", ""],
    ["unidades", "21"],
    ["unidades", "abc 2126"],
    ["unidades", "nada-coincide"],
    ["dispositivos", ""],
    ["dispositivos", "bodega"],
    ["dispositivos", "ftc"],
  ];
  for (const [cajon, q] of casos) {
    it(`${cajon}, búsqueda «${q}»: cada chip = lo que su lista muestra`, () => {
      const base = laBase(archivero()[cajon], q);
      const conteos = conteosDeChips(cajon, base);
      for (const chip of CHIPS[cajon]) {
        const { secciones } = seccionesDelCajon(cajon, base, chip.clave, "Chihuahua");
        const mostradas = secciones.reduce((s, x) => s + x.piezas.length, 0);
        expect(mostradas, `chip ${chip.clave}`).toBe(conteos[chip.clave]);
      }
    });
  }

  it("los chips de dispositivos no se enciman: los grupos suman «Todos»", () => {
    const c = conteosDeChips("dispositivos", laBase(archivero().dispositivos, ""));
    expect(c.todos).toBe(5);
    expect(c.desconectado! + c.en_unidad! + c.en_bodega!).toBe(c.todos);
  });

  it("los de unidades tampoco: piden, sin juzgar y al día suman «Todas»", () => {
    const c = conteosDeChips("unidades", laBase(archivero().unidades, ""));
    expect(c.todas).toBe(4);
    expect(c.piden! + c.sin_juzgar! + c.al_dia!).toBe(c.todas);
  });
});

describe("3 · «Piden atención»: ni más ni menos", () => {
  it("las unidades que piden algo, el desconectado y el de bodega que nunca reportó", () => {
    expect(nombres(piezasQuePidenAtencion(archivero()))).toEqual(["2101", "TK-FTC927-001", "TK-FTC927-005"]);
  });

  it("no entran: sin juzgar, al día, inactivas, el de bodega que sí reportó, ni el de baja", () => {
    const fuera = nombres(piezasQuePidenAtencion(archivero()));
    for (const n of ["2109", "2126", "1846", "TK-FTC927-006", "TK-FTC927-900"]) expect(fuera).not.toContain(n);
  });

  it("el que nunca reportó lo dice, y sigue en bodega con su cuadro hueco", () => {
    const p = archivero().dispositivos.find((d) => d.nombre === "TK-FTC927-005")!;
    expect(p).toMatchObject({ clase: "en_bodega", glifo: "dispositivo-en-bodega", etiqueta: "nunca reportó", apagada: false });
  });

  it("un recién dado de alta que nadie ha prendido también entra", () => {
    const c = cuarto();
    c.dispositivos.enServicio.push(dispositivo("009", { grupo: "en_bodega", ultimaSenalAt: null }));
    expect(nombres(piezasQuePidenAtencion(armarArchivero(c, AHORA, null)))).toContain("TK-FTC927-009");
  });
});

describe("4 · un cajón vacío declara su vacío", () => {
  it("Choferes sin nadie dice que no hay choferes", () => {
    const t = tarjetaDeCajon("choferes", archivero().choferes);
    expect(t).toMatchObject({ cifra: 0, vacio: "Sin choferes dados de alta" });
  });

  it("una cuenta sin unidades lo dice, no esconde la tarjeta", () => {
    expect(tarjetaDeCajon("unidades", []).vacio).toBe("Sin unidades dadas de alta");
  });
});

describe("las tarjetas del tablero: las partes suman la cifra", () => {
  it("unidades: la cifra es lo activo, y piden + sin juzgar + al día la suman", () => {
    const t = tarjetaDeCajon("unidades", archivero().unidades);
    expect(t).toMatchObject({ cifra: 4, piden: "1 pide algo", partes: ["2 sin juzgar", "1 al día"] });
  });

  it("dispositivos: los grupos suman la cifra; «piden algo» va aparte porque atraviesa grupos", () => {
    const t = tarjetaDeCajon("dispositivos", archivero().dispositivos);
    expect(t).toMatchObject({ cifra: 5, piden: "2 piden algo", partes: ["2 en unidad", "2 en bodega", "1 desconectado"] });
  });
});

describe("las secciones del cajón", () => {
  it("unidades: Piden algo · Sin juzgar · Al día, y la causa de «Sin juzgar» en una línea", () => {
    const { secciones, plegadas } = seccionesDelCajon("unidades", archivero().unidades, "todas", "Chihuahua");
    expect(secciones.map((s) => s.titulo)).toEqual(["Piden algo", "Sin juzgar", "Al día"]);
    expect(secciones[1]!.explicacion).toEqual([
      "Sin regla cargada para su mercado (Chihuahua): hasta que el catálogo la tenga, sus papeles no se declaran al día ni faltantes.",
    ]);
    expect(nombres(plegadas)).toEqual(["1846"]);
  });

  it("con un chip elegido, lo plegado no acompaña", () => {
    expect(seccionesDelCajon("unidades", archivero().unidades, "piden", null).plegadas).toEqual([]);
  });

  it("dispositivos: los grupos del inventario, y en bodega el que nunca reportó va arriba", () => {
    const c = cuarto();
    // El orden de llegada pone al 006 primero; la sección lo corrige.
    c.dispositivos.enServicio.reverse();
    const { secciones, plegadas } = seccionesDelCajon("dispositivos", armarArchivero(c, AHORA, null).dispositivos, "todos", null);
    expect(secciones.map((s) => s.titulo)).toEqual(["Desconectados", "En bodega", "En unidad"]);
    expect(nombres(secciones[1]!.piezas)).toEqual(["TK-FTC927-005", "TK-FTC927-006"]);
    expect(nombres(plegadas)).toEqual(["TK-FTC927-900"]);
  });
});

describe("las rutas", () => {
  it("los cajones cuelgan de Expedientes, con la cuenta cuando hace falta", () => {
    expect(rutaDelCajon("unidades")).toBe("/casa/transportista/expedientes/unidades");
    expect(rutaDelCajon("dispositivos", "juarez-bus")).toBe("/casa/transportista/expedientes/dispositivos?account=juarez-bus");
  });

  it("el dispositivo abre su ficha con la puerta del cajón", () => {
    const p = archivero().dispositivos[0]!;
    expect(p.ficha).toContain("desde=dispositivos");
  });
});

describe("5 · la dirección vieja de Dispositivos redirige al cajón", () => {
  it("sin nada, al cajón", () => {
    expect(destinoDeLaDireccionVieja({})).toBe("/casa/transportista/expedientes/dispositivos");
  });

  it("con todo lo que traía: la cuenta, el panel de alta, el hecho", () => {
    expect(destinoDeLaDireccionVieja({ account: "juarez-bus", accion: "alta" })).toBe(
      "/casa/transportista/expedientes/dispositivos?account=juarez-bus&accion=alta",
    );
    expect(destinoDeLaDireccionVieja({ hecho: "alta", dispositivo: "d1", account: "juarez-bus" })).toBe(
      "/casa/transportista/expedientes/dispositivos?hecho=alta&dispositivo=d1&account=juarez-bus",
    );
  });
});
