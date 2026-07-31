/**
 * Qué cambió entre dos versiones de la política — función pura.
 *
 * El diff se calcula al LEER y no se guarda: lo que la base conserva son las
 * dos fotos completas, que es el dato que no puede quedar mal. Una lista de
 * llaves guardada al escribir se congela con la forma de leer de ese día; una
 * derivada mejora sin migrar nada.
 *
 * Cada cambio se dice con el nombre humano de la perilla, no con la llave del
 * esquema: la historia de un contrato la lee quien lo administra, y
 * `kmlMatchMinPct: 60 → 70` no le dice nada. El catálogo de `perillas-contrato`
 * es el mismo que usa la oficina, así que el nombre que se ve al editar es el
 * que aparece después en la historia.
 *
 * Se prueba sin base de datos.
 */

import type { ContractPolicy } from "@jtel/domain";
// Relativo y no por alias: este módulo se prueba con vitest, que corre sin la
// resolución de rutas de Next.
import { PERILLAS, type Perilla } from "./perillas-contrato";

export type CambioDePerilla = {
  llave: string;
  /** La perilla del catálogo, cuando la llave es una de las conocidas. */
  perilla: Perilla | null;
  /** Cómo se llama en pantalla. La llave cruda solo si no está catalogada. */
  nombre: string;
  antes: unknown;
  despues: unknown;
  /**
   * Si equivocarse en esta perilla produce veredictos falsos. Sale del
   * catálogo, no de una lista aparte: la advertencia que se ve al editar es la
   * misma que marca el cambio en la historia.
   */
  riesgo: string | null;
  /** Si el árbitro la lee para decidir, o si solo organiza la mesa. */
  decide: Perilla["decide"] | null;
};

const CATALOGO = new Map<string, Perilla>(PERILLAS.map((p) => [p.llave as string, p]));

/**
 * Compara por valor, no por referencia — y sin que importe el orden de las
 * llaves.
 *
 * Las dos cosas son necesarias por cómo viaja la política:
 *
 *  - Es jsonb, así que dos lecturas del mismo contrato traen objetos y
 *    arreglos distintos con el mismo contenido. Por referencia, cada guardado
 *    marcaría un cambio falso.
 *  - Postgres guarda las llaves de un jsonb en SU orden (por longitud y luego
 *    por bytes), y zod devuelve las suyas en el orden del esquema. O sea que
 *    la misma política leída por dos caminos produce dos objetos con las
 *    llaves en distinto orden. Comparar con `JSON.stringify` los daba por
 *    distintos y hacía saltar el aviso de "alguien la escribió por fuera del
 *    registro" en un contrato donde no había pasado nada — y una alarma que
 *    salta siempre se aprende a ignorar.
 *
 * El orden de los ARREGLOS sí cuenta: en los motivos excusables, reordenar es
 * un cambio que el usuario hizo a propósito.
 */
function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return a.length === b.length && a.every((v, i) => igual(v, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(b, k) &&
        igual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }

  return false;
}

/**
 * Las perillas que cambiaron entre dos versiones.
 *
 * Recorre la unión de llaves de las dos fotos, no solo las del catálogo: una
 * política guardada puede traer una llave que el catálogo todavía no nombra
 * —porque el esquema la agregó y esta pantalla no se actualizó—, y callarla
 * sería esconder un cambio real. Sale con la llave cruda y se ve fea, que es
 * exactamente la señal de que falta catalogarla.
 *
 * El orden es el del catálogo, para que la historia se lea en el mismo orden
 * en que están los campos en la oficina. Lo no catalogado va al final.
 */
export function cambiosEntre(
  antes: Partial<ContractPolicy>,
  despues: Partial<ContractPolicy>,
): CambioDePerilla[] {
  const llaves = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})]);
  const orden = new Map(PERILLAS.map((p, i) => [p.llave as string, i]));

  const cambios: CambioDePerilla[] = [];
  for (const llave of llaves) {
    const a = (antes as Record<string, unknown>)?.[llave];
    const d = (despues as Record<string, unknown>)?.[llave];
    if (igual(a, d)) continue;

    const perilla = CATALOGO.get(llave) ?? null;
    cambios.push({
      llave,
      perilla,
      nombre: perilla?.nombre ?? llave,
      antes: a,
      despues: d,
      riesgo: perilla?.riesgo ?? null,
      decide: perilla?.decide ?? null,
    });
  }

  return cambios.sort(
    (x, y) =>
      (orden.get(x.llave) ?? Number.MAX_SAFE_INTEGER) -
        (orden.get(y.llave) ?? Number.MAX_SAFE_INTEGER) || x.llave.localeCompare(y.llave),
  );
}

/**
 * Un valor de política, escrito para leerse.
 *
 * Los porcentajes y las fracciones se escriben con su unidad porque un `0.15`
 * suelto en una lista de cambios no dice si son quince por ciento o quince
 * minutos. Ausente se dice "sin configurar" y no se deja en blanco: un hueco
 * se lee como un dato que no se cargó, y aquí significa otra cosa.
 */
export function valorEscrito(valor: unknown, perilla: Perilla | null): string {
  if (valor === null || valor === undefined || valor === "") return "sin configurar";
  if (typeof valor === "boolean") return valor ? "encendido" : "apagado";

  if (Array.isArray(valor)) {
    return valor.length === 0 ? "ninguno" : valor.join(", ");
  }

  if (typeof valor === "number") {
    switch (perilla?.forma.tipo) {
      case "porcentaje":
        return `${valor.toFixed(1)}%`;
      case "fraccion":
        return `${(valor * 100).toFixed(1)}%`;
      case "entero":
        return `${valor} ${perilla.forma.unidad}`;
      default:
        return String(valor);
    }
  }

  return String(valor);
}

// ---------------------------------------------------------------------------
// La cadena
// ---------------------------------------------------------------------------

export type EdicionCruda = {
  id: string;
  policyBefore: Partial<ContractPolicy>;
  policyAfter: Partial<ContractPolicy>;
  actorKind: string;
  actorId: string | null;
  note: string | null;
  changedAt: Date;
};

export type EdicionLeida = EdicionCruda & {
  cambios: CambioDePerilla[];
  /**
   * El registro se rompió antes de esta edición: lo que la anterior dejó no es
   * lo que esta encontró. Significa que alguien escribió la política sin pasar
   * por el registro. Se declara; una historia con un hueco escondido es peor
   * que no tener historia.
   */
  cadenaRota: boolean;
};

/**
 * Lee la historia y verifica que encadene.
 *
 * `ediciones` llega de la más reciente a la más antigua, como la devuelve la
 * consulta. La comprobación es la razón por la que se guardan las dos fotos:
 * el `policyAfter` de una edición tiene que ser el `policyBefore` de la
 * siguiente en el tiempo. Si no lo es, hubo una escritura que no dejó rastro.
 *
 * La edición más reciente NO se compara contra la política vigente aquí — eso
 * lo hace quien tiene la política a la mano, y se declara aparte.
 */
export function leerHistoria(ediciones: readonly EdicionCruda[]): EdicionLeida[] {
  return ediciones.map((edicion, i) => {
    // El arreglo va de nueva a vieja: la anterior EN EL TIEMPO es la siguiente.
    const anterior = ediciones[i + 1];
    return {
      ...edicion,
      cambios: cambiosEntre(edicion.policyBefore, edicion.policyAfter),
      cadenaRota: anterior
        ? !igual(anterior.policyAfter, edicion.policyBefore)
        : false,
    };
  });
}

/**
 * ¿La política vigente es la que dejó la última edición registrada?
 *
 * Si no lo es, alguien la cambió por fuera del registro después de la última
 * edición conocida. Es el mismo hueco que `cadenaRota` pero en la punta, donde
 * la comparación es contra el contrato vivo y no contra otra fila.
 */
export function vigenteCoincide(
  vigente: Partial<ContractPolicy>,
  ultima: EdicionCruda | undefined,
): boolean {
  if (!ultima) return true;
  return igual(ultima.policyAfter, vigente);
}

/**
 * Cómo se firma una edición.
 *
 * Hasta que exista auth-rbac el sistema sabe que fue una persona pero no cuál:
 * el identificador viaja vacío. La firma honesta mientras tanto es el rol —
 * nunca un nombre inventado ni un campo que finja precisión.
 */
export function firmaDeEdicion(actorKind: string, actorId: string | null): string {
  if (actorId?.trim()) return actorId.trim();
  switch (actorKind) {
    case "human":
      return "una persona · sin identificar hasta que exista control de acceso";
    case "system:cli":
      return "proceso · línea de comandos";
    case "system:cron":
      return "proceso · automático";
    default:
      return actorKind;
  }
}
