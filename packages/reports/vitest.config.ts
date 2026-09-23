/* La zona de las pruebas es UTC, y vive aquí para que no se pueda perder
   al correr vitest a mano. Ver el archivo: cuesta un rojo que parece del
   producto. */
import "../../scripts/zona-de-las-pruebas.mjs";
import { defineConfig } from "vitest/config";

/**
 * Este paquete no tenía configuración: corría con la de fábrica y con la zona
 * puesta en su script (o sin ella). El archivo existe para que la zona no
 * dependa de cómo se invoque vitest — no cambia nada más.
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
  },
});
