/**
 * Nombres que ningún circuito puede usar como slug público.
 *
 * Son las carpetas fijas bajo `apps/publico/src/app/api/circuitos/`: un
 * circuito llamado así quedaría **tapado** por ellas — su consulta
 * `/api/circuitos/‹slug›` contestaría la otra, y la ruta desaparecería de Ontoy
 * sin error (decisión de ASAV, 22-sep; PR 4a).
 *
 * Dos vallas lo sostienen: J-Staff rechaza estos nombres al dar de alta, y una
 * prueba de Ontoy exige que esta lista y esas carpetas coincidan. Si agregas
 * una carpeta fija allá, agrégala aquí.
 */
export const SLUGS_RESERVADOS: readonly string[] = ["en-vivo", "paradas-de-la-ciudad", "recorridos"];

export function slugReservado(slug: string): boolean {
  return SLUGS_RESERVADOS.includes(slug.trim().toLowerCase());
}
