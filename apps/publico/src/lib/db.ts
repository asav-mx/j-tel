import { createDb, createRepositories, type Database, type Repositories } from "@jtel/db";

let db: Database | null = null;
let repos: Repositories | null = null;

/**
 * La conexión de la app pública. Usa la misma `DATABASE_URL` que el resto del
 * producto.
 *
 * ✎ **Corregido el 23-sep-2026.** Aquí decía «solo lectura por uso: ninguna
 * ruta de esta app escribe», y ya no era cierto desde que entró el contador
 * anónimo de aperturas. Con el P3.5 escriben tres cosas más, todas del libro de
 * boletos: la entrega del lector, el registro de cada entrega y los hallazgos
 * de doble uso.
 *
 * **Consecuencia que hay que tener presente:** apuntar esta conexión al usuario
 * de solo lectura —que era la mejora que este comentario proponía— **rompería
 * esas rutas**. Ya no es una mejora pendiente: es una decisión con costo, y si
 * se toma, el libro y el contador necesitan otra conexión.
 */
export function getRepos(): Repositories {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no configurada en la app pública");
  if (!db) db = createDb(url);
  if (!repos) repos = createRepositories(db);
  return repos;
}
