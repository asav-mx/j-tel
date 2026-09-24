import { describe, expect, it } from "vitest";
import {
  COLORES_DE_RUTA,
  NARANJA_DE_ONTOY,
  RESERVADOS_DE_LA_PLATAFORMA,
  colorReservado,
  estaEnLaLista,
  porQueNoSirveParaUnaRuta,
  tonoDeOntoy,
  tonoSaturacionLuz,
} from "./color-de-ruta.js";

describe("tonoSaturacionLuz", () => {
  it("lee el naranja de Ontoy donde el handoff dice que está", () => {
    const m = tonoSaturacionLuz(NARANJA_DE_ONTOY)!;
    expect(Math.round(m.tono)).toBe(27);
    expect(m.saturacion).toBeGreaterThan(0.5);
  });

  it("no inventa un tono para un gris", () => {
    expect(tonoSaturacionLuz("#808080")).toEqual({ tono: 0, saturacion: 0, luz: 128 / 255 });
  });

  it("no lee lo que no es un color", () => {
    expect(tonoSaturacionLuz("azul")).toBeNull();
    expect(tonoSaturacionLuz("#FFF")).toBeNull();
    expect(tonoSaturacionLuz("")).toBeNull();
  });
});

describe("el naranja de Ontoy se bloquea", () => {
  it("el naranja mismo no se puede", () => {
    expect(tonoDeOntoy(NARANJA_DE_ONTOY)).toBe(true);
    expect(porQueNoSirveParaUnaRuta(NARANJA_DE_ONTOY)).toContain("naranja de Ontoy");
  });

  it("los dos bordes de la banda, y lo que queda justo afuera", () => {
    // 14° y 44° son los del handoff. Los cuatro hexes están MEDIDOS, no escogidos
    // a ojo: el primer intento usó un `#D9A50D` que yo creía de 43° y mide 44.7,
    // o sea afuera — y la prueba se cayó acusando al código en vez al hex.
    expect(tonoDeOntoy("#903C27")).toBe(false); // 12.0° — rojo, justo antes
    expect(tonoDeOntoy("#903F24")).toBe(true); // 15.0° — ya es de Ontoy
    expect(tonoDeOntoy("#B48100")).toBe(true); // 43.0° — el otro extremo
    expect(tonoDeOntoy("#B48A00")).toBe(false); // 46.0° — ámbar, justo después
  });

  it("el amarillo de los avisos cae dentro, y por eso el handoff no lo lista como color de ruta", () => {
    // #F2C14E es el «amarillo aviso» de la §2: avisos de la concesión y la
    // estrella. Mide 42° y está saturado, así que la lista no lo puede ofrecer.
    expect(tonoDeOntoy("#F2C14E")).toBe(true);
  });

  it("un beige tibio NO se bloquea aunque su tono caiga en la banda", () => {
    // Es el piso de saturación: lo que pelea con Ontoy es un naranja, no
    // cualquier cosa con ese tono. Banqueta y Arena caen en la banda de tono.
    for (const apagado of ["#EDE9E1", "#DCD5C8", "#8A6A52"]) {
      const m = tonoSaturacionLuz(apagado)!;
      expect(m.tono, `${apagado} no cae en la banda: la prueba no prueba nada`).toBeGreaterThanOrEqual(14);
      expect(m.tono).toBeLessThanOrEqual(44);
      expect(tonoDeOntoy(apagado), `${apagado} se bloqueó y no debía`).toBe(false);
    }
  });
});

describe("los reservados de la plataforma avisan, no bloquean", () => {
  it.each(RESERVADOS_DE_LA_PLATAFORMA)("$hex se declara como $que", ({ hex, que }) => {
    expect(colorReservado(hex)).toBe(que);
  });

  it("un hex a un dígito de distancia del cobre sigue siendo el cobre", () => {
    // La versión vieja comparaba igualdad exacta: `#B05A10` pasaba como si no
    // fuera nada. Nadie distingue esos dos colores mirándolos.
    expect(colorReservado("#B05A10")).toContain("cobre");
    expect(colorReservado("#AF5A0F")).toContain("cobre");
  });

  it("pero avisar no es bloquear: se puede guardar", () => {
    // El color de una ruta es el que los camiones traen pintados. Si un
    // transportista pintó su flota de un verde parecido al del latido, la app
    // no puede decirle que se equivocó: el nombre siempre acompaña al color.
    expect(porQueNoSirveParaUnaRuta("#1B9E6B")).toBeNull();
  });

  it("un color cualquiera no se declara reservado", () => {
    for (const libre of ["#4F7FD8", "#2FA6A0", "#8B6CC9", "#E36F8C"]) {
      expect(colorReservado(libre), `${libre} salió como reservado`).toBeNull();
    }
  });
});

describe("la lista que J-Staff ofrece", () => {
  it("no ofrece un tono que pelee con Ontoy, ni uno reservado", () => {
    for (const c of COLORES_DE_RUTA) {
      expect(porQueNoSirveParaUnaRuta(c.hex), `${c.nombre} ${c.hex}`).toBeNull();
      expect(colorReservado(c.hex), `${c.nombre} ${c.hex} choca con la plataforma`).toBeNull();
    }
  });

  it("no repite un color ni un nombre", () => {
    const hexes = COLORES_DE_RUTA.map((c) => c.hex.toUpperCase());
    const nombres = COLORES_DE_RUTA.map((c) => c.nombre);
    expect(new Set(hexes).size).toBe(hexes.length);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("dos colores de la lista se distinguen entre sí: 30° de tono como piso", () => {
    // Dos rutas con azules casi iguales en el mismo mapa se distinguirían sólo
    // leyendo el nombre. El par más junto de la lista son 41° (azul y morado).
    for (const a of COLORES_DE_RUTA) {
      for (const b of COLORES_DE_RUTA) {
        if (a.hex === b.hex) continue;
        const ta = tonoSaturacionLuz(a.hex)!.tono;
        const tb = tonoSaturacionLuz(b.hex)!.tono;
        const d = Math.min(Math.abs(ta - tb), 360 - Math.abs(ta - tb));
        expect(d, `${a.nombre} y ${b.nombre} están a ${d.toFixed(0)}°`).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("todos van en #RRGGBB con mayúsculas, que es como se guardan", () => {
    for (const c of COLORES_DE_RUTA) expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("estaEnLaLista no depende de mayúsculas", () => {
    expect(estaEnLaLista("#4f7fd8")).toBe(true);
    expect(estaEnLaLista("#4F7FD8")).toBe(true);
    expect(estaEnLaLista(" #4F7FD8 ")).toBe(true);
    expect(estaEnLaLista("#123456")).toBe(false);
  });
});

describe("el formato", () => {
  it.each(["", "azul", "#FFF", "#12345", "#1234567", "rgb(1,2,3)"])("«%s» no es un color", (malo) => {
    expect(porQueNoSirveParaUnaRuta(malo)).toBe("El color va en formato #RRGGBB");
  });
});
