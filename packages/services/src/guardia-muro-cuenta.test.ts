import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * El muro de cuenta en la lectura de `telemetry_points`.
 *
 * **El IMEI no es el muro; la cuenta sí** (Pieza 1.C). Un aparato que cambió de
 * cuenta (6.14) conserva su IMEI, y sus puntos de antes del cambio se quedaron
 * archivados en la cuenta anterior. Una lectura por IMEI solo le entrega al
 * árbitro el recorrido de OTRO transportista, y el árbitro sella con él. El
 * resultado no es un error visible: es un hecho falso pero creíble, firmado, en
 * el expediente de un cliente. Es la clase de daño que no se ve revisando el
 * diff.
 *
 * Se cerró en tres tiempos. Las pantallas dejaron la lectura sin cuenta en el
 * #435. El motor —verificación, reverificación y el backfill de duraciones— en
 * el #441; se midió en producción el 17 de septiembre de 2026 antes de cerrar:
 * cero IMEIs con puntos en más de una cuenta, así que no movió ningún veredicto
 * ya sellado. Y el 18 de septiembre se borró `getForImeis` del repositorio: la
 * puerta que sigue en la pared, alguien la vuelve a abrir sin querer.
 *
 * ## Por qué esta prueba lee código y no comportamiento
 *
 * Una prueba de comportamiento comprueba el camino que hoy existe, no el que
 * alguien escriba mañana. Una lectura sin cuenta nueva pasaría verde y volvería
 * a abrir la puerta en silencio — igual que el `[0]` del #222, invisible
 * mientras haya una sola cuenta. Esta prueba lee el código fuente y exige la
 * regla, así que **una lectura sin muro nace en rojo**.
 *
 * Vigila dos cosas distintas:
 *
 *  1. **Que nadie reintroduzca la puerta.** Ningún paquete puede volver a
 *     definir ni llamar una lectura de `telemetry_points` por IMEI sin cuenta.
 *  2. **Que el camino del veredicto siga leyendo con el muro.** No basta con
 *     que no exista la puerta: los archivos que sellan hechos tienen que estar
 *     leyendo, y leyendo con cuenta.
 */

const SRC = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SRC, "../../..");

/**
 * Los árboles que se barren: la carpeta `src` de TODOS los paquetes y de todas
 * las apps, descubiertos leyendo el disco y no escritos a mano. Una lista fija
 * dejaría fuera el paquete que alguien cree el mes que viene — que es justo
 * donde la puerta volvería a abrirse sin que nadie lo note.
 */
function arboles(): string[] {
  const salida: string[] = [];
  for (const grupo of ["packages", "apps"]) {
    for (const nombre of readdirSync(path.join(REPO, grupo))) {
      const src = path.join(REPO, grupo, nombre, "src");
      if (existsSync(src) && statSync(src).isDirectory()) salida.push(`${grupo}/${nombre}/src`);
    }
  }
  return salida;
}

/**
 * El camino del veredicto: todo lo que lee evidencia para sellar un hecho, o
 * para escribir un dato que el motor después usa para juzgar.
 */
const CAMINO_DEL_VEREDICTO = [
  "packages/services/src/verification.ts",
  "packages/services/src/reverificacion-zona-motor.ts",
  // No sella, pero escribe `route_traversal_measurements`, que dimensiona la
  // ventana derivada — o sea, entra al motor por la puerta de atrás.
  "packages/services/src/backfill-duraciones-ruta.ts",
];

/**
 * Esta prueba se nombra a sí misma para explicar la regla, así que no puede
 * medirse a sí misma. No hay más exentos: la lista de #441 tenía uno
 * —`medir-ventana-vs-ruta.ts`— y dejó de necesitarlo cuando pasó a llevar
 * cuenta. Lo que pudre una regla como ésta es la excepción que nadie escribió;
 * si algún día hace falta una, va aquí con nombre y motivo.
 */
const EXENTOS: Record<string, string> = {
  "packages/services/src/guardia-muro-cuenta.test.ts":
    "Esta misma prueba. Nombra la lectura prohibida para poder buscarla.",
};

function fuentes(arbol: string): string[] {
  const raiz = path.join(REPO, arbol);
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      if (entrada === "node_modules" || entrada === "dist" || entrada === ".next") continue;
      const completa = path.join(dir, entrada);
      if (statSync(completa).isDirectory()) recorrer(completa);
      else if (/\.(ts|tsx)$/.test(entrada)) salida.push(path.relative(REPO, completa));
    }
  };
  recorrer(raiz);
  return salida;
}

function leer(archivo: string): string {
  return readFileSync(path.join(REPO, archivo), "utf8");
}

/**
 * Cualquier mención de `getForImeis` que NO sea `getForImeisDeCuenta` — una
 * llamada, una definición, un mock en una prueba, un tipo. Deliberadamente
 * ancha: el método ya no existe, así que nombrarlo siquiera es la señal.
 */
function menciones(fuente: string): number {
  return (fuente.match(/getForImeis(?!DeCuenta)/g) ?? []).length;
}

describe("guardia · nadie reintroduce la lectura de telemetría sin cuenta", () => {
  const archivos = arboles().flatMap(fuentes).filter((a) => !(a in EXENTOS));

  it("el barrido encuentra código de verdad (guarda contra un falso verde)", () => {
    // Sin esto, una ruta mal escrita dejaría cero archivos que revisar y la
    // prueba de abajo pasaría por la razón equivocada.
    expect(archivos.length).toBeGreaterThan(300);
    expect(archivos).toContain("packages/db/src/repositories/index.ts");
    expect(archivos).toContain("packages/services/src/verification.ts");
    expect(archivos).toContain("apps/web/src/lib/monitoreo-data.ts");
    // Y los nueve paquetes más las dos apps siguen apareciendo.
    expect(arboles().length).toBeGreaterThanOrEqual(10);
  });

  it("ningún archivo nombra una lectura por IMEI sin cuenta", () => {
    const culpables = archivos.filter((a) => menciones(leer(a)) > 0);
    expect(
      culpables,
      "Estos archivos nombran una lectura de telemetry_points por IMEI sin cuenta. " +
        "El IMEI no es el muro: la única lectura válida es " +
        "repos.telemetry.getForImeisDeCuenta(carrierAccountId, imeis, desde, hasta). " +
        "Ver el comentario de ese método en packages/db/src/repositories/index.ts.",
    ).toEqual([]);
  });

  it("el repositorio ya no define getForImeis", () => {
    const repo = leer("packages/db/src/repositories/index.ts");
    expect(repo).not.toMatch(/async\s+getForImeis\s*\(/);
    // Y la que sí debe existir, existe: borrar las dos dejaría lo de arriba en verde.
    expect(repo).toMatch(/async\s+getForImeisDeCuenta\s*\(/);
  });

  it("los exentos siguen siendo exactamente los que están escritos aquí", () => {
    expect(Object.keys(EXENTOS)).toEqual([
      "packages/services/src/guardia-muro-cuenta.test.ts",
    ]);
  });
});

describe("guardia · el motor lee la evidencia con el muro de cuenta", () => {
  for (const archivo of CAMINO_DEL_VEREDICTO) {
    it(`${archivo} lee con getForImeisDeCuenta`, () => {
      // Que no exista la puerta no prueba que el motor esté leyendo: borrar la
      // lectura entera también quitaría la mención. Esto exige que lea, y con cuenta.
      expect(leer(archivo)).toContain("getForImeisDeCuenta(");
    });
  }
});
