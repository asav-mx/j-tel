import { promesaAhora, type PromesaAhora } from "@jtel/domain";
import { getRepos } from "@/lib/db";

/**
 * La promesa que se le dice al pasajero **ahora**, de la única fuente de la
 * promesa: las franjas vigentes del circuito (decisión de Asav, 21 sep 2026).
 * `declared_frequency_minutes` ya no se lee — una valla lo vigila.
 *
 * Sólo servidor. Viaja en la respuesta de unidades (que se pide cada quince
 * segundos) y en la portada, **nunca en la forma**: la forma vive una hora en
 * caché, y una promesa de hace una hora es la de otra franja.
 */
export async function promesaDelCircuito(circuitId: string, ahora: Date, zona: string): Promise<PromesaAhora> {
  const vigente = await getRepos().circuits.getPromiseTableVigente(circuitId);
  return promesaAhora(
    vigente
      ? vigente.bandas.map((b) => ({
          diaTipo: b.diaTipo,
          sentido: b.sentido,
          desdeLocal: b.desdeLocal,
          hastaLocal: b.hastaLocal,
          frequencyMinutes: b.frequencyMinutes,
        }))
      : null,
    ahora,
    zona,
  );
}
