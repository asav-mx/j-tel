import { HORAS_DE_SERVICIO_PARA_MUDO, type SaludDelLector } from "@jtel/domain/sincronizacion";
import type { GrupoDeLector, LectorDelInventario } from "@jtel/services";
import type { EstadoGlifo } from "@/components/casa/glifo";
import { edad } from "@/lib/casa/expedientes";

/**
 * El cuarto Lectores de J-Staff — lo que la pantalla necesita saber, sin base
 * ni React, para poder probarse.
 *
 * El inventario y la regla de quién está mudo viven más adentro
 * (`@jtel/services` y `@jtel/domain`). Aquí sólo se traduce a formas, palabras
 * y direcciones.
 */

/** Las tres que se ejecutan en el expediente del lector (Ley de Acción). */
export type AccionDeFicha = "asignar" | "soltar" | "baja";

export const rutasDeLectores = {
  cuarto: (params: { accion?: string; hecho?: string; lector?: string; error?: string } = {}) =>
    conParams("/casa/jstaff/lectores", params),
  ver: (
    lectorId: string,
    params: { error?: string; hecho?: string; accion?: AccionDeFicha; motivo?: string } = {},
  ) => conParams(`/casa/jstaff/lectores/${lectorId}`, params),
};

function conParams(base: string, params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const cola = sp.toString();
  return cola ? `${base}?${cola}` : base;
}

/** La forma de cada grupo. La muesca es de la familia; el estado, del relleno. */
export function glifoDe(grupo: GrupoDeLector): EstadoGlifo {
  switch (grupo) {
    case "en_unidad":
      return "lector-en-unidad";
    case "en_bodega":
      return "lector-en-bodega";
    case "mudo":
      return "lector-mudo";
    case "de_baja":
      return "lector-de-baja";
  }
}

/** El rótulo de cada grupo, con lo que pide de quien lo lee. */
export const ROTULO_DE_GRUPO: Record<GrupoDeLector, string> = {
  en_unidad: "En unidad",
  en_bodega: "En bodega",
  mudo: "Mudo — pide ir a ver el camión",
  de_baja: "De baja",
};

/**
 * El apoyo de la pieza: dónde está, y de quién es. **Dos o tres cosas, nunca
 * una oración.**
 *
 * El circuito va porque es lo que el libro anota en cada quemado —y es plan, no
 * recorrido—; cuando la unidad no tiene ninguno se dice, porque un lector sin
 * circuito es justo el que no se puede juzgar.
 */
export function apoyoDe(lector: Pick<LectorDelInventario, "unidad" | "circuito" | "carrier">): string {
  const donde = lector.unidad ? `en la ${lector.unidad}` : "sin unidad";
  const circuito = lector.unidad ? ` · ${lector.circuito ?? "sin circuito asignado"}` : "";
  return `${donde}${circuito} · ${lector.carrier}`;
}

export interface DatoDeLaPieza {
  /** El único número que importa. */
  dato: string;
  /** Su palabra. */
  etiqueta: string;
  /** Va en cobre: está vivo ahora. */
  vivo: boolean;
  /** La edad del último dato, que en lo vivo nunca falta. */
  edad: string | null;
}

/**
 * El número de la pieza, que **depende del momento**, no del gusto.
 *
 * - En el vistazo, un solo número: la edad de su último contacto.
 * - En el mudo, **el número con su umbral**: `4.2 h · umbral 4 h`. Con ese
 *   número alguien decide ir a ver un camión, y sin el umbral tendría que
 *   calcular — que es la trampa que el Marco prohíbe.
 *
 * Un lector que nunca entregó no lleva edad inventada: dice **nunca**, y su
 * pieza no se pinta como si estuviera viva.
 */
export function datoDe(
  lector: Pick<LectorDelInventario, "ultimoContacto" | "salud" | "bajaEn">,
  grupo: GrupoDeLector,
  ahora: Date,
): DatoDeLaPieza {
  if (grupo === "de_baja") {
    return { dato: "de baja", etiqueta: "YA NO ENTREGA", vivo: false, edad: null };
  }
  if (grupo === "mudo" && lector.salud.estado === "mudo") {
    const horas = lector.salud.horasDeServicioSinContacto;
    return {
      dato: `${horas.toFixed(1)} h · umbral ${HORAS_DE_SERVICIO_PARA_MUDO} h`,
      etiqueta: "DE SERVICIO SIN CONTACTO",
      vivo: false,
      edad: lector.ultimoContacto ? edad(lector.ultimoContacto, ahora) : "nunca ha entregado",
    };
  }
  if (!lector.ultimoContacto) {
    return { dato: "nunca", etiqueta: "NO HA ENTREGADO NADA", vivo: false, edad: null };
  }
  return {
    dato: edad(lector.ultimoContacto, ahora),
    etiqueta: "ÚLTIMO CONTACTO",
    vivo: grupo === "en_unidad",
    edad: null,
  };
}

/**
 * Lo que la salud dice en palabras, para el expediente.
 *
 * «No se puede decir» se enuncia entero: es un estado del Marco, no un hueco.
 */
export function saludEnPalabras(salud: SaludDelLector): string {
  if (salud.estado === "no_se_puede_decir") {
    return "No se puede decir: su unidad no tiene circuito asignado, y sin horario no hay horas de servicio que contar.";
  }
  const horas = salud.horasDeServicioSinContacto.toFixed(1);
  return salud.estado === "mudo"
    ? `Mudo: ${horas} h de servicio sin contacto, contra un umbral de ${HORAS_DE_SERVICIO_PARA_MUDO} h.`
    : `En contacto: ${horas} h de servicio desde su última entrega, contra un umbral de ${HORAS_DE_SERVICIO_PARA_MUDO} h.`;
}
