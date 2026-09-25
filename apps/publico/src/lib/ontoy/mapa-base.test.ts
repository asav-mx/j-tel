import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAPA_DE_LA_CIUDAD, direccionDelMapa, fondoDelMapa } from "./mapa-base";

/*
 * **El mapa de la ciudad, cercado contra su archivo.**
 *
 * Lo que esta valla vigila no es una función: es que **lo declarado y lo que hay
 * en el disco sean lo mismo**. El modo de falla es silencioso y cae siempre del
 * mismo lado: alguien refresca el mapa con `mapa:traer`, el archivo nuevo entra
 * con otra fecha en el nombre, y `FECHA_DEL_MAPA` se queda donde estaba. Nada se
 * rompe al compilar —es un archivo estático, nadie lo importa— y la app pide una
 * dirección que ya no existe. El mapa sale **en blanco**, en la calle, y el
 * cascarón de Ontoy alrededor se ve perfecto.
 *
 * Por eso mide contra los bytes del archivo y no contra otra constante: dos
 * constantes que se copian entre sí se caen juntas.
 *
 * ## Qué NO prueba
 *
 * - **No prueba que el dibujo esté bien.** Que el suelo sea banqueta y las
 *   calles hueso se ve mirando; para eso están las capturas del PR.
 * - **No prueba que el servidor entienda `Range`.** Eso depende del servidor,
 *   no del archivo, y se comprueba abriendo la app contra la compilación de
 *   producción.
 * - **No prueba que los datos estén frescos.** Un mapa de hace un año pasa esta
 *   prueba: dice la verdad sobre sí mismo, y la fecha está en su nombre para que
 *   se pueda ver sin abrir nada.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CARPETA = path.resolve(AQUI, "../../../public/mapa");

/**
 * La cabecera de un `.pmtiles` v3: **127 bytes fijos al principio del archivo**,
 * sin comprimir. Las posiciones vienen de la especificación (v3, `header`); se
 * leen a mano en vez de con una librería porque son ocho números y traer un
 * paquete para leerlos dejaría la valla dependiendo de la librería que vigila.
 */
function cabecera(archivo: string) {
  const bytes = readFileSync(archivo).subarray(0, 127);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const e7 = (posicion: number) => v.getInt32(posicion, true) / 1e7;
  return {
    magia: bytes.subarray(0, 7).toString("latin1"),
    version: v.getUint8(7),
    /** 1 = mvt, que es lo que el dibujo vectorial sabe leer. */
    tipoDeTesela: v.getUint8(99),
    zoomMinimo: v.getUint8(100),
    zoomMaximo: v.getUint8(101),
    oeste: e7(102),
    sur: e7(106),
    este: e7(110),
    norte: e7(114),
  };
}

describe("el mapa de la ciudad está en el repo y es el que se declara", () => {
  const archivo = path.join(CARPETA, `juarez-${MAPA_DE_LA_CIUDAD.fecha}.pmtiles`);

  it("el archivo que nombra FECHA_DEL_MAPA existe", () => {
    expect(existsSync(archivo), `falta ${path.relative(process.cwd(), archivo)}`).toBe(true);
  });

  it("y es el único: un mapa viejo que se queda se sirve o se clona de gratis", () => {
    const mapas = readdirSync(CARPETA).filter((n) => n.endsWith(".pmtiles"));
    expect(mapas).toEqual([`juarez-${MAPA_DE_LA_CIUDAD.fecha}.pmtiles`]);
  });

  it("pesa lo que pesa un recorte de la ciudad, no lo que pesa un archivo truncado", () => {
    /* 18.4 MB el 24-sep-2026. La horquilla es ancha a propósito —el mapa crece
       con lo que la gente dibuja en OSM— y cierra los dos accidentes que sí
       pasan: un recorte vacío (caja mal escrita) y un archivo a medio bajar. */
    const mb = statSync(archivo).size / 1024 / 1024;
    expect(mb).toBeGreaterThan(5);
    expect(mb).toBeLessThan(30);
  });

  it("es un pmtiles v3 de teselas vectoriales", () => {
    const h = cabecera(archivo);
    expect(h.magia).toBe("PMTiles");
    expect(h.version).toBe(3);
    expect(h.tipoDeTesela).toBe(1);
  });

  it("cubre la caja declarada, y hasta el zoom declarado", () => {
    const h = cabecera(archivo);
    const { caja, zoomDeLosDatos } = MAPA_DE_LA_CIUDAD;
    expect([h.oeste, h.sur, h.este, h.norte]).toEqual([caja.oeste, caja.sur, caja.este, caja.norte]);
    expect(h.zoomMaximo).toBe(zoomDeLosDatos);
    /* Desde z0: alejar el mapa enseña el contexto en vez de quedarse en blanco. */
    expect(h.zoomMinimo).toBe(0);
  });

  it("la frontera no queda cortada: El Paso está dentro de la caja, no sólo Juárez", () => {
    /*
     * Puntos reales, y los del norte son los que importan: si alguien encoge la
     * caja a «nada más Juárez» para ahorrar megas, el mapa se acaba en el río y
     * un juarense lee eso como un mapa roto, no como un mapa de su ciudad.
     */
    const { caja } = MAPA_DE_LA_CIUDAD;
    const dentro = (lat: number, lon: number) =>
      lat > caja.sur && lat < caja.norte && lon > caja.oeste && lon < caja.este;
    expect(dentro(31.7376, -106.4869), "centro de Ciudad Juárez").toBe(true);
    expect(dentro(31.7587, -106.4869), "centro de El Paso").toBe(true);
    expect(dentro(31.9, -106.43), "el noreste de El Paso").toBe(true);
    expect(dentro(31.62, -106.43), "el sur de Juárez").toBe(true);
    expect(dentro(31.75, -106.75), "Anapra y Sunland Park, al poniente").toBe(true);
    expect(dentro(31.58, -106.22), "el valle de Juárez, al oriente").toBe(true);
  });

  it("y sobra caja alrededor: el pasajero no puede llegar al borde del recorte", () => {
    /*
     * **El defecto que esto cierra se vio mirando, no compilando** (24-sep). Con
     * la primera caja —pegada a la ciudad— el mapa se veía perfecto de cerca y,
     * al alejar en un teléfono alto, enseñaba un **vacío de borde recto**: la
     * pantalla es más alta que ancha y en z10 pedía más grados de los que había.
     *
     * Las tres cosas que lo arreglan tienen que valer juntas, y por eso se miden
     * juntas: la caja da el margen, el piso de zoom impide llegar al borde
     * alejando, y los límites, arrastrando.
     */
    const { caja, zoomMinimo } = MAPA_DE_LA_CIUDAD;
    const alto = caja.norte - caja.sur;
    const ancho = caja.este - caja.oeste;
    /* Lo que abarca la pantalla de un teléfono (390 × 844) en el zoom mínimo. */
    const gradosPorPixel = 360 / (256 * 2 ** zoomMinimo);
    expect(390 * gradosPorPixel).toBeLessThan(ancho);
    /* A lo alto la caja se queda corta por poco, y lo cubre el margen de las
       teselas —cada una pasa del borde—; se exige que no se quede corta por
       mucho, que es cuando el vacío aparece en pantalla. */
    expect(844 * gradosPorPixel).toBeLessThan(alto * 1.25);
    expect(fondoDelMapa().limites).toEqual(caja);
  });
});

describe("el mapa lo sirve nuestro servidor, no un tercero", () => {
  it("la dirección es del mismo origen: sin dominio, sin CDN ajeno", () => {
    /* Una dirección absoluta aquí sería un tercero nuevo mirando hacia dónde ve
       el pasajero — lo que este archivo entero existe para quitar. */
    expect(direccionDelMapa()).toMatch(/^\/mapa\/juarez-\d{8}\.pmtiles$/);
  });

  it("no hay tercero, y el fondo es el archivo de la ciudad", () => {
    /*
     * El renglón anterior de esta valla exigía lo contrario —`hayTercero: true`
     * y `tercero: "OpenStreetMap"`— y **se cayó a propósito** cuando el estilo
     * entró, que era su trabajo: obligó a revisar de una sola vez la página de
     * privacidad y la declaración de las tiendas, que son las dos cosas que
     * mienten si el tercero cambia y nadie lo cuenta.
     */
    const fondo = fondoDelMapa();
    expect(fondo.hayTercero).toBe(false);
    expect(fondo.tercero).toBe(null);
    expect(fondo.url).toBe(direccionDelMapa());
  });

  it("el crédito de los datos se queda, aunque las peticiones ya no vayan a nadie", () => {
    /*
     * **La confusión que esto cierra:** el crédito es por los **datos** (ODbL de
     * OpenStreetMap, BSD-3 del recorte de Protomaps) y no cambia porque cambie
     * quién sirve el archivo. Quitarlo «porque ya no les pedimos nada» es
     * incumplir la licencia de los datos que el mapa sigue usando.
     */
    const { atribucion } = fondoDelMapa();
    expect(atribucion).toContain("OpenStreetMap");
    expect(atribucion).toContain("Protomaps");
    /* Sin ligas: en una app instalada no hay flecha de atrás (#374), así que una
       liga en la esquina del mapa es una salida sin regreso. Las ligas viven en
       la página de privacidad, que sí tiene salida (8.10). */
    expect(atribucion).not.toContain("<a");
  });

  it("se puede acercar más allá de donde hay datos, y eso es a propósito", () => {
    /* Es vectorial: de z15 a z19 las mismas calles crecen nítidas. Con mosaicos
       de imagen, pasar del zoom máximo dejaba la calle pixeleada. */
    const fondo = fondoDelMapa();
    expect(fondo.zoomDeLosDatos).toBe(MAPA_DE_LA_CIUDAD.zoomDeLosDatos);
    expect(fondo.zoomMaximo).toBeGreaterThan(fondo.zoomDeLosDatos);
  });
});
