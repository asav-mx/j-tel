import { describe, it, expect } from "vitest";
import {
  bypassPorEncabezadoPermitido,
  resolverIdentidadDeDesarrollo,
  type EntornoDeIdentidad,
} from "./identidad-dev";

/**
 * El bypass de desarrollo — la única parte de `auth.ts` donde un error se
 * convierte en un agujero.
 *
 * Lo que estas pruebas custodian: que `x-jtel-user` dejó de ser un selector de
 * identidad abierto a quien llegue a la URL. Hoy eso todavía no es escalación
 * de privilegios porque nada comprueba membresías — pero se vuelve una el día
 * que empecemos a confiar en `getIdentidad()`, que es justo el paso siguiente.
 */

function entorno(over: Partial<EntornoDeIdentidad> = {}): EntornoDeIdentidad {
  return {
    pedido: null,
    token: null,
    enProduccion: true,
    secretoEsperado: undefined,
    usuarioPorVariable: undefined,
    ...over,
  };
}

describe("en producción, el encabezado no alcanza por sí solo", () => {
  it("sin secreto configurado, el encabezado se rechaza", () => {
    const r = resolverIdentidadDeDesarrollo(entorno({ pedido: "jstaff_admin" }));

    expect(r.userId).toBeNull();
    expect(r.origen).toBe("anonimo");
    expect(r.encabezadoRechazado).toBe(true);
  });

  it("con secreto configurado pero token equivocado, se rechaza", () => {
    const r = resolverIdentidadDeDesarrollo(
      entorno({ pedido: "jstaff_admin", token: "adivinado", secretoEsperado: "el-bueno" }),
    );

    expect(r.userId).toBeNull();
    expect(r.encabezadoRechazado).toBe(true);
  });

  it("con secreto configurado y token correcto, se acepta", () => {
    const r = resolverIdentidadDeDesarrollo(
      entorno({ pedido: "jstaff_admin", token: "el-bueno", secretoEsperado: "el-bueno" }),
    );

    expect(r.userId).toBe("jstaff_admin");
    expect(r.origen).toBe("encabezado-dev");
    expect(r.encabezadoRechazado).toBe(false);
  });

  it("un token sin encabezado de usuario no elige a nadie", () => {
    const r = resolverIdentidadDeDesarrollo(
      entorno({ token: "el-bueno", secretoEsperado: "el-bueno" }),
    );

    expect(r.origen).toBe("anonimo");
    expect(r.encabezadoRechazado).toBe(false);
  });
});

describe("fuera de producción el bypass sigue abierto — es la herramienta de trabajo", () => {
  it("el encabezado manda sin pedir token", () => {
    const r = resolverIdentidadDeDesarrollo(
      entorno({ pedido: "tecma_planta47", enProduccion: false }),
    );

    expect(r.userId).toBe("tecma_planta47");
    expect(r.origen).toBe("encabezado-dev");
  });
});

describe("el encabezado rechazado se ignora entero, nunca a medias", () => {
  /*
   * Antes decía que el rechazado caía a la variable del servidor. Fuera de
   * producción un encabezado nunca se rechaza, y en producción la variable ya
   * no cuenta (14 sep 2026), así que ese camino dejó de existir. Lo que queda
   * de la regla es lo que importaba: el usuario pedido no se acepta a medias.
   */
  it("el usuario pedido no se acepta, ni aunque haya variable puesta", () => {
    const r = resolverIdentidadDeDesarrollo(
      entorno({ pedido: "jstaff_admin", usuarioPorVariable: "tecma_admin" }),
    );

    expect(r.userId).not.toBe("jstaff_admin");
    expect(r.userId).toBeNull();
    expect(r.encabezadoRechazado).toBe(true);
  });
});

/**
 * La segunda pared — 14 de septiembre de 2026.
 *
 * `JTEL_DEV_USER=jstaff_admin` estaba puesta en Production, y la guardia de las
 * APIs no pedía sesión: cualquier anónimo era el administrador de la
 * plataforma. La variable ya se quitó de Vercel; esto hace que volver a
 * ponerla no le dé identidad a nadie.
 */
describe("en producción, JTEL_DEV_USER no existe", () => {
  it("el caso medido: la variable puesta y sin nada más, no hay nadie", () => {
    const r = resolverIdentidadDeDesarrollo(entorno({ usuarioPorVariable: "jstaff_admin" }));

    expect(r).toEqual({ userId: null, origen: "anonimo", encabezadoRechazado: false });
  });

  it("un encabezado rechazado tampoco cae a la variable", () => {
    const r = resolverIdentidadDeDesarrollo(
      entorno({ pedido: "tecma_admin", usuarioPorVariable: "jstaff_admin" }),
    );

    expect(r.userId).toBeNull();
    expect(r.encabezadoRechazado).toBe(true);
  });

  it("el encabezado con el token correcto sí sigue valiendo: es un secreto elegido, no un default", () => {
    const r = resolverIdentidadDeDesarrollo(
      entorno({
        pedido: "tecma_planta47",
        token: "el-bueno",
        secretoEsperado: "el-bueno",
        usuarioPorVariable: "jstaff_admin",
      }),
    );

    expect(r.userId).toBe("tecma_planta47");
    expect(r.origen).toBe("encabezado-dev");
  });
});

describe("sin encabezado, manda el servidor — fuera de producción", () => {
  it("la variable de entorno sigue mandando", () => {
    const r = resolverIdentidadDeDesarrollo(
      entorno({ usuarioPorVariable: "jb_admin", enProduccion: false }),
    );

    expect(r).toEqual({
      userId: "jb_admin",
      origen: "variable-dev",
      encabezadoRechazado: false,
    });
  });

  /**
   * Pieza 1.e — la muleta retirada.
   *
   * Aquí el código devolvía `tecma_admin`: un admin corporativo de una cuenta
   * de CLIENTE REAL, con todas sus membresías, entregado a quien llegara sin
   * ninguna señal. El peor fallo posible —quedarse sin nada— daba el acceso más
   * ancho que hay en una cuenta.
   */
  it("sin nada, no hay nadie — y `nadie` no es un usuario", () => {
    const r = resolverIdentidadDeDesarrollo(entorno());

    expect(r).toEqual({ userId: null, origen: "anonimo", encabezadoRechazado: false });
  });

  it("ninguna combinación devuelve una identidad que nadie eligió", () => {
    const combinaciones: Array<Partial<EntornoDeIdentidad>> = [
      {},
      { enProduccion: false },
      { pedido: "tecma_admin" },
      { pedido: "tecma_admin", token: "equivocado", secretoEsperado: "el-bueno" },
      { token: "el-bueno", secretoEsperado: "el-bueno" },
      { usuarioPorVariable: "" },
    ];

    for (const over of combinaciones) {
      const r = resolverIdentidadDeDesarrollo(entorno(over));
      // Nadie sale `tecma_admin` sin que alguien lo haya pedido a propósito.
      if (over.pedido !== "tecma_admin" || r.origen !== "encabezado-dev") {
        expect(r.userId).not.toBe("tecma_admin");
      }
    }
  });
});

describe("la comparación del secreto no se cae con largos distintos", () => {
  it("un token más corto que el esperado se rechaza sin lanzar", () => {
    expect(() =>
      bypassPorEncabezadoPermitido({
        token: "x",
        enProduccion: true,
        secretoEsperado: "un-secreto-mucho-mas-largo",
      }),
    ).not.toThrow();

    expect(
      bypassPorEncabezadoPermitido({
        token: "x",
        enProduccion: true,
        secretoEsperado: "un-secreto-mucho-mas-largo",
      }),
    ).toBe(false);
  });

  it("un token vacío nunca pasa, aunque el secreto también esté vacío", () => {
    expect(
      bypassPorEncabezadoPermitido({ token: "", enProduccion: true, secretoEsperado: "" }),
    ).toBe(false);
  });
});
