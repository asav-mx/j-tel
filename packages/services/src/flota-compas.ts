import type { Repositories } from "@jtel/db";
import { clasificarFlota, type FlotaClasificada } from "@jtel/domain";

/**
 * Lee de la base lo que la clasificación de la flota necesita, y la clasifica.
 *
 * La lógica vive en `@jtel/domain` (`clasificarFlota`) y es pura; esto sólo
 * junta las filas. Existe antes que la pantalla: la pantalla sale del rediseño y
 * va a leer de aquí.
 *
 * **No lee llegadas selladas, a propósito.** Una llegada sellada es historia de
 * la unidad, no su estado de ahora: el árbitro sella después del cierre. El «en
 * destino» de una lista viva llega con la detección en vivo, junto con el mapa.
 */
export interface FlotaCompas extends FlotaClasificada {
  /**
   * Las unidades marcadas inactivas no entran a la flota: no están en
   * operación. Se cuentan para que no desaparezcan en silencio.
   */
  unidadesInactivas: number;
}

export async function cargarFlotaCompas(
  repos: Pick<Repositories, "fleet" | "livePositions" | "telemetry">,
  carrierAccountId: string,
  ahora: Date,
): Promise<FlotaCompas> {
  const [unidades, dispositivos, asignaciones, posicionesVivas] = await Promise.all([
    repos.fleet.getUnitsForCarrier(carrierAccountId),
    repos.fleet.getDevicesForCarrier(carrierAccountId),
    repos.fleet.getActiveAssignmentsForCarrier(carrierAccountId),
    repos.livePositions.listForCarrier(carrierAccountId),
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
    unidadesInactivas: unidades.length - activas.length,
  };
}
