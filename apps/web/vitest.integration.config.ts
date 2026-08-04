import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Las pruebas de `apps/web` que SÍ tocan una base de datos.
 *
 * Las otras 472 corren con repositorios simulados y por eso son rápidas y no
 * necesitan nada. Éstas existen para lo que un simulacro no puede contestar:
 * **si una pantalla del transportista entrega una fila que no es suya**. Un
 * mock del repositorio contesta lo que el que escribió el mock creyó; la base
 * contesta lo que hay.
 *
 * ## El candado
 *
 * Van contra `DATABASE_URL_TEST` —la rama desechable de Neon— y **nunca**
 * contra producción. La comprobación se hace aquí, antes de que vitest cargue
 * un solo archivo de prueba, y compara las dos URLs **antes** de pisar
 * `DATABASE_URL`: si se pisara primero, la comparación se haría contra sí
 * misma y siempre pasaría.
 *
 * También se borran `POSTGRES_URL` y sus hermanas, porque `getDatabaseUrl()`
 * cae a ellas en cadena: dejar una apuntando a producción convertiría el
 * candado en decorado el día que alguien quitara `DATABASE_URL`.
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

const PRODUCCION = process.env.DATABASE_URL;
const PRUEBAS = process.env.DATABASE_URL_TEST;

if (!PRUEBAS) {
  throw new Error(
    "[integración] DATABASE_URL_TEST no está definida. Apunta a la rama desechable de Neon.",
  );
}
if (PRODUCCION && PRUEBAS === PRODUCCION) {
  throw new Error("[integración] DATABASE_URL_TEST es idéntica a DATABASE_URL. Abortado.");
}
if (PRODUCCION && new URL(PRUEBAS).hostname === new URL(PRODUCCION).hostname) {
  throw new Error("[integración] DATABASE_URL_TEST comparte host con producción. Abortado.");
}

process.env.DATABASE_URL = PRUEBAS;
delete process.env.POSTGRES_URL;
delete process.env.POSTGRES_PRISMA_URL;
delete process.env.POSTGRES_URL_NON_POOLING;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["src/**/*.integration.test.ts"],
    // Escriben en la misma rama desechable: en paralelo se pisan.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
