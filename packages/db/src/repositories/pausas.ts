import { and, asc, count, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";
import {
  caeEnPausa,
  intervalosDePausa,
  pausaVigente,
  type EventoDeVerificacion,
} from "@jtel/domain";
import type { Database } from "../index.js";
import {
  accounts,
  carrierAportaciones,
  complianceFactHistory,
  complianceFacts,
  contractVerificationEvents,
  ledgerEntries,
  occurrenceGroundTruth,
  plants,
  plantGroups,
  serviceContracts,
  serviceOccurrences,
} from "../schema/index.js";

/**
 * La pausa de la verificación de un contrato (0041, 19 sep 2026).
 *
 * Aquí viven las dos mitades que tocan la base: leer y escribir los eventos, y
 * la pregunta que el motor le hace a cada ocurrencia antes de sellarla. La
 * lógica —qué intervalos hay, qué cae en pausa, qué se permite— es de
 * `@jtel/domain` (`pausa.ts`), para que el motor y la pantalla respondan con la
 * misma regla.
 */

export type ActorDePausa = { kind: string; id: string | null };

/**
 * ¿La verificación de esta ocurrencia está fuera por una pausa? En SQL, para la
 * cola del motor: se excluye antes de cargar, como las cuentas de ejemplo.
 *
 * Dos razones, la misma que el dominio:
 *   (a) su llegada exigida cae en una pausa del contrato — nunca se sella;
 *   (b) el contrato está en pausa ahora — no se sella nada de él, tampoco los
 *       pendientes viejos que el cron reintentaría. Al reanudar, vuelven solos.
 *
 * «Está en pausa en tal instante» = el último evento que ya valía en ese
 * instante es una pausa. La base garantiza que los eventos se alternan.
 */
export function fueraPorPausa(ahora: Date): SQL {
  // El coalesce no es adorno: un contrato sin eventos da NULL, y
  // `NOT (NULL OR NULL)` es NULL — sin él, ningún contrato sin pausa entraba a
  // la cola. Lo cazó `pausa.integration.test.ts`, la prueba contra la base.
  const ultimoEventoAl = (instante: SQL) => sql`coalesce((
    SELECT e.tipo FROM ${contractVerificationEvents} e
     WHERE e.contract_id = ${serviceOccurrences.contractId} AND e.vale_desde <= ${instante}
     ORDER BY e.vale_desde DESC, e.registrado_at DESC LIMIT 1), '')`;
  return sql`(${ultimoEventoAl(sql`${serviceOccurrences.expectedDeadline}`)} = 'pausa' OR ${ultimoEventoAl(
    sql`${ahora.toISOString()}::timestamptz`,
  )} = 'pausa')`;
}

export class PausasRepository {
  constructor(private db: Database) {}

  async eventosDe(contractId: string): Promise<EventoDeVerificacion[]> {
    const filas = await this.db
      .select()
      .from(contractVerificationEvents)
      .where(eq(contractVerificationEvents.contractId, contractId))
      .orderBy(asc(contractVerificationEvents.valeDesde), asc(contractVerificationEvents.registradoAt));
    return filas.map((f) => ({ tipo: f.tipo, valeDesde: f.valeDesde, motivo: f.motivo, registradoAt: f.registradoAt }));
  }

  /** Los eventos con su autor, para la historia en Ver ‹contrato›. */
  async historiaDe(contractId: string) {
    return this.db
      .select()
      .from(contractVerificationEvents)
      .where(eq(contractVerificationEvents.contractId, contractId))
      .orderBy(asc(contractVerificationEvents.valeDesde), asc(contractVerificationEvents.registradoAt));
  }

  async eventosDeContratos(contractIds: string[]): Promise<Map<string, EventoDeVerificacion[]>> {
    const porContrato = new Map<string, EventoDeVerificacion[]>();
    if (contractIds.length === 0) return porContrato;
    const filas = await this.db
      .select()
      .from(contractVerificationEvents)
      .where(inArray(contractVerificationEvents.contractId, contractIds))
      .orderBy(asc(contractVerificationEvents.valeDesde), asc(contractVerificationEvents.registradoAt));
    for (const f of filas) {
      const lista = porContrato.get(f.contractId) ?? [];
      lista.push({ tipo: f.tipo, valeDesde: f.valeDesde, motivo: f.motivo, registradoAt: f.registradoAt });
      porContrato.set(f.contractId, lista);
    }
    return porContrato;
  }

  /**
   * Por qué el motor no sella esta ocurrencia, o `null` si sí puede.
   * La misma pregunta que `fueraPorPausa`, para la llave de `verifyOccurrence`.
   */
  async motivoDePausa(
    contractId: string,
    llegadaExigida: Date,
    ahora: Date,
  ): Promise<"ocurrencia_en_pausa" | "contrato_en_pausa" | null> {
    const intervalos = intervalosDePausa(await this.eventosDe(contractId));
    if (caeEnPausa(intervalos, llegadaExigida)) return "ocurrencia_en_pausa";
    if (pausaVigente(intervalos, ahora)) return "contrato_en_pausa";
    return null;
  }

  /**
   * Las ocurrencias SIN hecho del contrato cuya llegada exigida es de
   * `valeDesde` en adelante — las que la pausa borra (decisión 1 de Asav:
   * nunca fueron un hecho; borrar una ficción no reescribe historia, 6.15).
   *
   * Se quedan, aunque no tengan hecho, las que traen algo que sí es historia:
   * un sello anterior archivado, la versión del transportista, la etiqueta de
   * un operador. No se sellan (caen en la pausa), pero no se borran: la pausa
   * no se lleva lo que alguien dijo.
   */
  private ocurrenciasQueSeBorran(contractId: string, valeDesde: Date) {
    const sinNada = (tabla: SQL) => sql`NOT EXISTS (${tabla})`;
    return and(
      eq(serviceOccurrences.contractId, contractId),
      gte(serviceOccurrences.expectedDeadline, valeDesde),
      isNull(complianceFacts.id),
      sinNada(sql`SELECT 1 FROM ${complianceFactHistory} h WHERE h.service_occurrence_id = ${serviceOccurrences.id}`),
      sinNada(sql`SELECT 1 FROM ${carrierAportaciones} a WHERE a.service_occurrence_id = ${serviceOccurrences.id}`),
      sinNada(sql`SELECT 1 FROM ${occurrenceGroundTruth} g WHERE g.occurrence_id = ${serviceOccurrences.id}`),
    );
  }

  /**
   * Lo que haría la pausa, antes de hacerlo: cuántas ocurrencias se borran,
   * cuántas se quedan sin sellar, cuántos hechos no se tocan y cuántos
   * pendientes viejos se congelan. Nada se escribe hasta confirmar.
   */
  async vistaPrevia(contractId: string, valeDesde: Date) {
    const [borrar] = await this.db
      .select({ n: count() })
      .from(serviceOccurrences)
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(this.ocurrenciasQueSeBorran(contractId, valeDesde));
    const [sinHecho] = await this.db
      .select({ n: count() })
      .from(serviceOccurrences)
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(
        and(
          eq(serviceOccurrences.contractId, contractId),
          gte(serviceOccurrences.expectedDeadline, valeDesde),
          isNull(complianceFacts.id),
        ),
      );
    const [sellados] = await this.db
      .select({ n: count() })
      .from(complianceFacts)
      .innerJoin(serviceOccurrences, eq(serviceOccurrences.id, complianceFacts.serviceOccurrenceId))
      .where(and(eq(serviceOccurrences.contractId, contractId), gte(serviceOccurrences.expectedDeadline, valeDesde)));
    const [pendientes] = await this.db
      .select({ n: count() })
      .from(complianceFacts)
      .innerJoin(serviceOccurrences, eq(serviceOccurrences.id, complianceFacts.serviceOccurrenceId))
      .where(
        and(
          eq(serviceOccurrences.contractId, contractId),
          eq(complianceFacts.status, "pendiente_evidencia"),
          sql`${serviceOccurrences.expectedDeadline} < ${valeDesde.toISOString()}::timestamptz`,
        ),
      );
    const [entradas] = await this.db
      .select({ n: count() })
      .from(ledgerEntries)
      .innerJoin(serviceOccurrences, eq(serviceOccurrences.id, ledgerEntries.serviceOccurrenceId))
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(this.ocurrenciasQueSeBorran(contractId, valeDesde));
    const seBorran = Number(borrar?.n ?? 0);
    return {
      /** Ocurrencias sin hecho que se borran. */
      seBorran,
      /** Sin hecho, pero con historia: no se borran y no se sellan. */
      seQuedanSinSellar: Number(sinHecho?.n ?? 0) - seBorran,
      /** Hechos ya sellados dentro de la pausa: no se tocan. */
      selladosNoSeTocan: Number(sellados?.n ?? 0),
      /** Pendientes de antes de la pausa que el cron ya no reintenta mientras dure. */
      pendientesSeCongelan: Number(pendientes?.n ?? 0),
      /** Entradas del ledger de intentos sobre las ocurrencias que se borran: se van con ellas. */
      entradasDelLedgerSeVan: Number(entradas?.n ?? 0),
    };
  }

  /**
   * Pausar: el evento y el borrado, en una sola transacción. Si el evento no
   * pasa (la base revisa la secuencia), no se borra nada.
   */
  async pausar(contractId: string, entrada: { valeDesde: Date; motivo: string; actor: ActorDePausa }) {
    return this.db.transaction(async (tx) => {
      await tx.insert(contractVerificationEvents).values({
        contractId,
        tipo: "pausa",
        valeDesde: entrada.valeDesde,
        motivo: entrada.motivo,
        actorKind: entrada.actor.kind,
        actorId: entrada.actor.id,
      });
      const ids = await tx
        .select({ id: serviceOccurrences.id })
        .from(serviceOccurrences)
        .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
        .where(this.ocurrenciasQueSeBorran(contractId, entrada.valeDesde));
      let borradas = 0;
      for (let i = 0; i < ids.length; i += 500) {
        const lote = ids.slice(i, i + 500).map((r) => r.id);
        const fuera = await tx.delete(serviceOccurrences).where(inArray(serviceOccurrences.id, lote)).returning({ id: serviceOccurrences.id });
        borradas += fuera.length;
      }
      return { borradas };
    });
  }

  /** Reanudar vale desde que se registra: lo no medido durante la pausa no se genera hacia atrás. */
  async reanudar(contractId: string, actor: ActorDePausa, ahora: Date) {
    await this.db.insert(contractVerificationEvents).values({
      contractId,
      tipo: "reanudacion",
      valeDesde: ahora,
      motivo: null,
      actorKind: actor.kind,
      actorId: actor.id,
    });
  }

  /** Los campos de un contrato para J-Staff: con quién es, y su estado comercial aparte. */
  private camposDeContrato() {
    return {
      id: serviceContracts.id,
      nombre: serviceContracts.name,
      estadoComercial: serviceContracts.status,
      zona: sql<string | null>`${serviceContracts.policy} ->> 'timeZone'`,
      transportista: sql<string>`(SELECT name FROM ${accounts} WHERE id = ${serviceContracts.carrierAccountId})`,
      cliente: sql<string>`(SELECT name FROM ${accounts} WHERE id = ${serviceContracts.clientAccountId})`,
      planta: sql<string | null>`coalesce(${plants.name}, ${plantGroups.name})`,
      vigenteDesde: serviceContracts.validFrom,
      vigenteHasta: serviceContracts.validTo,
    };
  }

  /** Todos los contratos de la plataforma, para «Contratos» de J-Staff. */
  async contratosDeLaPlataforma() {
    const filas = await this.db
      .select(this.camposDeContrato())
      .from(serviceContracts)
      .leftJoin(plants, eq(plants.id, serviceContracts.plantId))
      .leftJoin(plantGroups, eq(plantGroups.id, serviceContracts.plantGroupId));
    return filas.sort((a, b) => a.transportista.localeCompare(b.transportista, "es") || a.nombre.localeCompare(b.nombre, "es"));
  }

  async contrato(contractId: string) {
    const [fila] = await this.db
      .select(this.camposDeContrato())
      .from(serviceContracts)
      .leftJoin(plants, eq(plants.id, serviceContracts.plantId))
      .leftJoin(plantGroups, eq(plantGroups.id, serviceContracts.plantGroupId))
      .where(eq(serviceContracts.id, contractId))
      .limit(1);
    return fila ?? null;
  }
}
