/**
 * Que la valla de la zona **muerda**, no que esté en verde.
 *
 * Una valla que nunca se probó contra el caso que vigila no es una valla: es un
 * comentario que devuelve cero. Aquí se le arma un repo de mentira con el
 * defecto exacto y se comprueba que lo acusa.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { paquetesDelRepo, reclamos } from "./verificar-zona-de-pruebas.mjs";

/** Un repo de mentira: `apps/`, `packages/` y lo que se le ponga dentro. */
function repoDeMentira(paquetes) {
  const raiz = mkdtempSync(join(tmpdir(), "zona-"));
  for (const [ruta, archivos] of Object.entries(paquetes)) {
    const base = join(raiz, ruta);
    mkdirSync(base, { recursive: true });
    for (const [nombre, contenido] of Object.entries(archivos)) {
      writeFileSync(join(base, nombre), contenido);
    }
  }
  return raiz;
}

const CON_VITEST = JSON.stringify({ name: "x", scripts: { test: "vitest run" } });
const BUENA = 'import "../../scripts/zona-de-las-pruebas.mjs";\nexport default {};\n';
const MALA = "export default {};\n";

test("acusa una configuración que no importa la zona", () => {
  const raiz = repoDeMentira({
    "packages/uno": { "package.json": CON_VITEST, "vitest.config.ts": MALA },
  });
  try {
    const malos = reclamos(paquetesDelRepo(raiz));
    assert.equal(malos.length, 1);
    assert.match(malos[0], /no importa/);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test("acusa un paquete que corre vitest y no tiene configuración", () => {
  const raiz = repoDeMentira({ "packages/dos": { "package.json": CON_VITEST } });
  try {
    const malos = reclamos(paquetesDelRepo(raiz));
    assert.equal(malos.length, 1);
    assert.match(malos[0], /no tiene configuración/);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test("una configuración de integración también cuenta", () => {
  const raiz = repoDeMentira({
    "packages/tres": {
      "package.json": CON_VITEST,
      "vitest.config.ts": BUENA,
      "vitest.integration.config.ts": MALA,
    },
  });
  try {
    const malos = reclamos(paquetesDelRepo(raiz));
    assert.equal(malos.length, 1);
    assert.match(malos[0], /integration/);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test("un paquete que NO corre vitest no se le exige nada", () => {
  const raiz = repoDeMentira({
    "packages/cuatro": { "package.json": JSON.stringify({ name: "y", scripts: { build: "tsc" } }) },
  });
  try {
    assert.deepEqual(reclamos(paquetesDelRepo(raiz)), []);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test("una configuración que sí la importa pasa", () => {
  const raiz = repoDeMentira({
    "apps/cinco": { "package.json": CON_VITEST, "vitest.config.ts": BUENA },
  });
  try {
    assert.deepEqual(reclamos(paquetesDelRepo(raiz)), []);
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});

test("y el repo de verdad está en verde", () => {
  assert.deepEqual(reclamos(paquetesDelRepo()), []);
});
