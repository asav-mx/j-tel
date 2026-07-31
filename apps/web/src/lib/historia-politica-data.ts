/**
 * La historia de la política de un contrato — la parte que toca la base.
 *
 * La lectura vive en `politica-diff.ts` y se prueba sin base de datos.
 *
 * Solo lectura. Nada de aquí alimenta al motor: cada hecho ya congeló su
 * propia foto de política al verificarse, y esta pantalla no la toca ni la
 * recalcula. Es el registro de ediciones hacia adelante y nada más.
 *
 * La pertenencia al cliente se verifica aquí y no en la vista: un contrato de
 * otro cliente devuelve `null` y la página responde 404.
 */

import { contractPolicySchema, type ContractPolicy } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { leerHistoria, vigenteCoincide, type EdicionLeida } from "@/lib/politica-diff";

export type HistoriaDePolitica = {
  contrato: {
    id: string;
    nombre: string;
    politicaVigente: ContractPolicy;
    /** Cuándo se tocó el contrato por última vez, según la propia fila. */
    actualizadoEn: Date;
    creadoEn: Date;
  };
  ediciones: EdicionLeida[];
  /**
   * La política vigente NO es la que dejó la última edición registrada.
   * Significa que alguien la escribió por fuera del registro.
   */
  vigenteSinRegistro: boolean;
  /**
   * Qué decía la política cuando arrancó el registro — el `policyBefore` de la
   * edición más antigua.
   *
   * Se sabe QUÉ decía, pero no desde cuándo ni quién la dejó así: las
   * ediciones anteriores a esta tabla se sobrescribían. Se expone para que la
   * pantalla pueda decirlo en vez de dejar la historia arrancando en el aire.
   * `null` cuando el contrato no se ha editado desde que existe el registro.
   */
  puntoDePartida: ContractPolicy | null;
};

export async function cargarHistoriaDePolitica(entrada: {
  clientAccountId: string;
  contractId: string;
}): Promise<HistoriaDePolitica | null> {
  const repos = getRepos();
  const contrato = await repos.contracts.findById(entrada.contractId);
  if (!contrato || contrato.clientAccountId !== entrada.clientAccountId) return null;

  const crudas = await repos.contracts.getPolicyHistory(entrada.contractId);

  /*
   * La política vigente se lee CON los defaults del esquema aplicados, igual
   * que en la oficina: un contrato anterior a una perilla no trae esa llave,
   * pero el motor la resuelve con su default, así que ese default es el valor
   * vigente. Sin esto, comparar contra la última edición marcaría un hueco en
   * la cadena que no existe.
   */
  const parsed = contractPolicySchema.safeParse(contrato.policy);
  const politicaVigente: ContractPolicy = parsed.success ? parsed.data : contrato.policy;

  const ediciones = leerHistoria(
    crudas.map((e) => ({
      id: e.id,
      policyBefore: e.policyBefore,
      policyAfter: e.policyAfter,
      actorKind: e.actorKind,
      actorId: e.actorId,
      note: e.note,
      changedAt: e.changedAt,
    })),
  );

  return {
    contrato: {
      id: contrato.id,
      nombre: contrato.name,
      politicaVigente,
      actualizadoEn: contrato.updatedAt,
      creadoEn: contrato.createdAt,
    },
    ediciones,
    // Se comparan las dos EFECTIVAS. `policyAfter` se guarda ya resuelto con
    // los defaults del esquema, así que enfrentarlo contra la vigente cruda
    // marcaría como hueco cada llave que el esquema rellena — un aviso que
    // salta siempre se aprende a ignorar, y este tiene que significar algo.
    vigenteSinRegistro: !vigenteCoincide(politicaVigente, crudas[0]),
    puntoDePartida:
      crudas.length > 0 ? (crudas[crudas.length - 1]!.policyBefore as ContractPolicy) : null,
  };
}
