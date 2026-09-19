import { SIN_SENAL_MINUTOS } from "@jtel/domain";
import type { DispositivoDelInventario } from "@jtel/services";
import { conCuenta } from "@/lib/casa/casas";
import { RAIZ_EXPEDIENTES } from "@/lib/casa/expedientes";

/**
 * El cuarto Dispositivos y las acciones de Ver ‹dispositivo› (C4), en lo que se
 * ve: rutas, palabras y el «hecho» que se dice después de actuar. Vive aparte
 * de las páginas para poder probarlo.
 *
 * Prototipo aprobado el 17 de septiembre de 2026:
 * https://claude.ai/artifact/FGi58hto8teEYappBAQw1Z
 */

/**
 * El cajón Dispositivos del archivero de Expedientes. Hasta el 19-sep fue un
 * lugar propio del menú; la dirección vieja redirige aquí (ficha del archivero §4).
 */
export const RAIZ_DISPOSITIVOS = `${RAIZ_EXPEDIENTES}/dispositivos`;

/** La dirección del lugar que ya no existe. Sólo la usa su redirección. */
export const RAIZ_DISPOSITIVOS_VIEJA = "/casa/transportista/dispositivos";

/** Las acciones que abren un panel en su pantalla (`?accion=`). */
export type AccionDeDispositivo = "alta" | "asignar" | "soltar" | "baja";

/**
 * De dónde se llegó a Ver ‹dispositivo›: tiene dos puertas, y se vuelve a la que
 * se usó. `dispositivos` es el cajón; `expedientes`, el tablero (su «Piden
 * atención» y su buscador).
 */
export type Puerta = "dispositivos" | "expedientes";

/** Lo que acaba de pasar en Ver ‹dispositivo›. Sólo nombra la acción: la frase se arma con la base. */
export type HechoDeFicha = "asignado" | "soltado" | "baja";

export function hechoDeFicha(valor: unknown): HechoDeFicha | null {
  return valor === "asignado" || valor === "soltado" || valor === "baja" ? valor : null;
}

export function accionDeFicha(valor: unknown): Exclude<AccionDeDispositivo, "alta"> | null {
  return valor === "asignar" || valor === "soltar" || valor === "baja" ? valor : null;
}

function conParams(ruta: string, params: Record<string, string | null | undefined>, cuenta?: string | null) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return conCuenta(s ? `${ruta}?${s}` : ruta, cuenta);
}

export const rutasDeDispositivos = {
  cuarto: (cuenta?: string | null, params: { accion?: "alta"; hecho?: string; dispositivo?: string } = {}) =>
    conParams(RAIZ_DISPOSITIVOS, params, cuenta),
  /**
   * La ficha vive en Expedientes (#421) y se llega desde los dos cuartos. `desde`
   * sólo se escribe cuando no es la puerta de siempre, para que las ligas viejas
   * sigan limpias.
   */
  ver: (
    id: string,
    cuenta?: string | null,
    params: {
      desde?: Puerta;
      accion?: Exclude<AccionDeDispositivo, "alta">;
      hecho?: HechoDeFicha;
      /** Con `hecho=asignado`: el dispositivo que la unidad traía y quedó en bodega. */
      desplazado?: string | null;
    } = {},
  ) =>
    conParams(
      `${RAIZ_EXPEDIENTES}/dispositivo/${id}`,
      {
        desde: params.desde === "dispositivos" ? "dispositivos" : null,
        accion: params.accion,
        hecho: params.hecho,
        desplazado: params.desplazado,
      },
      cuenta,
    ),
  /**
   * Recorridos y playback del dispositivo. La puerta va en `puerta`, no en
   * `desde`: ahí la dirección lleva la ventana (`desde`/`hasta`).
   */
  recorrido: (id: string, cuenta?: string | null, puerta?: Puerta) =>
    conParams(`${RAIZ_EXPEDIENTES}/dispositivo/${id}/recorrido`, { puerta: puerta === "dispositivos" ? "dispositivos" : null }, cuenta),
};

/** Lee `?desde=` sin confiar en él: cualquier otra cosa es la puerta de siempre. */
export function puertaDe(valor: unknown): Puerta {
  return valor === "dispositivos" ? "dispositivos" : "expedientes";
}

/** El apoyo de un dispositivo en el inventario: dos o tres palabras. */
export function apoyoDeInventario(d: Pick<DispositivoDelInventario, "unidad" | "estado">): string {
  if (d.estado.grupo === "de_baja") return d.estado.retiredReason ?? "sin motivo";
  // «Nunca ha reportado» ya lo dice el dato (`nunca · última señal`); repetirlo
  // en el apoyo lo cortaba a 375 px y no agregaba nada.
  return d.unidad ? `en ${d.unidad}` : "sin unidad";
}

/**
 * ¿El dato del dispositivo va en cobre? Sólo si está montado **y** su señal es
 * de dentro de los 15 min de `SIN_SENAL_MINUTOS`. El prototipo pintaba de cobre
 * a todo lo que estaba en unidad; con datos reales, «hace 3.8 h» salía en el
 * color de la vida sin serlo (skill: el cobre sólo donde hay vida). Es el mismo
 * umbral con que Flota en vivo separa EN LÍNEA de SIN SEÑAL.
 */
export function senalViva(estado: DispositivoDelInventario["estado"], ahora: Date): boolean {
  if (estado.grupo !== "en_unidad" || !estado.ultimaSenalAt) return false;
  return ahora.getTime() - estado.ultimaSenalAt.getTime() <= SIN_SENAL_MINUTOS * 60_000;
}

/**
 * Las sugerencias sólo llenan el texto: el motivo lo escribe quien actúa y se
 * guarda tal cual (decisión 7 de la ficha).
 */
export const SUGERENCIAS = {
  soltar: ["Entró a taller", "Se cambia de unidad", "Falla del dispositivo"],
  baja: ["Se quemó", "Se perdió", "Se devolvió al proveedor"],
} as const;

/** `07:42` en la zona dada, a 24 h. */
export function horaDe(instante: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(instante);
}

/**
 * Quién y por qué de una asignación, en una línea corta. Lo anterior a la 0039
 * no guardó nada y lo dice: «sin registro», nunca un nombre inventado.
 *
 * `correo` traduce el id de la sesión a algo legible (`correosDeAutores`).
 */
export function quienYPorQue(
  a: { vigente: boolean; asignadaPor: string | null; cerradaPor: string | null; motivoCierre: string | null },
  correo: (id: string) => string,
): string {
  if (a.vigente) return a.asignadaPor ? `asignó ${correo(a.asignadaPor)}` : "asignación sin registro de quién";
  if (!a.motivoCierre && !a.cerradaPor) return "cierre sin registro de quién ni por qué";
  return [a.motivoCierre ?? "sin motivo", a.cerradaPor ? correo(a.cerradaPor) : "sin registro de quién"].join(" · ");
}

/** Un texto que viene en la dirección, recortado. Nunca se usa para afirmar un dato. */
export function textoDeRuta(valor: unknown, largo = 300): string | null {
  return typeof valor === "string" && valor.trim() ? valor.slice(0, largo) : null;
}
