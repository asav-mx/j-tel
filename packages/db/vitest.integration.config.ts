import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

/*
 * El .env se carga aquí porque vitest no lo hace solo.
 *
 * Sin esto, `DATABASE_URL_TEST` nunca llegaba al proceso y la suite fallaba
 * siempre con "no está definida" — aunque estuviera definida. El candado que
 * se niega a correr contra producción quedaba inalcanzable, y con él la única
 * forma sancionada de probar escrituras.
 */
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
    include: [
      "src/integration.test.ts",
      "src/asignacion-circuito.integration.test.ts",
      "src/publicacion-circuito.integration.test.ts",
      "src/circuits-constraints.integration.test.ts",
    ],
    // Escriben en la misma rama desechable: en paralelo se pisan.
    fileParallelism: false,
    /*
     * El mismo tope que ya usa `apps/web`, y aquí faltaba.
     *
     * Estas pruebas van contra una rama de Neon por red, no contra memoria.
     * Con el tope de 5 s por omisión, `savePoints` —que inserta 12 000 puntos—
     * corría a 3.6–4.2 s: pasaba, y pasaba por medio segundo. Un tope que se
     * cruza con la latencia del día no mide lo que dice medir; mide qué tan
     * cargada estaba la red, y produce un rojo que no significa nada y que
     * enseña a re-correr la suite en vez de leerla.
     */
    testTimeout: 30_000,
  },
});
