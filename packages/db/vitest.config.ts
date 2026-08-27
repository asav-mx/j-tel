import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Los tests de integración requieren DATABASE_URL_TEST y corren por separado
    // con `pnpm test:integration`. El script `test` solo corre tests unitarios.
    //
    // El patrón `*.integration.test.ts` está aquí para que un archivo nuevo de
    // integración quede excluido por su NOMBRE, sin que nadie tenga que
    // acordarse de agregarlo. Cuando se agregó el de asignación de circuito,
    // la lista literal no lo cubría y la suite unitaria reventó pidiendo una
    // base que no le toca tener.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "src/integration.test.ts",
      "**/*.integration.test.ts",
    ],
    passWithNoTests: true,
  },
});
