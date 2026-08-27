import { describe, expect, it } from "vitest";
import { analizarKmlDeCircuito, metrosEntre } from "./kml-circuito.js";

/**
 * KML sintético con la MISMA forma que el del circuito 1: dos carpetas, un
 * trazado fino y uno burdo del mismo corredor, y un punto de terminal.
 *
 * Sintético a propósito: meter el archivo real al repo sería exactamente el
 * dato hardcodeado que el tramo prohíbe. El KML se sube desde la pantalla.
 */
const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Prueba</name>
  <Folder><name>Detallado</name>
    <Placemark><name>Fino de ida</name><LineString><coordinates>
      -106.4000,31.7000,0 -106.4010,31.7000,0 -106.4020,31.7000,0 -106.4030,31.7000,0
      -106.4040,31.7000,0 -106.4050,31.7000,0 -106.4060,31.7000,0 -106.4070,31.7000,0
    </coordinates></LineString></Placemark>
  </Folder>
  <Folder><name>Burdo</name>
    <Placemark><name>Burdo de ida</name><LineString><coordinates>
      -106.4000,31.7000,0 -106.4070,31.7000,0
    </coordinates></LineString></Placemark>
    <Placemark><name>Terminal norte</name><Point><coordinates>-106.4000,31.7000,0</coordinates></Point></Placemark>
  </Folder>
</Document></kml>`;

describe("analizarKmlDeCircuito", () => {
  it("mantiene las capas separadas en vez de aplanarlas", () => {
    const a = analizarKmlDeCircuito(KML);
    expect(a.capas).toHaveLength(2);
    expect(a.capas.map((c) => c.puntos)).toEqual([8, 2]);
  });

  it("conserva el nombre y la carpeta de cada capa, para mostrarlos", () => {
    const a = analizarKmlDeCircuito(KML);
    expect(a.capas[0].nombre).toBe("Fino de ida");
    expect(a.capas[0].carpeta).toBe("Detallado");
    expect(a.capas[1].carpeta).toBe("Burdo");
  });

  it("mide cada capa para que una persona pueda comparar", () => {
    const [fino, burdo] = analizarKmlDeCircuito(KML).capas;
    // Mismo corredor, mismo largo.
    expect(Math.abs(fino.largoMetros - burdo.largoMetros)).toBeLessThan(1);
    // Pero el burdo tiene un solo salto enorme.
    expect(burdo.huecoMaximoMetros).toBeGreaterThan(fino.huecoMaximoMetros * 5);
    expect(fino.espaciadoMedianoMetros).toBeLessThan(burdo.espaciadoMedianoMetros);
  });

  it("avisa cuál capa corta esquinas, sin escogerla por él", () => {
    const a = analizarKmlDeCircuito(KML);
    expect(a.avisos).toHaveLength(1);
    expect(a.avisos[0]).toContain("Fino de ida");
    expect(a.avisos[0]).toContain("Burdo de ida");
    expect(a.avisos[0]).toContain("corta esquinas");
  });

  it("nunca decide cuál es ida y cuál vuelta — eso es de la pantalla", () => {
    const a = analizarKmlDeCircuito(KML);
    // El analizador no expone nada que asigne sentido.
    for (const capa of a.capas) {
      expect(Object.keys(capa)).not.toContain("sentido");
    }
  });

  it("saca los Placemark de un solo punto aparte, como candidatos a parada", () => {
    const a = analizarKmlDeCircuito(KML);
    expect(a.puntos).toHaveLength(1);
    expect(a.puntos[0].nombre).toBe("Terminal norte");
    expect(a.puntos[0].lat).toBeCloseTo(31.7, 4);
  });

  it("guarda inicio y fin para que se vea si el trazado cierra donde debe", () => {
    const [fino] = analizarKmlDeCircuito(KML).capas;
    expect(fino.inicio.lon).toBeCloseTo(-106.4, 4);
    expect(fino.fin.lon).toBeCloseTo(-106.407, 4);
  });

  it("descarta capas con menos de dos puntos y lo dice", () => {
    const roto = KML.replace("-106.4000,31.7000,0 -106.4070,31.7000,0", "-106.4000,31.7000,0");
    const a = analizarKmlDeCircuito(roto);
    expect(a.capas).toHaveLength(1);
    expect(a.avisos.some((v) => v.includes("menos de dos puntos"))).toBe(true);
  });

  it("avisa cuando el archivo no trae ningún trazado", () => {
    const a = analizarKmlDeCircuito("<kml><Document></Document></kml>");
    expect(a.capas).toHaveLength(0);
    expect(a.avisos[0]).toContain("ningún trazado");
  });

  it("ignora coordenadas imposibles en vez de creerles", () => {
    const sucio = KML.replace("-106.4010,31.7000,0", "-999,999,0");
    expect(analizarKmlDeCircuito(sucio).capas[0].puntos).toBe(7);
  });
});

describe("metrosEntre", () => {
  it("mide una distancia conocida de Juárez", () => {
    // Terminal Oasis → Centro, en línea recta: ~9.4 km.
    const d = metrosEntre({ lat: 31.65619, lon: -106.45066 }, { lat: 31.73659, lon: -106.48379 });
    expect(d).toBeGreaterThan(9000);
    expect(d).toBeLessThan(9800);
  });
});

describe("marcar y ordenar por calidad", () => {
  it("marca la capa burda, no la fina", () => {
    const a = analizarKmlDeCircuito(KML);
    const fina = a.capas.find((c) => c.nombre === "Fino de ida")!;
    const burda = a.capas.find((c) => c.nombre === "Burdo de ida")!;
    expect(fina.cortaEsquinas).toBe(false);
    expect(burda.cortaEsquinas).toBe(true);
  });

  it("devuelve las utilizables primero, aunque en el archivo vayan después", () => {
    // En el KML de prueba la fina va primero; se invierte para probar el orden.
    const invertido = KML.replace(
      /<Folder><name>Detallado<\/name>[\s\S]*?<\/Folder>/,
      "",
    ).replace(
      "</Document>",
      `<Folder><name>Detallado</name><Placemark><name>Fino de ida</name><LineString><coordinates>
        -106.4000,31.7000,0 -106.4010,31.7000,0 -106.4020,31.7000,0 -106.4030,31.7000,0
        -106.4040,31.7000,0 -106.4050,31.7000,0 -106.4060,31.7000,0 -106.4070,31.7000,0
      </coordinates></LineString></Placemark></Folder></Document>`,
    );
    const a = analizarKmlDeCircuito(invertido);
    expect(a.capas[0].nombre).toBe("Fino de ida");
    expect(a.capas[0].cortaEsquinas).toBe(false);
    expect(a.capas[a.capas.length - 1].cortaEsquinas).toBe(true);
  });
});
