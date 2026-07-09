import { getRepos } from "@/lib/db";
import { ClientConfigShell } from "@/components/client-config-shell";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { computeExpectedDeadline } from "@jtel/domain";
import {
  findOperationalUnit,
  operationalUnitLabel,
  parseScopeFromSearchParams,
  unitHref,
} from "@/lib/operational-scope";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

const createdLabels: Record<string, string> = {
  ruta: "Ruta creada.",
  turno: "Turno creado.",
  routeshift: "Servicio programado (ruta + turno).",
  kml: "Nueva versión de trazado guardada.",
};

function fmtTime(t: string) {
  return t.slice(0, 5);
}

export default async function RutasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const created = typeof sp?.created === "string" ? sp.created : null;
  const scope = parseScopeFromSearchParams(sp);

  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);

  if (!client) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-5xl">
          <AppNav title="Rutas y turnos" links={[{ href: "/cliente/configuracion", label: "← Configuración" }]} />
          <Card title="Sin cliente">
            <p className="text-sm text-[var(--muted)]">No hay cuentas cliente.</p>
          </Card>
        </div>
      </main>
    );
  }

  const operationalUnits = await repos.clients.getOperationalUnits(client.id);
  const activeUnit = findOperationalUnit(operationalUnits, scope);

  const contracts = activeUnit
    ? (await repos.contracts.findForClient(client.id)).filter((c) =>
        activeUnit.kind === "plant"
          ? c.plantId === activeUnit.id
          : c.plantGroupId === activeUnit.id,
      )
    : [];
  const samplePolicy = contracts[0]?.policy;
  const anticipation = samplePolicy?.arrivalAnticipationMinutes ?? 15;
  const evidenceBefore = samplePolicy?.evidenceMarginMinutesBefore ?? 60;

  const [routes, shifts, routeShifts] = scope
    ? await Promise.all([
        repos.routes.getRoutesForScope(scope),
        repos.routes.getShiftsForScope(scope),
        repos.routes.getRouteShiftsForScope(scope),
      ])
    : [[], [], []];

  const scopeHiddenFields =
    scope?.kind === "plant" ? (
      <input type="hidden" name="plantId" value={scope.plantId} />
    ) : scope?.kind === "plant_group" ? (
      <input type="hidden" name="plantGroupId" value={scope.plantGroupId} />
    ) : null;

  const unitLabel = activeUnit ? operationalUnitLabel(activeUnit) : null;
  const isCampus = activeUnit?.kind === "plant_group";

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <ClientConfigShell
          client={client}
          title={`Rutas y turnos — ${client.name}`}
          step="rutas"
          basePath="/cliente/configuracion/rutas"
        />

        <p className="text-sm text-[var(--muted)]">
          Cliente corporativo: <span className="text-white">{client.name}</span>. Rutas y turnos
          pertenecen a una <span className="text-white">unidad operativa</span>: planta independiente
          (ej. Planta 47) o campus compartido (ej. varias plantas con destino común). El{" "}
          <span className="text-white">deadline</span> y la ventana GPS se calculan desde el contrato.
        </p>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
          <span className="text-[var(--muted)]">Unidad operativa:</span>
          {operationalUnits.length === 0 ? (
            <span className="text-[var(--muted)]">
              Sin plantas ni campus —{" "}
              <a href={withAccount("/cliente/plantas", client.slug)} className="text-[var(--accent)]">
                créalos primero
              </a>
              .
            </span>
          ) : (
            operationalUnits.map((u) => {
              const active = activeUnit?.id === u.id && activeUnit.kind === u.kind;
              return (
                <a
                  key={`${u.kind}-${u.id}`}
                  href={unitHref("/cliente/configuracion/rutas", client.slug, u)}
                  className={`rounded-full px-3 py-1 ${
                    active
                      ? "bg-[var(--accent)] font-medium text-black"
                      : "border border-white/10 hover:border-[var(--accent)]"
                  }`}
                >
                  {u.kind === "plant_group" ? "Campus: " : ""}
                  {operationalUnitLabel(u)}
                </a>
              );
            })
          )}
        </div>

        {!activeUnit || !scope ? (
          <Card title="Elige una unidad operativa">
            <p className="text-sm text-[var(--muted)]">
              Selecciona arriba una planta independiente o un campus para definir rutas, turnos y
              trazados KML compartidos.
            </p>
          </Card>
        ) : (
          <>
            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            {created ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                {createdLabels[created] ?? "Guardado."}
              </div>
            ) : null}

            {isCampus && activeUnit.kind === "plant_group" ? (
              <Card title="Campus compartido">
                <p className="text-sm text-[var(--muted)]">
                  Plantas en este campus:{" "}
                  <span className="text-white">
                    {activeUnit.memberPlants.map((p) => `${p.name} (${p.code})`).join(" · ") ||
                      "ninguna asignada"}
                  </span>
                  . Las rutas y turnos aplican a todas; la geocerca de llegada suele ser una sola
                  en la entrada del campus (configúrala en Geocercas).
                </p>
              </Card>
            ) : null}

            {samplePolicy ? (
              <Card title="Ventana de servicio (desde contrato activo)">
                <ul className="list-inside list-disc space-y-1 text-sm text-[var(--muted)]">
                  <li>
                    Anticipación de llegada:{" "}
                    <span className="text-white">{anticipation} min</span> antes del inicio del
                    turno → deadline en geocerca
                  </li>
                  <li>
                    Observación GPS empieza{" "}
                    <span className="text-white">{evidenceBefore} min</span> antes del deadline
                  </li>
                  <li>
                    Duración máxima de ruta:{" "}
                    <span className="text-white">
                      {samplePolicy.maxRouteDurationMinutes ?? 60} min
                    </span>
                  </li>
                </ul>
              </Card>
            ) : (
              <Card title="Contrato">
                <p className="text-sm text-[var(--muted)]">
                  Crea y activa un contrato para {unitLabel} en el paso 4 — ahí defines anticipación,
                  márgenes de evidencia y si se verifica trazado KML.
                </p>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="1. Nueva ruta + trazado">
                <form
                  action="/api/cliente/rutas"
                  method="post"
                  encType="multipart/form-data"
                  className="space-y-3"
                >
                  <input type="hidden" name="clientSlug" value={client.slug} />
                  {scopeHiddenFields}
                  <input type="hidden" name="action" value="route" />
                  <label className={labelClass}>
                    Nombre de la ruta
                    <input name="name" required className={inputClass} placeholder="Ej. Ruta Poniente" />
                  </label>
                  <label className={labelClass}>
                    Archivo KML / KMZ (trazado de recolección)
                    <input name="kmlFile" type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml" className={inputClass} />
                  </label>
                  <label className={labelClass}>
                    O waypoints manuales (lat,lng por línea)
                    <textarea name="waypoints" rows={3} className={inputClass} placeholder="31.75,-106.48" />
                  </label>
                  <button type="submit" className={btnClass}>
                    Crear ruta
                  </button>
                </form>
              </Card>

              <Card title="2. Nuevo turno">
                <form action="/api/cliente/rutas" method="post" className="space-y-3">
                  <input type="hidden" name="clientSlug" value={client.slug} />
                  {scopeHiddenFields}
                  <input type="hidden" name="action" value="shift" />
                  <label className={labelClass}>
                    Nombre del turno
                    <input name="name" required className={inputClass} placeholder="Ej. Entrada 7:00" />
                  </label>
                  <label className={labelClass}>
                    Hora de inicio del turno (cuándo entra el personal)
                    <input name="startTime" required type="time" className={inputClass} defaultValue="07:00" />
                  </label>
                  <p className="text-xs text-[var(--muted)]">
                    El deadline (llegada a geocerca) = esta hora − anticipación del contrato. No se
                    captura aquí.
                  </p>
                  <button type="submit" className={btnClass}>
                    Crear turno
                  </button>
                </form>
              </Card>
            </div>

            <Card title="3. Programar servicio (ruta + turno)">
              {routes.length === 0 || shifts.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Crea al menos una ruta y un turno.</p>
              ) : (
                <form action="/api/cliente/rutas" method="post" className="grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="clientSlug" value={client.slug} />
                  {scopeHiddenFields}
                  <input type="hidden" name="action" value="routeshift" />
                  <label className={labelClass}>
                    Ruta
                    <select name="routeId" required className={inputClass} defaultValue="">
                      <option value="" disabled>
                        Elige ruta…
                      </option>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Turno
                    <select name="shiftId" required className={inputClass} defaultValue="">
                      <option value="" disabled>
                        Elige turno…
                      </option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · inicio {fmtTime(s.startTime)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-2">
                    <button type="submit" className={btnClass}>
                      Programar
                    </button>
                  </div>
                </form>
              )}
            </Card>

            {routes.length > 0 ? (
              <Card title="Actualizar trazado KML (nueva versión)">
                <form
                  action="/api/cliente/rutas"
                  method="post"
                  encType="multipart/form-data"
                  className="grid gap-3 md:grid-cols-2"
                >
                  <input type="hidden" name="clientSlug" value={client.slug} />
                  {scopeHiddenFields}
                  <input type="hidden" name="action" value="kml" />
                  <label className={labelClass}>
                    Ruta
                    <select name="routeId" required className={inputClass}>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Archivo KML / KMZ
                    <input name="kmlFile" type="file" accept=".kml,.kmz" required className={inputClass} />
                  </label>
                  <div className="md:col-span-2">
                    <button type="submit" className={btnClass}>
                      Guardar nueva versión
                    </button>
                  </div>
                </form>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  El trazado puede cambiar cuando se mueven puntos de recolección. Las versiones
                  anteriores se conservan para auditoría.
                </p>
              </Card>
            ) : null}

            <Card title={`Servicios programados — ${unitLabel} (${routeShifts.length})`}>
              {routeShifts.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Sin combinaciones todavía.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {routeShifts.map((rs) => {
                    const shiftStart = rs.shift?.startTime ?? "07:00:00";
                    const deadline = computeExpectedDeadline(
                      "2026-01-01",
                      shiftStart,
                      anticipation,
                    );
                    const dl = `${String(deadline.getHours()).padStart(2, "0")}:${String(deadline.getMinutes()).padStart(2, "0")}`;
                    const kmlCount = rs.route?.kmlVersions?.length ?? 0;
                    return (
                      <li key={rs.id} className="rounded border border-white/5 p-3">
                        <p className="font-medium">
                          {rs.route?.name ?? "—"} · {rs.shift?.name ?? "—"}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          Turno inicia {fmtTime(shiftStart)} · deadline ~{dl} (anticipación{" "}
                          {anticipation} min) · {kmlCount} versión(es) de trazado
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
