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
  it("cae a la variable de servidor cuando existe, no al usuario pedido", () => {
    const r = resolverIdentidadDeDesarrollo(
      entorno({ pedido: "jstaff_admin", usuarioPorVariable: "tecma_admin" }),
    );

    expect(r.userId).toBe("tecma_admin");
    expect(r.origen).toBe("variable-dev");
    expect(r.encabezadoRechazado).toBe(true);
  });
});

describe("sin encabezado, manda el servidor", () => {
  it("la variable de entorno sigue mandando", () => {
    const r = resolverIdentidadDeDesarrollo(entorno({ usuarioPorVariable: "jb_admin" }));

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
