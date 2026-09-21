import { promesaAhora, type FranjaCapturada, type PromesaAhora } from "@jtel/domain";
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
  return (await promesaConSusFronteras(circuitId, ahora, zona)).promesa;
}

/**
 * La promesa de ahora **y las horas en que puede cambiar** (el inicio y el fin
 * de cada franja). Las pide la portada, que se arma una vez y tiene que saber
 * hasta cuándo vale lo que dice (`proximaFronteraDeLoPublicado`).
 */
export async function promesaConSusFronteras(
  circuitId: string,
  ahora: Date,
  zona: string,
): Promise<{ promesa: PromesaAhora; horas: string[] }> {
  const vigente = await getRepos().circuits.getPromiseTableVigente(circuitId);
  const franjas: FranjaCapturada[] | null = vigente
    ? vigente.bandas.map((b) => ({
        diaTipo: b.diaTipo,
        sentido: b.sentido,
        desdeLocal: b.desdeLocal,
        hastaLocal: b.hastaLocal,
        frequencyMinutes: b.frequencyMinutes,
      }))
    : null;
  return {
    promesa: promesaAhora(franjas, ahora, zona),
    horas: (franjas ?? []).flatMap((f) => [f.desdeLocal, f.hastaLocal]),
  };
}
