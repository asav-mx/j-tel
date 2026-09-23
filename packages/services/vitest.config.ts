/* La zona de las pruebas es UTC, y vive aquí para que no se pueda perder
   al correr vitest a mano. Ver el archivo: cuesta un rojo que parece del
   producto. */
import "../../scripts/zona-de-las-pruebas.mjs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Mismo patrón que @jtel/db: las pruebas de integración requieren
    // DATABASE_URL_TEST y corren aparte con `pnpm test:integration`. El
    // script `test` sólo corre las que usan repositorios de mentira.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
    passWithNoTests: true,
  },
});
