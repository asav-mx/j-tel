import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vernier V1 — dos guardias de fuente.
 *
 * 1. **Las pantallas del cuarto y del acta no juzgan.** Ni importan el motor,
 *    ni llaman a una ruta que verifique o re-selle (ficha §6, prueba 7). El
 *    cargador ya tiene su repositorio espía en `@jtel/services`; esto cierra el
 *    otro camino: que la página llame al motor por su cuenta.
 * 2. **Los colores del sello son exclusivos del sello** (ficha §4): `--sello-ok`
 *    y `--ladrillo` no aparecen fuera de la piel, el glifo, la pieza y las dos
 *    pantallas que dibujan veredictos.
 */

const SRC = fileURLToPath(new URL("../..", import.meta.url));
const leer = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

const PANTALLAS = [
  "app/casa/transportista/servicios-especiales/page.tsx",
  "app/casa/transportista/servicios-especiales/[ocurrenciaId]/page.tsx",
  "components/casa/servicios-especiales.tsx",
  "components/casa/traza-del-acta.tsx",
  "lib/casa/servicios-especiales.ts",
];

describe("las pantallas de Vernier leen lo sellado y nada más", () => {
  for (const rel of PANTALLAS) {
    it(rel, () => {
      const fuente = leer(rel);
      for (const prohibido of [
        /from "@jtel\/verification"/,
        /\bverifyOccurrence\b/,
        /\breverify\w*\(/,
        /\/api\/(occurrences|support|jstaff|cron)\//,
        /method:\s*"(POST|PUT|PATCH|DELETE)"/,
        /getRepos\(\)\.(?!vernier)\w+/,
      ]) {
        expect(fuente, String(prohibido)).not.toMatch(prohibido);
      }
    });
  }
});

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

describe("--sello-ok y --ladrillo son exclusivos del sello", () => {
  const PERMITIDOS = new Set(
    [
      "app/casa/casa.css",
      "app/casa/contraste.test.ts",
      "components/casa/glifo.tsx",
      "components/casa/pieza.tsx",
      "app/casa/transportista/servicios-especiales/[ocurrenciaId]/page.tsx",
      "lib/casa/vernier-guardia.test.ts",
    ].map((r) => path.join(SRC, r)),
  );

  it("nadie más los usa", () => {
    const todos = archivos(SRC);
    expect(todos.length).toBeGreaterThan(100);
    const intrusos = todos.filter((f) => !PERMITIDOS.has(f) && /--(sello-ok|ladrillo)\b/.test(readFileSync(f, "utf8")));
    expect(intrusos.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
