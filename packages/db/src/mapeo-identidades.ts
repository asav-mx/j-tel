/**
 * El mapeo de identidad — Paso 2 de auth-rbac.
 *
 * `user_memberships.clerk_user_id` guarda hoy las cadenas del seed
 * (`jstaff_admin`, `tecma_admin`, …). Una sesión real de Clerk trae un
 * `user_...` que no tiene ni una fila, así que entra sin membresías y las
 * pantallas abren **vacías, sin error**.
 *
 * **Se agrega, no se reemplaza, y esa es la decisión que gobierna este archivo.**
 * Esas cadenas no son datos muertos: son lo que hoy deja entrar a cualquiera.
 * `JTEL_DEV_USER=jstaff_admin` está puesto en Vercel y `USUARIO_HEREDADO` del
 * bypass es `tecma_admin`. Un `UPDATE` sobre esas filas deja al bypass sin
 * membresías y **cierra el producto en silencio** — las pantallas siguen
 * abriendo, en blanco. Insertando, las dos identidades conviven: la cadena del
 * seed sostiene el bypass y el `user_...` empieza a funcionar en cuanto haya
 * sesión. Las del seed se retiran cuando se retire el bypass, no antes.
 *
 * Este archivo es la decisión (quién es quién) y el plan (qué filas faltan).
 * Lo que toca la base vive en `vincular-identidades.ts`.
 */

import type { ScopeType } from "@jtel/domain";

/** Una identidad del seed que se liga a una identidad real de Clerk. */
export type Vinculo = {
  /** La cadena del seed que hoy carga las membresías. */
  desde: string;
  /** El identificador que emite Clerk. Siempre `user_...`. */
  hacia: string;
  /** Quién es, en una línea, para que la fila se lea sin adivinar. */
  nota: string;
};

/**
 * El mapeo vigente.
 *
 * **Hoy el único usuario del sistema es Asav.** No hay personas reales de Tecma
 * ni del carrier entrando —no existe el flujo de altas—, así que aquí no se
 * inventa ninguna: las otras tres filas del seed se quedan intactas y sin
 * identidad de Clerk ligada.
 *
 * Se llena con una línea por persona cuando exista el flujo de altas.
 */
export const MAPEO: Vinculo[] = [
  {
    desde: "jstaff_admin",
    hacia: "user_3HQuURm3OmMaJXub9RMpRMYHVkN",
    nota: "Asav — J-Staff, admin_plataforma, alcance global",
  },
];

/** Lo que hace falta para decidir si dos membresías son la misma. */
export type FilaDeMembresia = {
  accountId: string;
  role: string;
  scopeType: ScopeType;
  scopeId?: string | null;
};

/**
 * La clave de identidad de una membresía.
 *
 * `scope_id` es nulo en las membresías globales, y **en Postgres dos NULL no
 * chocan en un índice único**: el índice
 * `(account_id, clerk_user_id, role, scope_type, scope_id)` NO impide duplicar
 * la fila de `jstaff_admin`, que es justamente la única que se va a ligar hoy.
 * Por eso la deduplicación se hace aquí, a mano, y no se delega a la base.
 */
function clave(f: FilaDeMembresia): string {
  return JSON.stringify([f.accountId, f.role, f.scopeType, f.scopeId ?? null]);
}

export type ProblemaDeVinculo =
  | "destino-no-es-de-clerk"
  | "origen-es-de-clerk"
  | "origen-igual-a-destino"
  | "vacio";

/**
 * Comprueba un vínculo antes de tocar nada.
 *
 * Falla cerrado: cualquier duda devuelve el problema y el runner se detiene.
 * Un vínculo mal escrito reparte permisos sobre una cuenta de cliente real.
 */
export function validarVinculo(v: Vinculo): ProblemaDeVinculo | null {
  const desde = v.desde.trim();
  const hacia = v.hacia.trim();
  if (!desde || !hacia) return "vacio";
  if (desde === hacia) return "origen-igual-a-destino";
  if (!hacia.startsWith("user_")) return "destino-no-es-de-clerk";
  // Nunca se liga desde una identidad ya real: el origen es siempre el seed.
  if (desde.startsWith("user_")) return "origen-es-de-clerk";
  return null;
}

/**
 * Qué filas hay que insertar para que `destino` tenga lo mismo que `origen`.
 *
 * Idempotente por construcción: lo que ya existe en el destino no se repite, y
 * un origen con filas duplicadas produce una sola inserción. Correr esto dos
 * veces seguidas devuelve una lista vacía la segunda vez.
 *
 * Nunca quita nada. Si el destino tiene membresías que el origen no tiene, se
 * quedan donde están — este plan solo suma.
 */
export function planDeVinculacion(
  origen: FilaDeMembresia[],
  destino: FilaDeMembresia[],
): FilaDeMembresia[] {
  const yaEstan = new Set(destino.map(clave));
  const plan: FilaDeMembresia[] = [];

  for (const fila of origen) {
    const k = clave(fila);
    if (yaEstan.has(k)) continue;
    yaEstan.add(k);
    plan.push(fila);
  }

  return plan;
}
