import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * La prueba de la pantalla dieciséis.
 *
 * Todas las demás pruebas de guardia comprueban las pantallas **que existen**.
 * Ninguna dice nada de la que alguien escriba mañana — y ése es el riesgo real
 * medido el 4 de agosto de 2026: con dos carriers, `/carrier` niega lo ajeno
 * por los seis caminos, pero lo niega en el CARGADOR, repitiendo la
 * comprobación en cinco archivos. Una pantalla nueva que olvide filtrar no
 * rompe nada, no falla ninguna prueba y filtra en silencio. Es la forma exacta
 * del `[0]` del #222: invisible mientras haya una sola cuenta.
 *
 * Esta prueba lee el árbol de rutas y exige la convención, así que **una
 * pantalla nueva sin guardia nace en rojo**.
 *
 * ## Y la audiencia
 *
 * Exige además que la audiencia declarada corresponda a la cara. Sin esto,
 * cambiar `"carrier"` por `"cliente"` en una página del transportista no
 * tumbaría ninguna prueba: las de `guardia-recurso` llaman a `decidirRecurso`
 * directo, así que nunca ven qué audiencia eligió la PÁGINA. La guardia
 * quedaría midiendo contra la tabla de clientes y se vería idéntica a una que
 * funciona.
 */

const APP = path.join(fileURLToPath(new URL("../app", import.meta.url)));

/**
 * Excepciones, con nombre y motivo. Una lista vacía sería más limpia y menos
 * honesta: lo que pudre una regla como ésta es la excepción que nadie escribió.
 */
const EXENTAS: Record<string, string> = {
  "cliente/[code]/page.tsx":
    "Redirect heredado (/cliente/planta-MX07). No abre un recurso por id: resuelve " +
    "primero la cuenta con resolveAccountByType —comprobada por alcance desde el #222— " +
    "y busca la planta POR CÓDIGO dentro de ella, así que un código ajeno no aparece. " +
    "Termina redirigiendo a /cliente/planta/[plantId], que sí lleva la guardia.",
};

function rutasConParametro(dir: string, base = ""): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completa = path.join(dir, entrada);
    const relativa = base ? `${base}/${entrada}` : entrada;
    if (statSync(completa).isDirectory()) {
      salida.push(...rutasConParametro(completa, relativa));
    } else if (entrada === "page.tsx" || entrada === "layout.tsx") {
      if (relativa.includes("[")) salida.push(relativa);
    }
  }
  return salida;
}

const CARAS: Array<{ carpeta: string; audiencia: "cliente" | "carrier" }> = [
  { carpeta: "cliente", audiencia: "cliente" },
  { carpeta: "carrier", audiencia: "carrier" },
];

describe("toda pantalla con id lleva guardia de recurso, y con SU audiencia", () => {
  for (const { carpeta, audiencia } of CARAS) {
    const rutas = rutasConParametro(path.join(APP, carpeta), carpeta);

    it(`/${carpeta} — ${rutas.length} pantallas con parámetro`, () => {
      // Si esto llegara a cero, la prueba entera pasaría sin comprobar nada:
      // el modo en que este archivo podría mentir.
      expect(rutas.length).toBeGreaterThan(0);

      const sinGuardia: string[] = [];
      const audienciaEquivocada: string[] = [];

      for (const ruta of rutas) {
        if (EXENTAS[ruta]) continue;
        const fuente = readFileSync(path.join(APP, ruta), "utf8");

        if (!fuente.includes("exigirRecurso(")) {
          sinGuardia.push(ruta);
          continue;
        }
        if (!fuente.includes(`exigirRecurso("${audiencia}"`)) {
          audienciaEquivocada.push(ruta);
        }
      }

      expect(
        sinGuardia,
        `Pantallas con id y sin exigirRecurso. Si es a propósito, va a EXENTAS con su motivo:\n${sinGuardia.join("\n")}`,
      ).toEqual([]);

      expect(
        audienciaEquivocada,
        `Pantallas de /${carpeta} que no declaran la audiencia "${audiencia}". Medir contra la pared equivocada se ve igual que medir bien:\n${audienciaEquivocada.join("\n")}`,
      ).toEqual([]);
    });
  }

  it("las exenciones siguen existiendo — una exención a un archivo borrado es ruido", () => {
    for (const ruta of Object.keys(EXENTAS)) {
      expect(() => statSync(path.join(APP, ruta)), `${ruta} ya no existe`).not.toThrow();
    }
  });
});
