import { describe, expect, it } from "vitest";
import {
  adelgazar,
  haversineKm,
  huecosDeSenal,
  longitudKm,
  partirRuta,
  posicionEnVentana,
  poligono,
  proyectar,
  trazo,
} from "./diagnostico-geometria";

const CIUDAD = { lat: 31.72, lng: -106.45 };

describe("la proyección", () => {
  it("no dibuja nada cuando no hay nada", () => {
    expect(proyectar([[], []], { ancho: 100, alto: 100, margen: 4 })).toBeNull();
  });

  it("usa la misma escala en los dos ejes", () => {
    // Un cuadrado de ~1 km por lado en el terreno debe salir cuadrado en el
    // dibujo. Si la escala fuera distinta por eje, el corredor se vería más
    // ancho en una dirección que en la otra y los metros dejarían de ser metros.
    const dLat = 1 / 110.574; // ~1 km
    const dLng = 1 / (111.32 * Math.cos((CIUDAD.lat * Math.PI) / 180));
    const esquinas = [
      CIUDAD,
      { lat: CIUDAD.lat + dLat, lng: CIUDAD.lng },
      { lat: CIUDAD.lat + dLat, lng: CIUDAD.lng + dLng },
      { lat: CIUDAD.lat, lng: CIUDAD.lng + dLng },
    ];

    const proy = proyectar([esquinas], { ancho: 400, alto: 400, margen: 0 })!;
    const a = proy.px(esquinas[0]!);
    const b = proy.px(esquinas[1]!);
    const c = proy.px(esquinas[3]!);

    expect(Math.abs(a.y - b.y)).toBeCloseTo(Math.abs(c.x - a.x), 0);
  });

  it("declara cuántos metros mide un pixel", () => {
    const dLat = 1 / 110.574; // 1 km
    const proy = proyectar(
      [[CIUDAD, { lat: CIUDAD.lat + dLat, lng: CIUDAD.lng }]],
      { ancho: 200, alto: 200, margen: 0 },
    )!;

    // 1000 m repartidos en 200 px de alto → 5 m por pixel. De este número sale
    // el grosor del corredor; si mintiera, la banda dibujada mentiría con él.
    expect(proy.metrosPorPx).toBeCloseTo(5, 1);
  });

  it("la latitud crece hacia arriba en el dibujo", () => {
    const proy = proyectar(
      [[CIUDAD, { lat: CIUDAD.lat + 0.01, lng: CIUDAD.lng + 0.01 }]],
      { ancho: 100, alto: 100, margen: 0 },
    )!;

    expect(proy.px({ lat: CIUDAD.lat + 0.01, lng: CIUDAD.lng }).y).toBeLessThan(
      proy.px(CIUDAD).y,
    );
  });
});

describe("los trazos", () => {
  const proy = proyectar(
    [[CIUDAD, { lat: CIUDAD.lat + 0.01, lng: CIUDAD.lng + 0.01 }]],
    { ancho: 100, alto: 100, margen: 0 },
  )!;

  it("un punto suelto no es una línea", () => {
    expect(trazo([CIUDAD], proy)).toBe("");
    expect(poligono([CIUDAD], proy)).toBe("");
  });

  it("arma M y L, y cierra el polígono", () => {
    const puntos = [CIUDAD, { lat: CIUDAD.lat + 0.01, lng: CIUDAD.lng + 0.01 }];
    expect(trazo(puntos, proy)).toMatch(/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
    expect(poligono(puntos, proy).endsWith(" Z")).toBe(true);
  });
});

describe("el largo del trazado", () => {
  it("mide un grado de latitud como ~111 km", () => {
    expect(haversineKm(CIUDAD, { lat: CIUDAD.lat + 1, lng: CIUDAD.lng })).toBeCloseTo(111.2, 0);
  });

  it("suma los tramos", () => {
    const ruta = [
      CIUDAD,
      { lat: CIUDAD.lat + 0.05, lng: CIUDAD.lng },
      { lat: CIUDAD.lat + 0.1, lng: CIUDAD.lng },
    ];
    expect(longitudKm(ruta)).toBeCloseTo(11.12, 1);
  });
});

describe("el tramo que quedó fuera", () => {
  // Ruta recta de 100 waypoints, ~11.1 km.
  const ruta = Array.from({ length: 100 }, (_, i) => ({
    lat: CIUDAD.lat + i * 0.001,
    lng: CIUDAD.lng,
  }));

  it("observado desde el origen: nada quedó fuera", () => {
    const t = partirRuta(ruta, 0);

    expect(t.fuera).toEqual([]);
    expect(t.dentro).toHaveLength(100);
    expect(t.fraccionInicio).toBe(0);
    expect(t.fraccionObservable).toBe(1);
    expect(t.kmFuera).toBe(0);
  });

  it("observado desde la mitad: la mitad quedó fuera, en km", () => {
    const t = partirRuta(ruta, 50);

    expect(t.fraccionInicio).toBeCloseTo(50 / 99, 3);
    expect(t.fraccionObservable).toBeCloseTo(1 - 50 / 99, 3);
    expect(t.kmFuera).toBeCloseTo(t.kmTotales * (50 / 99), 2);
  });

  it("las dos mitades comparten el waypoint de corte", () => {
    const t = partirRuta(ruta, 40);

    // Sin el waypoint compartido quedaría un hueco visual de un segmento entre
    // el tramo no observado y el observado, y ese hueco no existe.
    expect(t.fuera[t.fuera.length - 1]).toEqual(t.dentro[0]);
  });

  it("un índice fuera de rango no rompe el dibujo", () => {
    expect(() => partirRuta(ruta, 5000)).not.toThrow();
    expect(partirRuta(ruta, -3).indiceInicio).toBe(0);
  });
});

describe("los huecos de señal", () => {
  const ventana = { desdeMs: 0, hastaMs: 60 * 60_000 }; // una hora

  it("sin un solo punto, toda la ventana es un hueco", () => {
    const [h] = huecosDeSenal([], ventana, 10);
    expect(h).toMatchObject({ desdeMs: 0, hastaMs: ventana.hastaMs, minutos: 60 });
  });

  it("el silencio antes del primer punto cuenta como hueco", () => {
    // Este es justo el caso que importa: la ventana abrió y el sistema no vio
    // nada durante media hora. Si el borde no contara, ese silencio —el que
    // explica los arranques no observados— sería invisible.
    const puntos = [30 * 60_000, 32 * 60_000, 34 * 60_000, 60 * 60_000];
    const huecos = huecosDeSenal(puntos, ventana, 10);

    expect(huecos).toHaveLength(2);
    expect(huecos[0]).toMatchObject({ desdeMs: 0, minutos: 30 });
    expect(huecos[1]!.minutos).toBeCloseTo(26, 5);
  });

  it("un silencio corto no es un hueco", () => {
    // Señal cada 5 min de punta a punta: ningún silencio llega al mínimo.
    const puntos = Array.from({ length: 13 }, (_, i) => i * 5 * 60_000);
    expect(huecosDeSenal(puntos, ventana, 10)).toHaveLength(0);
  });

  it("los puntos fuera de la ventana no tapan un hueco", () => {
    // Un punto anterior a la apertura no prueba nada sobre la ventana.
    const huecos = huecosDeSenal([-5 * 60_000, 60 * 60_000], ventana, 10);
    expect(huecos[0]).toMatchObject({ desdeMs: 0, minutos: 60 });
  });
});

describe("posición dentro de la ventana", () => {
  const ventana = { desdeMs: 1000, hastaMs: 3000 };

  it("mapea a 0–1", () => {
    expect(posicionEnVentana(2000, ventana)).toBeCloseTo(0.5, 5);
  });

  it("acota en vez de salirse del dibujo", () => {
    expect(posicionEnVentana(-99, ventana)).toBe(0);
    expect(posicionEnVentana(99_999, ventana)).toBe(1);
  });

  it("una ventana de largo cero no divide entre cero", () => {
    expect(posicionEnVentana(5, { desdeMs: 5, hastaMs: 5 })).toBe(0);
  });
});

describe("adelgazar la traza", () => {
  const puntos = Array.from({ length: 5000 }, (_, i) => i);

  it("conserva el arranque y el final", () => {
    const r = adelgazar(puntos, 900);
    expect(r).toHaveLength(900);
    expect(r[0]).toBe(0);
    expect(r[r.length - 1]).toBe(4999);
  });

  it("no toca lo que ya cabe", () => {
    expect(adelgazar([1, 2, 3], 900)).toEqual([1, 2, 3]);
  });
});
