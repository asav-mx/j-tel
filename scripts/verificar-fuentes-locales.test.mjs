/**
 * Que la valla de las fuentes vea lo que tiene que ver, y nada más.
 *
 * Lo que más importa es el segundo bloque: los layouts de las dos apps EXPLICAN
 * en comentarios por qué ya no usan `next/font/google`, y una valla que se
 * cayera con esos comentarios se desactivaría en el primer PR que la tropezara.
 *
 *   pnpm fuentes:test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { lineasQueImportanDeGoogle } from "./verificar-fuentes-locales.mjs";

test("ve cada forma de importar next/font/google", () => {
  const formas = [
    'import { Archivo } from "next/font/google";',
    "import { IBM_Plex_Sans as Plex } from 'next/font/google'",
    'import {\n  Archivo,\n  IBM_Plex_Mono,\n} from "next/font/google";',
    'import "next/font/google";',
    'const f = await import("next/font/google");',
    'const { Inter } = require("next/font/google");',
    'export { Inter } from "next/font/google";',
    'import { Inter } from "next/font/google/target.css";',
  ];
  for (const f of formas) {
    assert.ok(lineasQueImportanDeGoogle(f).length > 0, f);
  }
});

test("dice en qué línea", () => {
  const texto = 'import type { Metadata } from "next";\nimport { Archivo } from "next/font/google";\n';
  assert.deepEqual(lineasQueImportanDeGoogle(texto), [2]);
});

test("no se cae con los comentarios que explican por qué ya no se usa", () => {
  const textos = [
    '/*\n * **Por qué son locales y no `next/font/google`.** `next/font/google` DESCARGA\n */',
    '// antes: import { Archivo } from "next/font/google";',
    '/** import { Archivo } from "next/font/google" — así era */',
  ];
  for (const t of textos) {
    assert.deepEqual(lineasQueImportanDeGoogle(t), [], t);
  }
});

test("deja pasar next/font/local", () => {
  assert.deepEqual(lineasQueImportanDeGoogle('import localFont from "next/font/local";'), []);
});

test("un comentario de línea no se come una URL que viva en el mismo renglón", () => {
  // `https://` tiene `//`: si la limpieza de comentarios lo tomara por uno, se
  // tragaría lo que sigue. Aquí lo que sigue es la importación.
  const t = 'const u = "https://x"; import { A } from "next/font/google";';
  assert.deepEqual(lineasQueImportanDeGoogle(t), [1]);
});
