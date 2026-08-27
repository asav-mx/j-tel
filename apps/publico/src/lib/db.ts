import { createDb, createRepositories, type Database, type Repositories } from "@jtel/db";

let db: Database | null = null;
let repos: Repositories | null = null;

/**
 * La conexión de la app pública.
 *
 * **Solo lectura por uso, no por permiso** — usa la misma `DATABASE_URL` que el
 * resto del producto, y ninguna ruta de esta app escribe. Cuando el proyecto de
 * Vercel exista, apuntarla al usuario de solo lectura la vuelve solo lectura
 * por permiso también, que es mejor; hoy esa variable no está en Vercel.
 */
export function getRepos(): Repositories {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no configurada en la app pública");
  if (!db) db = createDb(url);
  if (!repos) repos = createRepositories(db);
  return repos;
}
