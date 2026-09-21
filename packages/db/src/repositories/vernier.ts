import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import type { Database } from "../index.js";
import {
  accounts,
  carrierAportaciones,
  complianceFactHistory,
  complianceFacts,
  evidencePoints,
  geofences,
  ledgerEntries,
  markets,
  routeShifts,
  routes,
  serviceContracts,
  serviceOccurrences,
  serviceProfiles,
  serviceProfileUnits,
  shifts,
  units,
} from "../schema/index.js";
import { SEALING_LEDGER_ACTIONS } from "../ledger-pairing.js";

/**
 * Las lecturas de Vernier V1 — el cuarto «Servicios especiales» y su acta.
 *
 * **Esta clase sólo lee.** No hay un solo `insert`, `update` ni `delete` aquí,
 * y la prueba del cargador (`servicios-especiales.test.ts` en `@jtel/services`)
 * lo vigila: abrir el acta no escribe ni recalcula nada (ficha §6, prueba 7).
 *
 * **El muro de cuenta va en cada consulta.** Toda lectura une la ocurrencia con
 * su contrato y exige `carrier_account_id` = la cuenta del cuarto. Una
 * ocurrencia de otra cuenta no existe desde aquí: no devuelve fila, así que no
 * hay camino por el que la pantalla se entere de que existe (Pieza 1.C, ley 3).
 *
 * **Sólo modalidad especial, por la forma de los datos.** Lee ocurrencias de
 * contrato; los circuitos de transporte público viven en su propia tabla y
 * nunca producen una ocurrencia (Marco, Pieza 7). Por eso ningún filtro de
 * modalidad aparece aquí: no hay nada que filtrar, y un filtro que no filtra
 * nada es un adorno que alguien va a creer que protege.
 */

/** Los pasos del ledger que el motivo necesita, ya extraídos en la base. */
export type PasosDelSello = {
  action: string;
  createdAt: Date;
  evidenciaIndisponible: boolean;
  decision: { result?: unknown; details?: unknown } | null;
  cobertura: { result?: unknown; details?: unknown } | null;
};

export class VernierRepository {
  constructor(private db: Database) {}

  /**
   * Los contratos de la cuenta que no son borrador, con la zona de su
   * política. Son los que encienden el cuarto (mapa, regla 4) y los que dan
   * chips de contrato (ficha §2: la fila sólo existe con más de uno).
   */
  async contratosDeCarrier(carrierAccountId: string) {
    return this.db
      .select({
        id: serviceContracts.id,
        nombre: serviceContracts.name,
        zona: sql<string | null>`${serviceContracts.policy} ->> 'timeZone'`,
      })
      .from(serviceContracts)
      .where(and(eq(serviceContracts.carrierAccountId, carrierAccountId), ne(serviceContracts.status, "draft")))
      .orderBy(asc(serviceContracts.name), asc(serviceContracts.createdAt));
  }

  /** La zona del mercado de la cuenta, o `null` si la cuenta todavía no tiene mercado. */
  async zonaDelMercado(carrierAccountId: string): Promise<string | null> {
    const [fila] = await this.db
      .select({ zona: markets.timeZone })
      .from(accounts)
      .innerJoin(markets, eq(markets.id, accounts.marketId))
      .where(eq(accounts.id, carrierAccountId))
      .limit(1);
    return fila?.zona ?? null;
  }

  /**
   * Las ocurrencias **con hecho** de la cuenta cuya llegada exigida cae en la
   * ventana. Una ocurrencia sin hecho no es un veredicto y no entra (Marco §D,
   * caso 2: «sin verificar» junto a los tres se lee como un cuarto veredicto).
   */
  async ocurrenciasSelladas(carrierAccountId: string, desde: Date, hasta: Date) {
    return this.db
      .select({
        ocurrenciaId: serviceOccurrences.id,
        fecha: serviceOccurrences.serviceDate,
        contratoId: serviceContracts.id,
        contrato: serviceContracts.name,
        ruta: routes.name,
        turnoId: shifts.id,
        turno: shifts.name,
        veredicto: complianceFacts.status,
        timing: complianceFacts.timing,
        llegada: complianceFacts.observedArrivalAt,
        llegadaExigida: complianceFacts.expectedDeadline,
        tolerancia: sql<unknown>`${complianceFacts.contractPolicySnapshot} -> 'toleranceMinutes'`,
        tardeExcusable: complianceFacts.lateExcusable,
        motivoExcusable: complianceFacts.excusableReason,
        unidadObservada: units.label,
        selladoAt: complianceFacts.materializedAt,
        resellado: sql<boolean>`EXISTS (SELECT 1 FROM ${complianceFactHistory} h WHERE h.service_occurrence_id = ${serviceOccurrences.id})`,
      })
      .from(complianceFacts)
      .innerJoin(serviceOccurrences, eq(serviceOccurrences.id, complianceFacts.serviceOccurrenceId))
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .innerJoin(routeShifts, eq(routeShifts.id, serviceOccurrences.routeShiftId))
      .innerJoin(routes, eq(routes.id, routeShifts.routeId))
      .innerJoin(shifts, eq(shifts.id, routeShifts.shiftId))
      .leftJoin(units, eq(units.id, complianceFacts.observedUnitId))
      .where(
        and(
          eq(serviceContracts.carrierAccountId, carrierAccountId),
          gte(complianceFacts.expectedDeadline, desde),
          lte(complianceFacts.expectedDeadline, hasta),
        ),
      )
      .orderBy(desc(serviceOccurrences.serviceDate), asc(complianceFacts.expectedDeadline));
  }

  /**
   * Los pasos del ledger que pueden ser del sello vigente de cada ocurrencia.
   *
   * Sólo las acciones que sellan, y sólo lo que el motivo lee —la decisión, la
   * cobertura, si hubo evidencia—, extraído en la base: los pasos completos
   * traen cada candidata evaluada y pesan demasiado para una lista de un mes.
   * Quién es exactamente del sello vigente lo decide `pairLedgerEntryWithFact`.
   */
  async pasosDelSello(ocurrenciaIds: string[]): Promise<Map<string, PasosDelSello[]>> {
    const porOcurrencia = new Map<string, PasosDelSello[]>();
    if (ocurrenciaIds.length === 0) return porOcurrencia;
    const filas = await this.db
      .select({
        ocurrenciaId: ledgerEntries.serviceOccurrenceId,
        action: ledgerEntries.action,
        createdAt: ledgerEntries.createdAt,
        evidenciaIndisponible: sql<boolean>`EXISTS (SELECT 1 FROM jsonb_array_elements(${ledgerEntries.steps}) s WHERE s->>'step' = 'evidencia' AND s->>'result' = 'indisponible')`,
        decision: sql<PasosDelSello["decision"]>`(SELECT s FROM jsonb_array_elements(${ledgerEntries.steps}) s WHERE s->>'step' = 'decision' LIMIT 1)`,
        cobertura: sql<PasosDelSello["cobertura"]>`(SELECT s FROM jsonb_array_elements(${ledgerEntries.steps}) s WHERE s->>'step' = 'cobertura_evidencia' LIMIT 1)`,
      })
      .from(ledgerEntries)
      .where(
        and(
          inArray(ledgerEntries.serviceOccurrenceId, ocurrenciaIds),
          inArray(ledgerEntries.action, [...SEALING_LEDGER_ACTIONS]),
        ),
      );
    for (const f of filas) {
      const lista = porOcurrencia.get(f.ocurrenciaId) ?? [];
      lista.push({
        action: f.action,
        createdAt: f.createdAt,
        evidenciaIndisponible: f.evidenciaIndisponible,
        decision: f.decision,
        cobertura: f.cobertura,
      });
      porOcurrencia.set(f.ocurrenciaId, lista);
    }
    return porOcurrencia;
  }

  /**
   * Una ocurrencia con su hecho, **sólo si es de esta cuenta**. Es la cabeza
   * del acta; lo demás del acta cuelga de lo que esto devuelva.
   */
  async ocurrenciaDelActa(carrierAccountId: string, ocurrenciaId: string) {
    const [fila] = await this.db
      .select({
        ocurrenciaId: serviceOccurrences.id,
        fecha: serviceOccurrences.serviceDate,
        contratoId: serviceContracts.id,
        contrato: serviceContracts.name,
        perfilId: serviceProfiles.id,
        perfil: serviceProfiles.name,
        perfilCodigo: serviceProfiles.code,
        ruta: routes.name,
        turnoId: shifts.id,
        turno: shifts.name,
        veredicto: complianceFacts.status,
        timing: complianceFacts.timing,
        llegada: complianceFacts.observedArrivalAt,
        llegadaExigida: complianceFacts.expectedDeadline,
        tolerancia: sql<unknown>`${complianceFacts.contractPolicySnapshot} -> 'toleranceMinutes'`,
        tardeExcusable: complianceFacts.lateExcusable,
        motivoExcusable: complianceFacts.excusableReason,
        unidadObservadaId: complianceFacts.observedUnitId,
        unidadObservada: units.label,
        selladoAt: complianceFacts.materializedAt,
        tripId: complianceFacts.tripId,
        destinoId: complianceFacts.expectedGeofenceId,
      })
      .from(complianceFacts)
      .innerJoin(serviceOccurrences, eq(serviceOccurrences.id, complianceFacts.serviceOccurrenceId))
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .innerJoin(serviceProfiles, eq(serviceProfiles.id, serviceOccurrences.serviceProfileId))
      .innerJoin(routeShifts, eq(routeShifts.id, serviceOccurrences.routeShiftId))
      .innerJoin(routes, eq(routes.id, routeShifts.routeId))
      .innerJoin(shifts, eq(shifts.id, routeShifts.shiftId))
      .leftJoin(units, eq(units.id, complianceFacts.observedUnitId))
      .where(and(eq(serviceOccurrences.id, ocurrenciaId), eq(serviceContracts.carrierAccountId, carrierAccountId)))
      .limit(1);
    return fila ?? null;
  }

  /**
   * Las unidades posibles del perfil **hoy**. No se congelan con el hecho
   * (pendiente con nombre, decisión de motor): por eso la pantalla las rotula
   * «según el perfil hoy».
   */
  async unidadesPosiblesDelPerfil(perfilId: string) {
    return this.db
      .select({ id: units.id, etiqueta: units.label })
      .from(serviceProfileUnits)
      .innerJoin(units, eq(units.id, serviceProfileUnits.unitId))
      .where(eq(serviceProfileUnits.serviceProfileId, perfilId))
      .orderBy(asc(units.label));
  }

  /** Cuándo se reemplazó cada sello anterior de la ocurrencia. Vacío = nunca se re-selló. */
  async resellosDeOcurrencia(ocurrenciaId: string) {
    return this.db
      .select({ reemplazadoAt: complianceFactHistory.replacedAt })
      .from(complianceFactHistory)
      .where(eq(complianceFactHistory.serviceOccurrenceId, ocurrenciaId))
      .orderBy(asc(complianceFactHistory.replacedAt));
  }

  /** Las entradas del ledger que pueden ser del sello vigente, con sus pasos completos. */
  async entradasQueSellan(ocurrenciaId: string) {
    return this.db
      .select({ action: ledgerEntries.action, createdAt: ledgerEntries.createdAt, steps: ledgerEntries.steps })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.serviceOccurrenceId, ocurrenciaId),
          inArray(ledgerEntries.action, [...SEALING_LEDGER_ACTIONS]),
        ),
      );
  }

  /**
   * Los puntos de evidencia **de la unidad observada** en el viaje del hecho —
   * los mismos con los que juzgó el motor, no telemetría leída de nuevo.
   * Sin unidad observada no se llama: ninguna traza es de esa ocurrencia.
   */
  async puntosDeLaUnidadObservada(tripId: string, unidadId: string) {
    return this.db
      .select({
        lat: evidencePoints.latitude,
        lng: evidencePoints.longitude,
        speed: evidencePoints.speed,
        at: evidencePoints.recordedAt,
      })
      .from(evidencePoints)
      .where(and(eq(evidencePoints.tripId, tripId), eq(evidencePoints.unitId, unidadId)))
      .orderBy(asc(evidencePoints.recordedAt));
  }

  /** La geocerca de destino que el hecho congeló, para dibujarla bajo la traza. */
  async geocercaDeDestino(geofenceId: string) {
    const [fila] = await this.db
      .select({ id: geofences.id, nombre: geofences.name, poligono: geofences.polygon })
      .from(geofences)
      .where(eq(geofences.id, geofenceId))
      .limit(1);
    return fila ?? null;
  }

  /**
   * Las unidades del transportista, para declarar cuál dio un servicio que el
   * sello no acreditó (ficha de huecos, PR 1). Las mismas que ofrecía la
   * pantalla vieja: toda su flota, activas o no — la del servicio de hace un
   * mes puede estar hoy fuera de servicio. La ruta que escribe lo vuelve a
   * comprobar contra la cuenta.
   */
  async unidadesDelTransportista(carrierAccountId: string) {
    return this.db
      .select({ id: units.id, etiqueta: units.label, placa: units.plateNumber })
      .from(units)
      .where(eq(units.carrierAccountId, carrierAccountId))
      .orderBy(asc(units.label));
  }

  /**
   * Lo que el transportista aportó sobre la ocurrencia (`carrier_aportaciones`).
   * Esta clase sólo lee; la escritura es `POST /api/carrier/aportaciones`, la
   * misma de la pantalla vieja.
   *
   * `unidadDeclarada` es la etiqueta de la unidad que el transportista DECLARÓ,
   * y viaja con ese nombre a propósito: **esperado y observado nunca se
   * mezclan** (Pieza 1.C), y la observada vive en el hecho, no aquí. El join
   * lleva la cuenta: una unidad que ya no es de este transportista no se nombra.
   */
  async aportacionesDeOcurrencia(carrierAccountId: string, ocurrenciaId: string) {
    return this.db
      .select({
        id: carrierAportaciones.id,
        motivo: carrierAportaciones.motivo,
        nota: carrierAportaciones.nota,
        estado: carrierAportaciones.estado,
        creadaAt: carrierAportaciones.createdAt,
        unidadDeclarada: units.label,
      })
      .from(carrierAportaciones)
      .leftJoin(
        units,
        and(eq(units.id, carrierAportaciones.declaredUnitId), eq(units.carrierAccountId, carrierAccountId)),
      )
      .where(
        and(
          eq(carrierAportaciones.serviceOccurrenceId, ocurrenciaId),
          eq(carrierAportaciones.carrierAccountId, carrierAccountId),
        ),
      )
      .orderBy(desc(carrierAportaciones.createdAt));
  }
}
