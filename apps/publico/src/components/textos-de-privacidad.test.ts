import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/*
 * Los dos textos de privacidad de la cara pública, cercados.
 *
 * Esto no prueba una función: prueba una DECISIÓN, y por eso lee el fuente. La
 * frase vieja —«no se envía a ningún servidor»— era cierta de nuestras
 * peticiones, y quien la vuelva a poner va a creer que está reparando una
 * regresión de privacidad. Ver `docs/Ficha-Textos-De-Privacidad.md`.
 *
 * Si alguien la restaura a propósito, esto se cae y se actualiza a propósito —
 * que es lo que se le pide a una valla.
 */

const fuente = (archivo: string) =>
  readFileSync(new URL(`./${archivo}`, import.meta.url), "utf8");

/** Lo que el pasajero lee, sin los comentarios que explican por qué. */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/*
 * ✎ **21-sep-2026:** `vista-pasajero.tsx` era la cara vieja y se retiró con
 * Ontoy. La valla se mudó a la nueva **sin aflojarse**: la pantalla que pide la
 * ubicación sigue teniendo que decir para qué, y la hoja de una parada entra a
 * la lista porque es donde se guarda algo y donde estuvo a punto de colarse una
 * promesa absoluta («no en ningún servidor») en una pantalla cuyos mosaicos de
 * mapa sí van a un tercero.
 */
const PANTALLAS = [
  { archivo: "ontoy/atajo-de-parada.tsx", dice: "Tu ubicación se usa para calcular cuándo llega tu camión." },
  { archivo: "ontoy/hoja-de-parada.tsx", dice: "No hace falta cuenta." },
  { archivo: "buscador.tsx", dice: "A dónde vas y dónde estás se usan para contestarte." },
];

describe("los textos de privacidad describen el PARA QUÉ", () => {
  for (const p of PANTALLAS) {
    it(`${p.archivo} dice para qué se usa, y nada más`, () => {
      expect(fuente(p.archivo)).toContain(p.dice);
    });
  }

  it("NINGUNA JURA EL DÓNDE — la valla de esta decisión", () => {
    /*
     * Una promesa absoluta sobre el destino de un dato ata a la arquitectura
     * futura y afirma sobre toda la pantalla, no sólo sobre nuestras
     * peticiones: los mosaicos del mapa se piden a un tercero.
     */
    for (const p of PANTALLAS) {
      const visible = sinComentarios(fuente(p.archivo));
      expect(visible, p.archivo).not.toContain("ningún servidor");
      expect(visible, p.archivo).not.toContain("solo en este teléfono");
      expect(visible, p.archivo).not.toContain("sólo en este teléfono");
    }
  });
});
