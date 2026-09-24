import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import manifest from "./manifest";

/*
 * Los íconos de la identidad de Ontoy, cuidados donde se rompen.
 *
 * Los archivos tienen nombre fijo a propósito: la identidad entra reemplazándolos
 * sin tocar código (`docs/Ontoy-Iconos.md`). Lo bueno de eso es que una
 * exportación nueva se instala copiando encima. Lo que eso mismo deja abierto es
 * que **una exportación puede traer un defecto y nadie lo note**, porque el
 * nombre del archivo es igual y la app sigue compilando.
 *
 * Ya pasó, entre dos zips del mismo día: el `apple-touch-icon.png` del segundo
 * llegó con las esquinas transparentes. iOS no maneja alfa ahí —compone sobre
 * negro— y encima pone su propia máscara redondeada, con una curva distinta a la
 * del archivo. Cuánto negro se asoma depende de esa curva: medido a mano, entre 0
 * y 296 pixeles según qué superelipse use iOS. No es un desastre visible, y
 * tampoco es algo que convenga dejarle a una curva ajena.
 *
 * **Así que los dos que no pueden ser transparentes se guardan sin canal alfa**, y
 * eso se lee en 26 bytes: el tipo de color del IHDR del PNG. No hace falta
 * descomprimir la imagen para saber que no puede tener un pixel transparente — si
 * no hay canal, no hay transparencia posible.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.join(AQUI, "../../public");

/** El tipo de color del IHDR de un PNG: 2 y 0 no tienen canal alfa; 6 y 4 sí. */
function tipoDeColor(archivo: string): number {
  const cabeza = readFileSync(path.join(PUBLICO, archivo)).subarray(0, 26);
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(cabeza.subarray(0, 8), `${archivo} no es un PNG`).toEqual(firma);
  expect(cabeza.subarray(12, 16).toString("ascii"), `${archivo}: el IHDR no va primero`).toBe("IHDR");
  return cabeza[25]!;
}

/** Ancho y alto declarados en el IHDR. */
function medidas(archivo: string): [number, number] {
  const cabeza = readFileSync(path.join(PUBLICO, archivo)).subarray(0, 24);
  return [cabeza.readUInt32BE(16), cabeza.readUInt32BE(20)];
}

describe("los íconos de Ontoy", () => {
  it("el manifiesto no nombra un archivo que no exista", () => {
    const m = manifest();
    const faltantes = (m.icons ?? [])
      .map((i) => i.src!)
      .filter((src) => !existsSync(path.join(PUBLICO, src.replace(/^\//, ""))));
    expect(faltantes).toEqual([]);
  });

  it("el de iOS y el de máscara van SIN canal alfa: si no hay canal, no hay transparencia posible", () => {
    // El de iOS porque iOS compone la transparencia sobre negro y le pone su
    // propia máscara. El de máscara porque Android la recorta y la ficha lo pide.
    expect(tipoDeColor("iconos/apple-touch-icon.png")).toBe(2);
    expect(tipoDeColor("iconos/icono-mascara-512.png")).toBe(2);
  });

  it("los tamaños que las tiendas exigen son los que el archivo dice", () => {
    expect(medidas("iconos/apple-touch-icon.png")).toEqual([180, 180]);
    expect(medidas("iconos/icono-192.png")).toEqual([192, 192]);
    expect(medidas("iconos/icono-512.png")).toEqual([512, 512]);
    expect(medidas("iconos/icono-mascara-512.png")).toEqual([512, 512]);
  });

  it("los dos SVG no vuelven a cargar con los metadatos de la herramienta de diseño", () => {
    // La exportación los entrega con 7 736 bytes de procedencia C2PA sobre 907 de
    // dibujo. No rompen nada; simplemente no son del repo, y el comentario del
    // propio manifiesto presume que «el SVG pesa cientos de bytes».
    for (const svg of ["icono.svg", "icono-mascara.svg"]) {
      const texto = readFileSync(path.join(PUBLICO, svg), "utf8");
      expect(texto, `${svg} trae metadatos`).not.toContain("<metadata>");
      expect(texto, `${svg} trae el espacio de nombres c2pa`).not.toContain("c2pa");
      expect(texto.length, `${svg} pesa de más: ¿volvieron los metadatos?`).toBeLessThan(2000);
    }
  });

  it("el color del manifiesto es Banqueta, el de la identidad", () => {
    const m = manifest();
    expect(m.background_color).toBe("#EDE9E1");
    expect(m.theme_color).toBe("#EDE9E1");
  });

  it("la app se queda en la raíz: es la dirección que el ícono instalado guarda", () => {
    // Un `start_url` distinto no se nota al desplegar y sí en el teléfono de
    // quien ya la instaló: su ícono abriría otra cosa. La decisión de dónde vive
    // cada dirección de ontoy.app tiene su propio documento y su propia valla.
    expect(manifest().start_url).toBe("/");
  });
});
