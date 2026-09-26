import type { Vivo } from "./forma";
import { edadAlDia } from "./lectura-de-la-guardada";

/**
 * **Lo último que se supo de una ruta, visto desde ahorita** — para el Mapa sin
 * señal (auditoría a1, 25-sep).
 *
 * Con la consulta caída, `useEnVivo` se queda con la última respuesta. El Mapa
 * la seguía pintando tal cual: Cami encendido, «hace 1 min» en su etiqueta y en
 * su hoja aunque la red llevara diez minutos caída. Inicio ya lo resolvió en el
 * #610; esto hace lo mismo en la fuente, para que todo lo que el Mapa dibuja
 * (Cami, su hoja, la vista «Paradas» y la hoja de parada) lo herede junto:
 *
 * - **La edad sigue creciendo** con el reloj del teléfono (`edadAlDia`).
 * - **Ninguna unidad es fresca.** Sin señal no se habla en presente: Cami se
 *   apaga como dato viejo (lámina 2-mapa/08) y las filas van en pasado.
 *
 * Con señal devuelve el mismo objeto, sin tocarlo.
 */
export function vivoAlDia(vivo: Vivo, sinSenal: boolean, recibidoEn: number | null, ahora: number): Vivo {
  if (!sinSenal) return vivo;
  return {
    ...vivo,
    unidades: vivo.unidades.map((u) => ({
      ...u,
      antiguedad_seg: edadAlDia(u.antiguedad_seg, recibidoEn, ahora),
      fresco: false,
    })),
  };
}
