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
  test: {
    include: ["src/**/*.test.ts"],
  },
});
