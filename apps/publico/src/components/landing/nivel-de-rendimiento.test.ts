import { afterEach, describe, expect, it, vi } from "vitest";
import { nivelDeclarado, nivelPedidoEnLaUrl } from "./nivel-de-rendimiento";

/*
 * El nivel decide si un teléfono baja 81 KB de `three` o no los baja. Se prueba
 * porque el defecto que tuvo no se veía mirando la página: se veía **sólo en
 * los navegadores que no declaran su memoria**, y ahí el 3D no aparecía nunca.
 */

/** Monta un `navigator` y un `matchMedia` de mentira para una visita. */
function comoSi({
  memoria,
  nucleos = 8,
  dedo = false,
  ahorro = false,
  enlace,
}: {
  /** `undefined` = el navegador NO lo declara (Safari, Firefox). */
  memoria?: number;
  nucleos?: number;
  dedo?: boolean;
  ahorro?: boolean;
  enlace?: string;
}) {
  vi.stubGlobal("navigator", {
    hardwareConcurrency: nucleos,
    ...(memoria === undefined ? {} : { deviceMemory: memoria }),
    connection: { saveData: ahorro, effectiveType: enlace },
  });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("coarse") && dedo }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("el nivel que se deduce del aparato", () => {
  it("**Safari y Firefox no declaran memoria, y eso NO los manda a medio**", () => {
    /*
     * Éste es el defecto que tuvo, y por eso va primero. Se suponía 4 GB
     * cuando el navegador no decía nada, y 4 cae justo en el escalón de
     * `medio`: en Safari el 3D **no se cargaba nunca**, ni en un Mac de 64 GB.
     *
     * No era una mala estimación: era una estimación aplicada a quien no había
     * dicho nada.
     */
    comoSi({ memoria: undefined, nucleos: 10, dedo: false });
    expect(nivelDeclarado()).toBe("alto");
  });

  it("un escritorio que sí declara memoria de sobra llega a alto", () => {
    comoSi({ memoria: 8, nucleos: 8 });
    expect(nivelDeclarado()).toBe("alto");
  });

  it("sin memoria declarada y con pocos núcleos, no se presume: medio", () => {
    comoSi({ memoria: undefined, nucleos: 4, dedo: false });
    expect(nivelDeclarado()).toBe("medio");
  });

  it("un teléfono no llega a alto, declare o no su memoria", () => {
    comoSi({ memoria: 8, nucleos: 8, dedo: true });
    expect(nivelDeclarado()).toBe("medio");
    comoSi({ memoria: undefined, nucleos: 8, dedo: true });
    expect(nivelDeclarado()).toBe("medio");
  });

  it("un teléfono modesto va a bajo", () => {
    comoSi({ memoria: 4, nucleos: 4, dedo: true });
    expect(nivelDeclarado()).toBe("bajo");
    comoSi({ memoria: undefined, nucleos: 4, dedo: true });
    expect(nivelDeclarado()).toBe("bajo");
  });

  it("poca memoria declarada manda a bajo aunque sobren núcleos", () => {
    comoSi({ memoria: 2, nucleos: 16 });
    expect(nivelDeclarado()).toBe("bajo");
  });

  it("**el ahorro de datos gana a todo lo demás**", () => {
    /*
     * Quien lo pide ya dijo lo que quiere y no hay que deducirlo de nada. Ni
     * dieciséis núcleos ni treinta y dos gigas lo contradicen.
     */
    comoSi({ memoria: 32, nucleos: 16, ahorro: true });
    expect(nivelDeclarado()).toBe("bajo");
  });

  it("y el 2G también, en sus dos formas", () => {
    comoSi({ memoria: 32, nucleos: 16, enlace: "2g" });
    expect(nivelDeclarado()).toBe("bajo");
    comoSi({ memoria: 32, nucleos: 16, enlace: "slow-2g" });
    expect(nivelDeclarado()).toBe("bajo");
  });

  it("pero «3g» y «4g» no son 2G, y no deberían leerse como tal", () => {
    comoSi({ memoria: 8, nucleos: 8, enlace: "3g" });
    expect(nivelDeclarado()).toBe("alto");
    comoSi({ memoria: 8, nucleos: 8, enlace: "4g" });
    expect(nivelDeclarado()).toBe("alto");
  });

  it("sin `navigator.connection` no se cae: hay navegadores que no lo traen", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 8, deviceMemory: 8 });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(nivelDeclarado()).toBe("alto");
  });
});

describe("el nivel pedido a mano", () => {
  it("se lee de la dirección, para poder ver los tres sin cambiar de teléfono", () => {
    expect(nivelPedidoEnLaUrl("?nivel=alto")).toBe("alto");
    expect(nivelPedidoEnLaUrl("?a=1&nivel=medio")).toBe("medio");
    expect(nivelPedidoEnLaUrl("?nivel=bajo&b=2")).toBe("bajo");
  });

  it("y lo que no es un nivel, no lo es", () => {
    expect(nivelPedidoEnLaUrl("")).toBe(null);
    expect(nivelPedidoEnLaUrl("?nivel=altísimo")).toBe(null);
    expect(nivelPedidoEnLaUrl("?nivelazo=alto")).toBe(null);
  });
});
