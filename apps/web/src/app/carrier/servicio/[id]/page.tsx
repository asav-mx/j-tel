import { notFound } from "next/navigation";
import { NavBar } from "@/components/ui";
import { ServiceDetailView } from "@/components/service-detail-view";
import { CarrierDudosoReview } from "@/components/carrier-dudoso-review";
import {
  loadServiceDetail,
  type MapPoint,
} from "@/lib/service-detail-data";
import { suggestionsFromLedger } from "@/lib/carrier-unit-suggestions";
import {
  armarExpediente,
  candidatasDelLedger,
} from "@/lib/expediente-sin-atribucion";
import { ExpedienteSinAtribucionView } from "@/components/expediente-sin-atribucion";
import { CajaAportacion, type AportacionVista } from "@/components/caja-aportacion";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { getRepos } from "@/lib/db";
import {
  calibrationViewEnd,
  cutTrackAtArrival,
  cutTrackAtIndex,
  findFirstGeofenceEntry,
  type NamedGeofence,
} from "@/lib/map-evidence";
import type { ContractPolicy } from "@jtel/domain";
import { localDateTimeShort, JTTEL_TZ } from "@jtel/domain";
import { exigirRecurso, exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

const TRACK_COLORS = ["#22c55e", "#f59e0b", "#38bdf8"];

function formatShort(iso: string, timeZone: string = JTTEL_TZ): string {
  return localDateTimeShort(iso, timeZone);
}

export default async function CarrierServicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se renderiza. Va en la PÁGINA y no solo en el layout:
  // un redirect de layout no impide que la hija se renderice, y su payload
  // viaja igual en la respuesta (regla 7 del plan).
  await exigirSesion();

  const { id } = await params;
  // La cuenta dueña sale de la FILA del servicio, no de `?account=`. Va ADEMÁS
  // de la comprobación del cargador, no en su lugar: la guardia es la puerta
  // uniforme —la que una pantalla nueva hereda por convención— y el filtro del
  // cargador es el respaldo de datos. Quitar el de adentro para "centralizar"
  // cambiaría una disciplina por otra y dejaría el producto con una sola capa.
  await exigirRecurso("carrier", () => getRepos().procedencia.carrierDeServicio(id));

  const carrier = await resolveAccountByType("carrier", searchParams);
  if (!carrier) {
    return (
      <main className="p-8">
        <p>Sin carrier.</p>
      </main>
    );
  }

  const data = await loadServiceDetail(id, {
    carrierAccountId: carrier.id,
    showEnforcement: false,
  });

  const repos = getRepos();
  const [units, assignments, occurrence] = await Promise.all([
    repos.fleet.getUnitsForCarrier(carrier.id),
    repos.fleet.getActiveAssignmentsForCarrier(carrier.id),
    repos.occurrences.findById(id),
  ]);
  if (!occurrence) notFound();

  const unitOptions = units.map((u) => ({
    id: u.id,
    label: `${u.label}${u.plateNumber ? ` (${u.plateNumber})` : ""}`,
  }));

  const imeiToUnitId = new Map<string, string>();
  for (const a of assignments) {
    const imei = a.device?.imei;
    if (imei) imeiToUnitId.set(imei, a.unitId);
  }

  const suggestions = suggestionsFromLedger(
    data.ledger,
    unitOptions,
    imeiToUnitId,
    3,
  );

  const existingGt = await repos.occurrenceGroundTruth.findByOccurrence(id);
  // Solo dudosos reales (sin unidad observada) van al flujo de etiquetado.
  const fact = occurrence?.complianceFact;
  const isDudosoSinUnidad =
    data.status === "no_cumplido" && !fact?.observedUnitId;
  const showLabelForm = isDudosoSinUnidad;
  /*
   * El expediente entra en TODO hecho sellado sin unidad acreditada, no solo en
   * los `no_cumplido`: un `pendiente_evidencia` también deja al transportista
   * mirando una pantalla que no explica nada, y la pregunta —qué se observó— es
   * la misma. Son 154 hechos más.
   */
  const sinUnidadAcreditada = Boolean(fact) && !fact?.observedUnitId;

  const evidencePoints = occurrence?.trip?.evidencePoints ?? [];
  const unitIdToImeis = new Map<string, string[]>();
  for (const a of assignments) {
    const imei = a.device?.imei;
    if (!imei) continue;
    const list = unitIdToImeis.get(a.unitId) ?? [];
    list.push(imei);
    unitIdToImeis.set(a.unitId, list);
  }

  const policy = (occurrence?.profile?.contract?.policy ?? {}) as ContractPolicy;
  const deadline = occurrence.expectedDeadline;
  // copia defensiva: calibrationViewEnd crea su propia copia internamente, pero un Date compartido es trampa
  const tripStart = occurrence.trip?.evidenceWindowStart ?? new Date(deadline);
  const viewEnd = calibrationViewEnd(deadline, policy);

  // Geocercas destino de TODOS los contratos de este carrier (solo lectura / calibración).
  const carrierContracts = await repos.contracts.findForCarrier(carrier.id);
  const geofenceById = new Map<string, NamedGeofence>();
  for (const c of carrierContracts) {
    const profiles = await repos.profiles.findForContract(c.id);
    for (const p of profiles) {
      const g = p.geofence;
      if (!g || g.role !== "destino" || !g.polygon || g.polygon.length < 3) continue;
      if (geofenceById.has(g.id)) continue;
      const scopeLabel =
        c.plantGroup?.name ?? c.plant?.code ?? c.client?.name ?? "destino";
      geofenceById.set(g.id, {
        id: g.id,
        name: `${g.name} · ${scopeLabel}`,
        polygon: g.polygon as Array<{ lat: number; lng: number }>,
      });
    }
  }
  // Asegura que la geocerca de ESTE servicio esté (aunque role no sea destino).
  if (data.geofencePolygon.length >= 3) {
    const selfId = occurrence?.profile?.geofence?.id ?? `self-${id}`;
    if (!geofenceById.has(selfId)) {
      geofenceById.set(selfId, {
        id: selfId,
        name: occurrence?.profile?.geofence?.name
          ? `${occurrence.profile.geofence.name} · este servicio`
          : "Destino de este servicio",
        polygon: data.geofencePolygon,
      });
    }
  }
  const namedGeofences = [...geofenceById.values()];

  // Telemetría en ventana de calibración (dudosos sin unidad) o viaje (con llegada).
  let telemetryByUnit = new Map<string, MapPoint[]>();
  const loadFrom = tripStart;
  const loadTo = isDudosoSinUnidad
    ? viewEnd
    : (occurrence?.trip?.evidenceWindowEnd ?? viewEnd);

  const imeis = suggestions.flatMap((s) => unitIdToImeis.get(s.unitId) ?? []);
  if (imeis.length > 0) {
    const telem = await repos.telemetry.getForImeis(imeis, loadFrom, loadTo);
    for (const p of telem) {
      const unitId = p.unitId ?? imeiToUnitId.get(p.imei);
      if (!unitId) continue;
      const list = telemetryByUnit.get(unitId) ?? [];
      list.push({
        lat: p.latitude,
        lng: p.longitude,
        at: p.recordedAt.toISOString(),
      });
      telemetryByUnit.set(unitId, list);
    }
    for (const [, pts] of telemetryByUnit) {
      pts.sort((a, b) => a.at.localeCompare(b.at));
    }
  }

  const trackSources = suggestions.map((s, i) => {
    let raw: MapPoint[] = evidencePoints
      .filter((p) => {
        if (p.unitId === s.unitId) return true;
        return imeiToUnitId.get(p.imei) === s.unitId;
      })
      .map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
        at: p.recordedAt.toISOString(),
      }))
      .sort((a, b) => a.at.localeCompare(b.at));

    // Preferir telemetría extendida cuando hay más puntos (calibración).
    const telem = telemetryByUnit.get(s.unitId) ?? [];
    if (telem.length > raw.length) raw = telem;
    else if (raw.length < 2) raw = telem;

    // Con llegada registrada: cortar ahí (regla transversal).
    if (fact?.observedArrivalAt) {
      raw = cutTrackAtArrival(raw, fact.observedArrivalAt);
    }

    // Dudoso sin unidad: marcar primera entrada a cualquier geocerca del carrier y cortar.
    let entry: {
      lat: number;
      lng: number;
      at: string;
      geofenceName: string;
    } | null = null;
    if (isDudosoSinUnidad && raw.length > 0) {
      const hit = findFirstGeofenceEntry(raw, namedGeofences);
      if (hit) {
        entry = {
          lat: hit.point.lat,
          lng: hit.point.lng,
          at: hit.point.at,
          geofenceName: hit.geofence.name,
        };
        raw = cutTrackAtIndex(raw, hit.index);
      }
    }

    return {
      unitId: s.unitId,
      label: s.label,
      color: TRACK_COLORS[i % TRACK_COLORS.length]!,
      points: raw,
      entry,
    };
  });

  /*
   * El expediente sin atribución — Parte 1.
   *
   * Se arma con lo que YA está sellado. Los umbrales salen de la política del
   * HECHO, no de la del contrato de hoy: es la lección de C24 — la pantalla que
   * explica un hecho tiene que leer con qué se le juzgó, no con lo que rige
   * ahora.
   */
  const politicaDelSello = (fact?.contractPolicySnapshot ?? policy) as ContractPolicy;
  const empalmesDelDia = sinUnidadAcreditada
    ? await repos.compliance.unidadesQueAcreditaronEnFecha(
        carrier.id,
        occurrence.serviceDate,
        id,
        // El cliente de ESTE servicio: el nombre de la otra ruta solo sale si
        // coincide. Ley 3, aplicada en el repositorio y no en la vista.
        occurrence.profile.contract.clientAccountId,
      )
    : new Map<string, { rutaNombre: string | null; fecha: string }>();

  const puntosPorClave = new Map<string, Array<{ at: Date }>>();
  for (const p of evidencePoints) {
    const clave = p.unitId ?? imeiToUnitId.get(p.imei) ?? p.imei;
    const lista = puntosPorClave.get(clave) ?? [];
    lista.push({ at: p.recordedAt });
    puntosPorClave.set(clave, lista);
  }

  const expediente = sinUnidadAcreditada
    ? armarExpediente({
        puntosDeLaFlota: evidencePoints.length,
        // Cuando el hecho traiga expediente sellado, manda. Hoy es null en todo
        // lo anterior a la Parte 2, y ese null significa «no se preguntó».
        snapshot: fact?.candidatasSnapshot ?? null,
        ledgerCandidatas: candidatasDelLedger(data.ledger),
        umbrales: {
          minKmlPct: politicaDelSello.kmlMatchMinPct ?? null,
          minCorridorPct: politicaDelSello.kmlCorridorMinPct ?? null,
          originToleranceFraction: politicaDelSello.kmlOriginToleranceFraction ?? null,
        },
        etiquetaDe: (clave) =>
          unitOptions.find((u) => u.id === clave)?.label ??
          unitOptions.find((u) => u.id === imeiToUnitId.get(clave))?.label ??
          null,
        empalmeDe: (clave) => empalmesDelDia.get(clave) ?? null,
        senalDe: (clave) => {
          const pts = puntosPorClave.get(clave);
          if (!pts || pts.length === 0) return null;
          const inicio = tripStart.getTime();
          const fin = (occurrence.trip?.evidenceWindowEnd ?? viewEnd).getTime();
          const ms = Math.max(1, fin - inicio);
          const dentro = pts
            .map((p) => p.at.getTime())
            .filter((t) => t >= inicio && t <= fin)
            .sort((a, b) => a - b);
          if (dentro.length === 0) return null;
          const huecos: number[] = [];
          for (let i = 1; i < dentro.length; i++) huecos.push(dentro[i]! - dentro[i - 1]!);
          const mayor = huecos.length > 0 ? Math.max(...huecos) : 0;
          const orden = [...huecos].sort((a, b) => a - b);
          const mediana =
            orden.length === 0
              ? null
              : orden.length % 2 === 1
                ? orden[(orden.length - 1) / 2]! / 1000
                : (orden[orden.length / 2 - 1]! + orden[orden.length / 2]!) / 2000;
          return {
            coberturaPct: Math.min(
              100,
              ((dentro[dentro.length - 1]! - dentro[0]!) / ms) * 100,
            ),
            huecoMaximoMin: mayor / 60_000,
            cadenciaMedianaS: mediana,
            puntos: dentro.length,
          };
        },
      })
    : null;

  /*
   * La reconciliación — donde el transportista pone su versión.
   *
   * El catálogo sale de la política del SELLO cuando el hecho existe: es con la
   * que se juzgó ese servicio, y ofrecer motivos que entonces no existían sería
   * dejar aportar contra una regla que no aplicaba (C24).
   */
  const aportacionesFilas = sinUnidadAcreditada
    ? await repos.aportaciones.listarPorOcurrencia(id)
    : [];
  const etiquetaUnidad = new Map(unitOptions.map((u) => [u.id, u.label]));
  const aportaciones: AportacionVista[] = aportacionesFilas.map((a) => ({
    id: a.id,
    motivo: a.motivo,
    nota: a.nota,
    unidadEtiqueta: a.declaredUnitId ? (etiquetaUnidad.get(a.declaredUnitId) ?? null) : null,
    adjuntos: a.adjuntos ?? [],
    estado: a.estado,
    creadaAt: a.createdAt.toISOString(),
    resolucionNota: a.resolucionNota,
  }));
  const catalogoExcusables = (politicaDelSello?.excusableReasons ?? []) as string[];

  /*
   * El empalme por unidad, para que el transportista pueda señalarlo.
   *
   * ⚠ **El nombre de la otra ruta solo viaja si es del MISMO cliente.** Está
   * medido que en 49 de 397 servicios (12.3 %) la unidad acreditó a OTRO
   * cliente, y nombrar esa ruta contaría la operación de un tercero. En ese caso
   * se dice que hubo empalme y no cuál — la misma forma que el Marco ya usa para
   * `arrivalOutsideContractGeofence`.
   */
  const empalmePorUnidad: Record<string, { rutaNombre: string | null }> = {};
  for (const [clave, e] of empalmesDelDia) {
    empalmePorUnidad[clave] = { rutaNombre: e.rutaNombre };
  }

  const tz = policy.timeZone ?? JTTEL_TZ;
  const calibrationWindowLabel = `${formatShort(loadFrom.toISOString(), tz)} → ${formatShort(
    loadTo.toISOString(), tz,
  )}`;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <NavBar
          title={`Servicio ${data.serviceDate} — ${data.clientName}`}
          links={[
            {
              href: withAccount("/carrier/cumplimiento", carrier.slug),
              label: "← Cumplimiento",
            },
          ]}
        />
        <ServiceDetailView
          data={data}
          backHref={withAccount("/carrier/cumplimiento", carrier.slug)}
          backLabel="← Volver a cumplimiento"
          hideEvidenceMap={showLabelForm}
        />

        {expediente ? (
          <ExpedienteSinAtribucionView expediente={expediente} timeZone={tz} />
        ) : null}

        {/*
         * Justo debajo del expediente, que es donde el árbitro acaba de decir
         * que no pudo atribuir. En una bandeja aparte sería una queja; aquí la
         * versión se lee junto a la evidencia que la sostiene o la contradice.
         */}
        {sinUnidadAcreditada ? (
          <CajaAportacion
            occurrenceId={id}
            accountSlug={carrier.slug}
            catalogo={catalogoExcusables}
            unidades={unitOptions}
            existentes={aportaciones}
            empalmePorUnidad={empalmePorUnidad}
          />
        ) : null}

        {showLabelForm ? (
          <CarrierDudosoReview
            occurrenceId={id}
            accountSlug={carrier.slug}
            units={unitOptions}
            suggestions={suggestions}
            trackSources={trackSources}
            kmlWaypoints={data.kmlWaypoints}
            geofences={namedGeofences}
            calibrationWindowLabel={calibrationWindowLabel}
            existing={
              existingGt
                ? {
                    verdict: existingGt.operatorVerdict,
                    unitId: existingGt.operatorUnitId,
                    notes: existingGt.notes,
                  }
                : null
            }
          />
        ) : null}
      </div>
    </main>
  );
}
