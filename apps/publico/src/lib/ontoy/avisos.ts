import type { Vivo } from "./forma";

/**
 * Los avisos de la concesión en la campana (8.13b; Ontoy 2.0, PR 4b).
 *
 * Salen de la consulta única de la raíz: cada ruta trae los suyos VIGENTES
 * (el servidor ya quitó los retirados, los programados y los que terminaron).
 * Por eso **un aviso retirado desaparece en la siguiente consulta**: aquí no
 * hay memoria que lo retenga — la lista se arma de cero con cada respuesta.
 */

export interface AvisoEnLaCampana {
  id: string;
  ruta: string;
  nombreDeRuta: string;
  color: string;
  zona: string;
  titulo: string;
  detalle: string | null;
  desde: string;
  hasta: string | null;
}

export function avisosDeTusRutas(
  vivos: Map<string, Vivo>,
  rutas: Array<{ circuito_id: string; nombre: string; color_hex: string; horario: { zona: string } }>,
): AvisoEnLaCampana[] {
  const vistos = new Set<string>();
  const salida: AvisoEnLaCampana[] = [];
  for (const [slug, vivo] of vivos) {
    const ruta = rutas.find((r) => r.circuito_id === slug);
    if (!ruta) continue;
    for (const a of vivo.avisos ?? []) {
      if (vistos.has(a.id)) continue;
      vistos.add(a.id);
      salida.push({
        id: a.id,
        ruta: slug,
        nombreDeRuta: ruta.nombre,
        color: ruta.color_hex,
        zona: ruta.horario.zona,
        titulo: a.titulo,
        detalle: a.detalle,
        desde: a.desde,
        hasta: a.hasta,
      });
    }
  }
  return salida.sort((a, b) => b.desde.localeCompare(a.desde));
}

/** El punto de la campana: SÓLO por avisos de la concesión que no has visto (decisión de ASAV). */
export function hayAvisosNuevos(avisos: AvisoEnLaCampana[], vistos: Set<string>): boolean {
  return avisos.some((a) => !vistos.has(a.id));
}

/**
 * «Hoy 06:32», «Ayer 14:20», «22 sep, 14:20» — en la hora de LA RUTA, no del
 * teléfono: un pasajero de paso con el reloj en otra zona leería otra hora.
 */
export function fechaDelAviso(iso: string, zona: string, ahora: Date): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(x);
  const hora = new Intl.DateTimeFormat("es-MX", { timeZone: zona, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  if (dia(d) === dia(ahora)) return `Hoy ${hora}`;
  if (dia(d) === dia(new Date(ahora.getTime() - 86_400_000))) return `Ayer ${hora}`;
  const fecha = new Intl.DateTimeFormat("es-MX", { timeZone: zona, day: "numeric", month: "short" }).format(d).replace(".", "");
  return `${fecha}, ${hora}`;
}
