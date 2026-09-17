import type { Repositories } from "@jtel/db";
import {
  asignacionVigente,
  clasificarFlota,
  ordenarPorTiempo,
  type EnDestino,
  type FlotaClasificada,
  type PuntoTraza,
} from "@jtel/domain";
import { visitasALugares, type Lugar } from "./recorrido-del-dia.js";

/**
 * Lee de la base lo que la clasificación de la flota necesita, y la clasifica.
 *
 * La lógica vive en `@jtel/domain` (`clasificarFlota`) y es pura; esto junta
 * las filas y resuelve lo que el dominio no calcula: **si una unidad está en su
 * destino ahora** (C2 del cuarto de Compás).
 *
 * **No lee llegadas selladas, a propósito.** Una llegada sellada es historia de
 * la unidad, no su estado de ahora: el árbitro sella después del cierre. EN
 * DESTINO sale de la detección en vivo: servicio especial vigente (Marco 7.7) y
 * última posición dentro de un destino.
 *
 * ## El servicio vigente (Marco 7.7) — las cuatro reglas del 16 sep 2026
 *
 *   1. **Especial:** la unidad es posible en un perfil con una ocurrencia cuya
 *      ventana de evidencia (`trips`) incluye ahora.
 *      → `occurrences.especialesVigentesDeCarrier`
 *   2. **Circuito:** la unidad está asignada a un circuito **abierto** ahora.
 *      «Abierto» se lee del **horario de servicio del circuito** —activo, y ahora
 *      entre `service_start_local` y `service_end_local` en su `time_zone`—.
 *      **No de `circuit_opens`:** esa tabla cuenta cuántas veces se abre la app
 *      del pasajero, no si el circuito da servicio. (Se propuso por error y se
 *      corrigió el mismo día.)
 *   3. **Ninguno:** sin sello que proteger, no hay EN DESTINO ni corte.
 *   4. **Si caen las dos, manda especial:** es la que tiene sello.
 *
 * Aquí sólo hace falta la regla 1: EN DESTINO existe sólo en especial, así que
 * circuito y ninguno dan lo mismo en la lista. La regla 2 se construye cuando la
 * necesite el corte del recorrido (C3); no se adelanta sin quien la use.
 */
export interface FlotaCompas extends FlotaClasificada {
  /**
   * Las unidades marcadas inactivas no entran a la flota: no están en
   * operación. Se cuentan para que no desaparezcan en silencio.
   */
  unidadesInactivas: number;
}

/** Lo que Flota en vivo dibuja además de la clasificación. */
export interface FlotaEnVivo extends FlotaCompas {
  /** Las geocercas de la flota: propias y de las plantas de sus contratos. */
  lugares: Lugar[];
  /**
   * Dónde va cada unidad en el mapa: su última posición viva. La de una unidad
   * EN DESTINO es su **punto de llegada**, porque adentro no se mira. Sin
   * posición conocida no está en el mapa.
   */
  posicionPorUnidad: Map<string, { lat: number; lng: number }>;
}

type ReposDeFlota = Pick<Repositories, "fleet" | "livePositions" | "telemetry" | "occurrences" | "geofences">;

export async function cargarFlotaCompas(
  repos: ReposDeFlota,
  carrierAccountId: string,
  ahora: Date,
): Promise<FlotaCompas> {
  const { flota, unidadesInactivas } = await clasificarFlotaDeCuenta(repos, carrierAccountId, ahora, {
    incluirInactivas: false,
  });
  return { ...flota, unidadesInactivas };
}

/** Flota en vivo: la clasificación, los lugares y dónde va cada unidad. */
export async function cargarFlotaEnVivo(
  repos: ReposDeFlota,
  carrierAccountId: string,
  ahora: Date,
): Promise<FlotaEnVivo> {
  const r = await clasificarFlotaDeCuenta(repos, carrierAccountId, ahora, { incluirInactivas: false });
  return {
    ...r.flota,
    unidadesInactivas: r.unidadesInactivas,
    lugares: r.lugares,
    posicionPorUnidad: r.posicionPorUnidad,
  };
}

/**
 * ¿Está en un destino ahora? Sí, si su **último punto** cae dentro de un lugar
 * de rol destino.
 *
 * La hora es la entrada de esa estancia, con la misma regla del recorrido del
 * día (`visitasALugares`): primer punto medido adentro; si no se vio entrar,
 * `entradaObservada` falso. Así Flota en vivo y el recorrido no pueden dar dos
 * horas de llegada distintas.
 */
export function enDestinoAhora(
  puntos: PuntoTraza[],
  lugares: Lugar[],
): (EnDestino & { punto: { lat: number; lng: number } }) | null {
  const destinos = lugares.filter((l) => l.rol === "destino");
  if (puntos.length === 0 || destinos.length === 0) return null;
  const ordenados = ordenarPorTiempo(puntos);
  const ultimo = ordenados[ordenados.length - 1]!;
  const abiertas = visitasALugares(ordenados, destinos).filter(
    (v) => v.salida === null && v.ultimoAdentro.getTime() === ultimo.at.getTime(),
  );
  if (abiertas.length === 0) return null;
  // Con destinos encimados, la estancia que empezó más tarde es la más precisa.
  const v = abiertas[abiertas.length - 1]!;
  const llegada = ordenados.find((p) => p.at.getTime() === v.entrada.getTime())!;
  return {
    lugarId: v.lugar.id,
    lugarNombre: v.lugar.nombre,
    llegadaAt: v.entrada,
    entradaObservada: v.entradaObservada,
    punto: { lat: llegada.lat, lng: llegada.lng },
  };
}

/**
 * La misma lectura y la misma clasificación, con la opción de incluir las
 * unidades inactivas.
 *
 * La usa el expediente de una unidad: una unidad inactiva no está en la flota
 * de hoy, pero su expediente existe y su última señal es verdad. Que las dos
 * pantallas lean de aquí es lo que impide que Flota en vivo y el expediente
 * digan cosas distintas de la misma señal.
 */
export async function clasificarFlotaDeCuenta(
  repos: ReposDeFlota,
  carrierAccountId: string,
  ahora: Date,
  opciones: { incluirInactivas: boolean },
): Promise<{
  flota: FlotaClasificada;
  unidadesInactivas: number;
  lugares: Lugar[];
  posicionPorUnidad: Map<string, { lat: number; lng: number }>;
}> {
  const [unidades, dispositivos, asignaciones, posicionesVivas, especiales, filasDeLugares] =
    await Promise.all([
      repos.fleet.getUnitsForCarrier(carrierAccountId),
      repos.fleet.getDevicesForCarrier(carrierAccountId),
      repos.fleet.getActiveAssignmentsForCarrier(carrierAccountId),
      repos.livePositions.listForCarrier(carrierAccountId),
      repos.occurrences.especialesVigentesDeCarrier(carrierAccountId, ahora),
      repos.geofences.lugaresDeCarrier(carrierAccountId),
    ]);
  const ultimoArchivadoPorImei = await repos.telemetry.ultimoPuntoPorImei(
    dispositivos.map((d) => d.imei),
  );
  const lugares: Lugar[] = filasDeLugares.map((g) => ({
    id: g.id,
    nombre: g.name,
    rol: g.role,
    poligono: g.polygon,
  }));

  const imeiPorDispositivo = new Map(dispositivos.map((d) => [d.id, d.imei]));
  const vigentes = asignaciones.filter((a) => asignacionVigente(a, ahora));
  const imeisDeUnidad = (unitId: string) =>
    vigentes.filter((a) => a.unitId === unitId).flatMap((a) => imeiPorDispositivo.get(a.deviceId) ?? []);

  // ── EN DESTINO: sólo unidades con servicio especial vigente (Marco 7.7) ──
  const enDestinoPorUnidad = new Map<string, EnDestino>();
  const puntoDeLlegada = new Map<string, { lat: number; lng: number }>();
  const ventanaDesdePorUnidad = new Map<string, Date>();
  for (const e of especiales) {
    const previa = ventanaDesdePorUnidad.get(e.unitId);
    if (!previa || e.ventanaDesde < previa) ventanaDesdePorUnidad.set(e.unitId, e.ventanaDesde);
  }
  if (ventanaDesdePorUnidad.size > 0 && lugares.some((l) => l.rol === "destino")) {
    const imeis = [...ventanaDesdePorUnidad.keys()].flatMap(imeisDeUnidad);
    const desde = new Date(Math.min(...[...ventanaDesdePorUnidad.values()].map((d) => d.getTime())));
    const archivados = imeis.length > 0 ? await repos.telemetry.getForImeisDeCuenta(carrierAccountId, imeis, desde, ahora) : [];
    for (const [unitId, ventanaDesde] of ventanaDesdePorUnidad) {
      const suyos = new Set(imeisDeUnidad(unitId));
      const puntos: PuntoTraza[] = archivados
        .filter((p) => suyos.has(p.imei) && p.recordedAt >= ventanaDesde)
        .map((p) => ({ lat: p.latitude, lng: p.longitude, at: p.recordedAt, speed: p.speed }));
      // La posición viva va por delante del archivo (que llega cada 10 min): es
      // la que dice dónde está ahora.
      for (const v of posicionesVivas) {
        if (!suyos.has(v.imei) || v.recordedAt < ventanaDesde) continue;
        if (puntos.some((p) => p.at.getTime() === v.recordedAt.getTime())) continue;
        puntos.push({ lat: v.latitude, lng: v.longitude, at: v.recordedAt, speed: v.speed });
      }
      const d = enDestinoAhora(puntos, lugares);
      if (d) {
        const { punto, ...destino } = d;
        enDestinoPorUnidad.set(unitId, destino);
        puntoDeLlegada.set(unitId, punto);
      }
    }
  }

  const activas = unidades.filter((u) => u.active);
  const aClasificar = opciones.incluirInactivas ? unidades : activas;
  const flota = clasificarFlota({
    ahora,
    unidades: aClasificar.map((u) => ({ id: u.id, label: u.label })),
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
    enDestinoPorUnidad,
  });

  // ── Dónde dibujar cada unidad ──
  const vivaPorImei = new Map(posicionesVivas.map((p) => [p.imei, p]));
  const posicionPorUnidad = new Map<string, { lat: number; lng: number }>();
  for (const { unidad, estado } of flota.unidades) {
    if (estado.tipo === "sin_dispositivo") continue;
    if (estado.tipo === "en_destino") {
      const punto = puntoDeLlegada.get(unidad.id);
      if (punto) posicionPorUnidad.set(unidad.id, punto);
      continue;
    }
    const imei = imeiPorDispositivo.get(estado.dispositivoId);
    const viva = imei ? vivaPorImei.get(imei) : undefined;
    if (viva) posicionPorUnidad.set(unidad.id, { lat: viva.latitude, lng: viva.longitude });
  }

  return { flota, unidadesInactivas: unidades.length - activas.length, lugares, posicionPorUnidad };
}
