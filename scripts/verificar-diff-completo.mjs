/**
 * ¿El PR todavía lleva lo que sus commits cambiaron?
 *
 * Sale con código 1 si algún archivo que los commits de esta rama tocaron **no
 * aparece en el diff final contra la base**. Eso significa que algo lo dejó
 * fuera por el camino — casi siempre un merge de `main` que resolvió el
 * conflicto quedándose con el lado de `main`.
 *
 * ---
 *
 * ## El caso que lo motivó, del 13 de agosto de 2026
 *
 * El PR #302 se mergeó **sin su arreglo**. Un merge de `main` a la rama resolvió
 * el conflicto descartando los cambios; los checks corrieron sobre el árbol ya
 * vacío y **pasaron**; y el PR entró con una descripción que prometía código que
 * no llevaba. `main` quedó sin cuatro piezas —el arreglo de «nadie llegó» en la
 * pantalla y en el motor, la extensión a los pendientes y una ficha— y **nada lo
 * detectó**: se cachó yendo a mirar.
 *
 * **Un verde no prueba que el cambio esté: prueba que lo que hay compila.**
 * Compilar, tipar y las pruebas son verdes sobre un árbol al que le quitaron el
 * cambio, porque un cambio ausente no rompe nada — solo no está.
 *
 * ## Por qué esta comprobación sí lo ve
 *
 * Compara dos listas que deberían coincidir y no coinciden cuando algo se cayó:
 *
 *   1. **Lo que los commits de la rama tocaron.** `origin/main..HEAD` excluye por
 *      construcción los commits que ya están en `main`, así que un merge de
 *      `main` no ensucia la lista: quedan solo los commits propios.
 *   2. **Lo que el diff final contra la base todavía cambia.** Es lo que se va a
 *      mergear de verdad.
 *
 * Un archivo en (1) y no en (2) es un cambio que la rama hizo y ya no lleva.
 *
 * ## Los falsos positivos, y por qué se prefieren
 *
 * Hay dos casos legítimos: un archivo que se crea y se borra en la misma rama, y
 * un cambio que se revierte a propósito. Los dos son **raros** y los dos se
 * resuelven diciéndolo —`DIFF_COMPLETO_ESPERADO`—, que deja constancia de que
 * alguien lo miró.
 *
 * Se prefiere el falso positivo al silencio porque los costos no se parecen: uno
 * cuesta leer un renglón, el otro es un PR mergeado con una descripción falsa.
 *
 *   node scripts/verificar-diff-completo.mjs
 */
import { execFileSync } from "node:child_process";

/** Rama base contra la que se compara. */
const BASE = process.env.RAMA_BASE ?? "origin/main";

/**
 * Archivos cuya desaparición del diff está aceptada, separados por coma.
 * Se pone a mano y con motivo en el PR: es la puerta de escape, no el default.
 */
const ESPERADO = (process.env.DIFF_COMPLETO_ESPERADO ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function lineas(salida) {
  return [...new Set(salida.split("\n").map((l) => l.trim()).filter(Boolean))].sort();
}

function main() {
  // Los commits que son de ESTA rama y no de la base. Un merge de la base entra
  // como commit ya conocido y queda fuera solo: por eso `..` y no `...`.
  const tocados = lineas(
    git("log", "--no-merges", "--name-only", "--pretty=format:", `${BASE}..HEAD`),
  );

  if (tocados.length === 0) {
    console.log("  Sin commits propios sobre la base. Nada que comprobar.\n");
    return 0;
  }

  // Lo que el PR cambia de verdad contra el punto en que se separó.
  const enElDiff = new Set(lineas(git("diff", "--name-only", `${BASE}...HEAD`)));

  const perdidos = tocados.filter((f) => !enElDiff.has(f) && !ESPERADO.includes(f));

  console.log(`\n  ¿El PR lleva lo que sus commits cambiaron?`);
  console.log(`  base: ${BASE}\n`);
  console.log(`  archivos tocados por commits de la rama   ${String(tocados.length).padStart(4)}`);
  console.log(`  archivos en el diff final contra la base  ${String(enElDiff.size).padStart(4)}`);
  if (ESPERADO.length > 0) {
    console.log(`  ausencias declaradas a mano              ${String(ESPERADO.length).padStart(4)}`);
  }

  if (perdidos.length === 0) {
    console.log(`\n  ✓ todo lo que la rama tocó sigue en el diff\n`);
    return 0;
  }

  console.log(`\n  ✗ ${perdidos.length} archivo(s) que esta rama cambió NO están en el diff final:\n`);
  for (const f of perdidos) console.log(`      ${f}`);
  console.log(
    `\n  Casi siempre esto es un merge de ${BASE} que resolvió el conflicto\n` +
      `  quedándose con el lado de ${BASE}. El PR se mergearía SIN esos cambios y\n` +
      `  ningún otro check lo vería: un cambio ausente no rompe nada, solo no está.\n\n` +
      `  Qué hacer:\n` +
      `    · Si se cayeron por error — recupéralos y vuelve a empujar.\n` +
      `    · Si su ausencia es a propósito — decláralo:\n` +
      `        DIFF_COMPLETO_ESPERADO="ruta/uno.ts,ruta/dos.ts"\n` +
      `      y di en el PR por qué, para que quede constancia de que alguien miró.\n`,
  );
  return 1;
}

process.exit(main());
