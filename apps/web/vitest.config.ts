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
  },
});
