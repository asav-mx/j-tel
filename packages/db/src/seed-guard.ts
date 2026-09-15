/**
 * Candado del seed.
 *
 * `seed.ts` hace `TRUNCATE` de TODAS las tablas de `public` antes de sembrar los
 * datos de demo, y siembra cuentas, contratos, unidades, aparatos, servicios y
 * membresías inventados. Es el guion que pobló producción el **7 de julio de
 * 2026**: las cuentas reales de hoy nacieron de él, y sus unidades, aparatos y
 * geocercas de mentira vivieron dentro de la cuenta de un cliente real hasta el
 * 14 de septiembre.
 *
 * ## Por qué dejó de comparar texto
 *
 * La versión del 27 de julio exigía `SEED_DATABASE_URL` y se negaba si era
 * **idéntica, como texto,** a `DATABASE_URL`. Eso deja pasar la misma base con
 * otro nombre: la URL `-pooler` de Neon, otro usuario, `sslmode` puesto o no. La
 * trampa exacta que `candado-desechable.ts` ya resolvía para los escenarios, y el
 * seed —el guion más destructivo del repo— seguía sin usarlo.
 *
 * Ahora compara la **identidad** —host sin `-pooler`, puerto y base— contra
 * **todas** las conexiones que el ambiente conoce, incluida `DATABASE_URL_TEST`:
 * la desechable es una copia de producción que alguien está usando, y un
 * `TRUNCATE` ahí también es un accidente. Si no hay contra qué comparar, exige
 * nombrar el destino a mano con `--base`.
 */
import {
  conexionesDelAmbiente,
  revisarDesechable,
  type ConexionConocida,
} from "./candado-desechable.js";

/** Las bases donde el seed nunca siembra: todas las del ambiente menos la suya. */
export function conexionesVedadasAlSeed(env: NodeJS.ProcessEnv): ConexionConocida[] {
  return [
    ...conexionesDelAmbiente(env).filter((c) => !c.nombre.startsWith("SEED_DATABASE_URL")),
    { nombre: "DATABASE_URL_TEST (copia desechable de producción)", url: env.DATABASE_URL_TEST },
  ];
}

export function resolveSeedDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  confirmacion?: string,
): string {
  const seedUrl = env.SEED_DATABASE_URL?.trim();
  const veredicto = revisarDesechable({
    objetivo: seedUrl || undefined,
    otras: conexionesVedadasAlSeed(env),
    confirmacion,
    nombreObjetivo: "SEED_DATABASE_URL",
  });

  if (!veredicto.ok) {
    throw new Error(
      `[seed] ${veredicto.motivo} El seed hace TRUNCATE de TODAS las tablas y siembra ` +
        "datos inventados: apunta SEED_DATABASE_URL a una base de desarrollo propia.",
    );
  }

  return seedUrl!;
}
