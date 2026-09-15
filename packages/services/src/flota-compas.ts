import type { Repositories } from "@jtel/db";
import { clasificarFlota, type FlotaClasificada } from "@jtel/domain";

/**
 * Lee de la base lo que la clasificación de la flota necesita, y la clasifica.
 *
 * La lógica vive en `@jtel/domain` (`clasificarFlota`) y es pura; esto sólo
 * junta las filas. Existe antes que la pantalla: la pantalla sale del rediseño y
 * va a leer de aquí.
 *
 * **Lo que NO se lee todavía, a propósito: las llegadas selladas.** «En destino»
 * sale de la llegada que ya selló el árbitro, pero falta decidir hasta cuándo
 * sigue vigente una llegada. Hasta entonces no se pasa ninguna y ninguna unidad
 * sale «en destino». Ver `EntradaDeUnidad.llegadaVigenteAt`.
 */
export interface FlotaCompas extends FlotaClasificada {
  /** Sin contrato, el grupo EN DESTINO no existe (`gruposDeUnidad`). */
  tieneContrato: boolean;
  /**
   * Las unidades marcadas inactivas no entran a la flota: no están en
   * operación. Se cuentan para que no desaparezcan en silencio.
   */
  unidadesInactivas: number;
}

export async function cargarFlotaCompas(
  repos: Pick<Repositories, "fleet" | "livePositions" | "telemetry" | "contracts">,
  carrierAccountId: string,
  ahora: Date,
): Promise<FlotaCompas> {
  const [unidades, dispositivos, asignaciones, posicionesVivas, contratos] = await Promise.all([
    repos.fleet.getUnitsForCarrier(carrierAccountId),
    repos.fleet.getDevicesForCarrier(carrierAccountId),
    repos.fleet.getActiveAssignmentsForCarrier(carrierAccountId),
    repos.livePositions.listForCarrier(carrierAccountId),
    repos.contracts.findForCarrier(carrierAccountId),
  ]);
  const ultimoArchivadoPorImei = await repos.telemetry.ultimoPuntoPorImei(
    dispositivos.map((d) => d.imei),
  );

  const activas = unidades.filter((u) => u.active);
  const flota = clasificarFlota({
    ahora,
    unidades: activas.map((u) => ({ id: u.id, label: u.label })),
    dispositivos: dispositivos.map((d) => ({
      id: d.id,
      imei: d.imei,
      label: d.label,
      retiredAt: d.retiredAt,
      retiredReason: d.retiredReason,
    })),
    asignaciones: asignaciones.map((a) => ({
      unitId: a.unitId,
      deviceId: a.deviceId,
      validFrom: a.validFrom,
      validTo: a.validTo,
    })),
    posicionesVivas: posicionesVivas.map((p) => ({
      imei: p.imei,
      recordedAt: p.recordedAt,
      speed: p.speed,
      heading: p.heading,
    })),
    ultimoArchivadoPorImei,
  });

  return {
    ...flota,
    tieneContrato: contratos.length > 0,
    unidadesInactivas: unidades.length - activas.length,
  };
}
