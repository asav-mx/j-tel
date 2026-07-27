/**
 * Candado del seed.
 *
 * `seed.ts` hace `TRUNCATE` de TODAS las tablas de `public` antes de sembrar los
 * datos de demo. Para que sea IMPOSIBLE vaciar producción por accidente, el seed
 * exige una base de destino EXPLÍCITA en `SEED_DATABASE_URL`, distinta de la
 * `DATABASE_URL` de producción. Sin esa variable —o si apunta a la misma base que
 * `DATABASE_URL`— el seed se niega a correr.
 *
 * Se separa de `seed.ts` (que se auto-invoca al importarse) para poder probarlo
 * como función pura, sin conexión ni efectos.
 */
export function resolveSeedDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const seedUrl = env.SEED_DATABASE_URL?.trim();
  const prodUrl = env.DATABASE_URL?.trim();

  if (!seedUrl) {
    throw new Error(
      "[seed] SEED_DATABASE_URL no está definida. El seed hace TRUNCATE de TODAS las " +
        "tablas, así que exige una base de destino explícita y separada de DATABASE_URL " +
        "para no vaciar producción por accidente. Define SEED_DATABASE_URL apuntando a " +
        "una base de desarrollo/demo antes de sembrar.",
    );
  }

  if (prodUrl && seedUrl === prodUrl) {
    throw new Error(
      "[seed] SEED_DATABASE_URL es idéntica a DATABASE_URL (producción). El seed hace " +
        "TRUNCATE de TODAS las tablas; se niega a correr contra la base de datos de " +
        "producción. Apunta SEED_DATABASE_URL a una base de desarrollo/demo distinta.",
    );
  }

  return seedUrl;
}
