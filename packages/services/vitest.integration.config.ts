import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

/* El .env se carga aquí porque vitest no lo hace solo — mismo patrón que @jtel/db. */
for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {
      /* ignore */
    }
  }
}

export default defineConfig({
  test: {
    include: ["src/comparar-pasos-por-parada.integration.test.ts"],
    // Escribe en la misma rama desechable que @jtel/db: en paralelo se pisan.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
