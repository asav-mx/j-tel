import { afterEach, describe, expect, it, vi } from "vitest";
import { nivelDeclarado, nivelPedidoEnLaUrl } from "./nivel-de-rendimiento";

/*
 * El nivel decide si un teléfono ve a Ontoy en 3D o en 2D. Se prueba porque sus
 * dos defectos no se veían mirando la página desde un escritorio: el primero
 * dejaba sin 3D a **los navegadores que no declaran su memoria** (Safari,
 * Firefox), y el segundo a **todos los teléfonos**, que es justo para quien es
 * esta app.
 *
 * La regla, en una frase: **se baja por señales malas, no por falta de
 * señales.**
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
  /** `undefined` = tampoco lo declara. */
  nucleos?: number;
  dedo?: boolean;
  ahorro?: boolean;
  enlace?: string;
}) {
  vi.stubGlobal("navigator", {
    ...(nucleos === undefined ? {} : { hardwareConcurrency: nucleos }),
    ...(memoria === undefined ? {} : { deviceMemory: memoria }),
    connection: { saveData: ahorro, effectiveType: enlace },
  });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("coarse") && dedo }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("el nivel que se deduce del aparato", () => {
  it("**un Android con Chrome llega a alto, que es el teléfono del pasajero**", () => {
    /*
     * Éste es el defecto que tuvo, y por eso va primero. Asav lo vio en su
     * teléfono: `ontoy.app` le daba 2D y `ontoy.app/?nivel=alto` le daba el 3D
     * completo y suave. El aparato podía; el detector lo castigaba.
     *
     * Por dos cosas, y ninguna dice nada de lo que un aparato puede:
     *
     *  - el **dedo** (`pointer: coarse`), que sólo dice que es táctil;
     *  - `deviceMemory` **4**, que en Chrome no es la memoria real sino el
     *    tope: redondea a la baja y no pasa de 8, así que un teléfono de 6 GB
     *    dice «4».
     */
    comoSi({ memoria: 4, nucleos: 8, dedo: true });
    expect(nivelDeclarado()).toBe("alto");
  });

  it("y llega igual si el navegador no declara la memoria", () => {
    /* Que es lo que hacen Safari y Firefox. Ausente no es poco. */
    comoSi({ memoria: undefined, nucleos: 8, dedo: true });
    expect(nivelDeclarado()).toBe("alto");
    comoSi({ memoria: undefined, nucleos: 10, dedo: false });
    expect(nivelDeclarado()).toBe("alto");
  });

  it("ni declarando memoria ni núcleos se castiga a nadie", () => {
    /*
     * El caso extremo de la misma regla: un navegador que no dice **nada** de
     * sí mismo. Suponerle lo peor sería inventar el dato que no dio.
     */
    comoSi({ memoria: undefined, nucleos: undefined });
    expect(nivelDeclarado()).toBe("alto");
  });

  it("un escritorio que sí declara memoria de sobra llega a alto", () => {
    comoSi({ memoria: 8, nucleos: 8 });
    expect(nivelDeclarado()).toBe("alto");
  });

  it("poca memoria DECLARADA sí manda a bajo, aunque sobren núcleos", () => {
    comoSi({ memoria: 2, nucleos: 16 });
    expect(nivelDeclarado()).toBe("bajo");
    comoSi({ memoria: 1, nucleos: 8 });
    expect(nivelDeclarado()).toBe("bajo");
  });

  it("y pocos núcleos declarados también", () => {
    comoSi({ memoria: 8, nucleos: 2 });
    expect(nivelDeclarado()).toBe("bajo");
  });

  it("cuatro núcleos NO son pocos: es un teléfono normal, no uno malo", () => {
    comoSi({ memoria: undefined, nucleos: 4, dedo: true });
    expect(nivelDeclarado()).toBe("alto");
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

  it("**`medio` no se elige al abrir: se cae a él midiendo**", () => {
    /*
     * No hay combinación de señales que lo dé. Es a propósito: `medio` es la
     * respuesta a «esta página va lenta», que sólo se sabe mirándola correr, y
     * no a «este aparato parece modesto», que es una suposición.
     */
    for (const memoria of [undefined, 0.5, 1, 2, 4, 8, 32]) {
      for (const nucleos of [undefined, 1, 2, 4, 8, 16]) {
        for (const dedo of [false, true]) {
          comoSi({ memoria, nucleos, dedo });
          expect(nivelDeclarado()).not.toBe("medio");
        }
      }
    }
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
