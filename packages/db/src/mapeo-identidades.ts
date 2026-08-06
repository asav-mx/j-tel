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
 * `JTEL_DEV_USER=jstaff_admin` está puesto en Vercel, y eso es lo que sostiene
 * el acceso. (El respaldo `tecma_admin` del bypass **ya no existe**: la pieza
 * 1.e lo retiró y sin señal no hay identidad. La cadena del seed sigue en la
 * tabla porque es la que usa `JTEL_DEV_USER`.) Un `UPDATE` sobre esas filas
 * deja al bypass sin membresías y **cierra el producto en silencio** — las
 * pantallas siguen abriendo, en blanco. Insertando, las dos identidades conviven: la cadena del
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
  /**
   * Identidad **de prueba**, creada para poder abrir varias caras a la vez.
   *
   * No cambia nada del vínculo: cambia que **la lista de limpieza existe**. Sin
   * esta marca, saber cuáles borrar el día que se retiren depende de que alguien
   * se acuerde, y acordarse no es una propiedad del sistema.
   */
  prueba?: boolean;
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
  /*
   * Identidades de prueba — instancia de Development de Clerk, 6 de agosto de
   * 2026. Existen para poder abrir las tres caras a la vez en navegadores
   * distintos, que hoy no se puede.
   *
   * **No se creó ninguna cuenta ni ninguna membresía nueva:** las tres del seed
   * ya existían con su alcance. Esto solo les liga una identidad de Clerk, y
   * `vincular()` **agrega, no reemplaza** — la fila del seed sigue sosteniendo
   * el bypass.
   *
   * **No llevan la convención `+clerk_test`** por decisión de Asav; van marcadas
   * con `prueba: true`, que es lo que las hace localizables para limpiarlas.
   *
   * Falta la de Planta 47. Y cuando llegue **no va a poder ver su cara**:
   * `canAccessClientAccount` exige alcance `account` y ella tiene `plant`, así
   * que `/cliente` le contesta «No hay cuentas cliente». **Eso no es un defecto
   * de esta lista: es la pieza 1.h, y esa identidad es su prueba viva.**
   */
  {
    desde: "tecma_admin",
    hacia: "user_3HVjXhUyY22DuXslNMxTqQS2udL",
    nota: "Prueba — admin corporativo de Tecma, alcance de cuenta",
    prueba: true,
  },
  {
    desde: "jb_admin",
    hacia: "user_3HViswLh8JErshGkisshWsocqCA",
    nota: "Prueba — admin de Juárez Bus, alcance de cuenta de carrier",
    prueba: true,
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
