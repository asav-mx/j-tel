import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Los tests de integración requieren DATABASE_URL_TEST y corren por separado
    // con `pnpm test:integration`. El script `test` solo corre tests unitarios.
    exclude: ["**/node_modules/**", "**/dist/**", "src/integration.test.ts"],
    passWithNoTests: true,
  },
});
