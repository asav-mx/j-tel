import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * La promesa de un circuito tiene UNA fuente: las franjas (decisión de Asav,
 * 21 sep 2026). `circuits.declared_frequency_minutes` dejó de ser promesa.
 *
 * Por qué una valla y no confianza: dos fuentes de la misma promesa se separan
 * el primer mes, y el daño no se ve revisando el diff. Ontoy diría «cada 20» en
 * hora pico mientras la torre mide contra «cada 10» — la afirmación falsa del
 * alcance (Marco §D, 9.1c), con las dos cifras «correctas» cada una en su lado.
 *
 * La columna sigue físicamente hasta la migración que la borre. Mientras tanto
 * esta prueba lee el código y exige que **nadie la lea ni la escriba**: fuera
 * del esquema, nombrarla es la señal. Las pruebas quedan fuera del barrido
 * porque una prueba puede sembrar la columna para demostrar que se ignora.
 *
 * Y del lado del pasajero, que el campo viejo de la respuesta
 * (`frecuencia_declarada_min`) no vuelva: la app lee `promesa`, de las franjas.
 */

const SRC = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SRC, "../../..");

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

function fuentes(arbol: string): string[] {
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      if (entrada === "node_modules" || entrada === "dist" || entrada === ".next") continue;
      const completa = path.join(dir, entrada);
      if (statSync(completa).isDirectory()) recorrer(completa);
      else if (/\.(ts|tsx)$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
        salida.push(path.relative(REPO, completa));
      }
    }
  };
  recorrer(path.join(REPO, arbol));
  return salida;
}

const leer = (a: string) => readFileSync(path.join(REPO, a), "utf8");
/** Sin comentarios: la historia de la columna se puede contar en prosa; usarla, no. */
const sinComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ESQUEMA = "packages/db/src/schema/index.ts";

describe("guardia · la promesa tiene una sola fuente: las franjas", () => {
  const archivos = arboles().flatMap(fuentes);

  it("el barrido encuentra código de verdad (guarda contra un falso verde)", () => {
    expect(archivos.length).toBeGreaterThan(300);
    expect(archivos).toContain(ESQUEMA);
    expect(archivos).toContain("apps/publico/src/app/api/circuitos/[slug]/unidades/route.ts");
  });

  it("nadie fuera del esquema lee ni escribe declared_frequency_minutes", () => {
    const culpables = archivos
      .filter((a) => a !== ESQUEMA)
      .filter((a) => /declaredFrequencyMinutes|declared_frequency_minutes/.test(sinComentarios(leer(a))));
    expect(
      culpables,
      "Estos archivos usan la columna vieja de la frecuencia. La promesa se lee de las franjas: " +
        "getPromiseTableVigente / promesaAhora (Ontoy) / resumenDeLaPromesa (J-Staff), y se escribe con savePromiseTable.",
    ).toEqual([]);
  });

  it("la respuesta del pasajero no vuelve a traer el campo viejo", () => {
    const culpables = archivos.filter((a) => /frecuencia_declarada_min/.test(sinComentarios(leer(a))));
    expect(culpables).toEqual([]);
  });

  it("Ontoy lee la promesa de las franjas, y en la respuesta que no vive en caché", () => {
    const unidades = sinComentarios(leer("apps/publico/src/app/api/circuitos/[slug]/unidades/route.ts"));
    expect(unidades).toContain("promesaDelCircuito(");
    const promesa = sinComentarios(leer("apps/publico/src/lib/promesa.ts"));
    expect(promesa).toContain("getPromiseTableVigente(");
    expect(promesa).toContain("promesaAhora(");
    // La forma vive una hora en caché: una promesa ahí sería la de otra franja.
    const forma = sinComentarios(leer("apps/publico/src/app/api/circuitos/[slug]/route.ts"));
    expect(forma).not.toMatch(/promesa/);
  });
});
