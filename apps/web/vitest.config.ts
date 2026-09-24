/* La zona de las pruebas es UTC, y vive aquí para que no se pueda perder
   al correr vitest a mano. Ver el archivo: cuesta un rojo que parece del
   producto. */
import "../../scripts/zona-de-las-pruebas.mjs";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * `apps/web` tenía pruebas desde hace tiempo, pero ningún corredor: sin script
 * `test` y sin vitest instalado, ocho archivos `*.test.ts` no se ejecutaban en
 * ninguna parte. Esta configuración los enciende junto con los de la plomería
 * de alertas.
 *
 * El alias `@` repite el de `tsconfig.json`, porque vitest no lee los `paths`
 * de TypeScript por su cuenta.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  /*
   * JSX con el runtime automático. Hasta ahora ninguna prueba renderizaba un
   * componente, así que nunca se notó: esbuild transformaba el JSX al runtime
   * clásico —`React.createElement`— y los archivos de este repo no importan
   * React, porque Next usa el automático. El resultado era un
   * `ReferenceError: React is not defined` DENTRO del componente, que un
   * try/catch de producción se traga y convierte en un falso verde.
   */
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["src/**/*.test.ts"],
    /*
     * Las de integración quedan fuera de la corrida normal, y no por gusto:
     * `*.integration.test.ts` casa con el `include` de arriba, así que sin esta
     * línea CI las levantaría sin `DATABASE_URL_TEST` y el job caería por no
     * tener base — un rojo que no habla de ningún defecto del código.
     * Viven en `vitest.integration.config.ts` y se corren con
     * `pnpm --filter @jtel/web test:integration`.
     */
    exclude: ["node_modules/**", "src/**/*.integration.test.ts"],
    /*
     * **El tope que faltaba en la suite de unitarias.**
     *
     * Las de integración de este mismo paquete ya subían a 30 s; ésta se quedó
     * con los 5 s por omisión, y el 23-sep-2026 tumbó un PR que no tocaba una
     * sola línea de `apps/web`: `rutas-cron.test.ts` expiró en el
     * `await ruta.modulo()` —un `import()` dinámico de una ruta de Next, de lo
     * más caro que hay aquí— mientras el runner iba frío y cargado. Esa misma
     * corrida tardó **53 s** sólo en recolectar los archivos.
     *
     * Medido: en una máquina caliente, ese archivo entero —30 pruebas— corre
     * en **861 ms**. En CI pasó de 5 000. El hueco no es del código: es del
     * runner.
     *
     * Un tope que se cruza con la carga del día **no mide lo que dice medir**,
     * y su rojo es peor que no tenerlo: se arregla re-lanzando, y eso enseña a
     * no creerle a la suite. Es la misma lección que `packages/db` ya pagó.
     *
     * 15 s y no 30: aquí no hay red de por medio, así que es ~17 veces el
     * costo medido y sigue cayendo rápido si una prueba de verdad se cuelga.
     */
    testTimeout: 15_000,
  },
});
