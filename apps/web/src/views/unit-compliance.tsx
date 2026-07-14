import { getRepos } from "@/lib/db";
import { Card } from "@/components/ui";
import { UnitShell } from "@/components/unit-shell";
import { OccurrenceTable, toOccurrenceRow } from "@/components/occurrence-table";
import { ComplianceSelectFilter } from "@/components/compliance-select-filter";
import { DateRangeFilter } from "@/components/date-range-filter";
import type { UnitPageContext } from "@/lib/unit-context";
import {
  contractMatchesScope,
  operationalUnitLabel,
} from "@/lib/operational-scope";
import { operationalScopeFromContract } from "@jtel/domain";
import { unitConfigStepHref, unitComplianceHref } from "@/lib/unit-routes";
import {
  addDaysIso,
  isIsoDate,
  parseSearchParam,
  resolveDateRange,
  todayIso,
  type DateRange,
} from "@/lib/date-range";

type StatusFilter = "all" | "sin_verificar" | "cumplido" | "no_cumplido" | "pendiente_evidencia";

function chipClass(active: boolean): string {
  return active
    ? "rounded-full bg-[var(--accent)] px-3 py-1 text-sm text-black"
    : "rounded-full border border-white/10 px-3 py-1 text-sm hover:border-[var(--accent)]";
}

function complianceHref(
  base: string,
  params: {
    desde?: string;
    hasta?: string;
    estado?: StatusFilter;
    turno?: string | null;
    perfil?: string | null;
  },
): string {
  const url = new URL(base, "http://local");
  if (params.desde) url.searchParams.set("desde", params.desde);
  if (params.hasta) url.searchParams.set("hasta", params.hasta);
  if (params.estado && params.estado !== "all") url.searchParams.set("estado", params.estado);
  if (params.turno) url.searchParams.set("turno", params.turno);
  if (params.perfil) url.searchParams.set("perfil", params.perfil);
  return `${url.pathname}${url.search}`;
}

/** Compat: enlaces viejos `?fecha=7d|hoy|ayer|YYYY-MM-DD` → rango desde/hasta. */
function rangeFromLegacyFecha(
  sp: Record<string, string | string[] | undefined> | undefined,
): DateRange | null {
  const hasDesde = isIsoDate(parseSearchParam(sp, "desde"));
  const hasHasta = isIsoDate(parseSearchParam(sp, "hasta"));
  if (hasDesde || hasHasta) return null;

  const fecha = parseSearchParam(sp, "fecha");
  if (!fecha) return null;

  const today = todayIso();
  const yesterday = addDaysIso(today, -1);

  if (isIsoDate(fecha)) {
    return {
      fromIso: fecha,
      toIso: fecha,
      from: new Date(`${fecha}T00:00:00`),
      to: new Date(`${fecha}T00:00:00`),
      label: fecha,
    };
  }
  if (fecha === "hoy") {
    return {
      fromIso: today,
      toIso: today,
      from: new Date(`${today}T00:00:00`),
      to: new Date(`${today}T00:00:00`),
      label: "Hoy",
    };
  }
  if (fecha === "ayer") {
    return {
      fromIso: yesterday,
      toIso: yesterday,
      from: new Date(`${yesterday}T00:00:00`),
      to: new Date(`${yesterday}T00:00:00`),
      label: "Ayer",
    };
  }
  if (fecha === "7d") {
    const fromIso = addDaysIso(today, -6);
    return {
      fromIso,
      toIso: today,
      from: new Date(`${fromIso}T00:00:00`),
      to: new Date(`${today}T00:00:00`),
      label: "Últimos 7 días",
    };
  }
  if (fecha === "todos") {
    const fromIso = addDaysIso(today, -365);
    return {
      fromIso,
      toIso: today,
      from: new Date(`${fromIso}T00:00:00`),
      to: new Date(`${today}T00:00:00`),
      label: "Último año",
    };
  }
  return null;
}

export async function UnitComplianceView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const repos = getRepos();
  const { client, unit, scope } = ctx;
  const unitLabel = operationalUnitLabel(unit);
  const baseHref = unitComplianceHref(unit, client.slug);
  const perfilesHref = unitConfigStepHref(unit, client.slug, "servicios");
  const actionPath = baseHref.split("?")[0]!;

  const estadoRaw = parseSearchParam(sp, "estado") as StatusFilter | null;
  const estado: StatusFilter =
    estadoRaw === "sin_verificar" ||
    estadoRaw === "cumplido" ||
    estadoRaw === "no_cumplido" ||
    estadoRaw === "pendiente_evidencia" ||
    estadoRaw === "all"
      ? estadoRaw
      : "all";

  const turnoFilter = parseSearchParam(sp, "turno");
  const perfilFilter = parseSearchParam(sp, "perfil");

  const range =
    rangeFromLegacyFecha(sp) ?? resolveDateRange(sp, { defaultDaysBack: 1 });

  const [occurrences, allProfiles, routeShifts] = await Promise.all([
    repos.occurrences.findForScope(scope, range.from, range.to),
    repos.profiles.findForClient(client.id),
    repos.routes.getRouteShiftsForScope(scope),
  ]);

  const profiles = allProfiles.filter((p) => {
    const cs = operationalScopeFromContract(p.contract ?? {});
    return cs && contractMatchesScope(p.contract ?? {}, scope);
  });

  const profiledRouteShiftIds = new Set(profiles.map((p) => p.routeShiftId));
  const coverage = {
    routesTotal: routeShifts.length,
    routesProfiled: routeShifts.filter((rs) => profiledRouteShiftIds.has(rs.id)).length,
    profiles: profiles.length,
  };

  const shiftById = new Map<string, { id: string; name: string; startTime: string }>();
  for (const p of profiles) {
    const shift = p.routeShift?.shift;
    if (shift?.id && !shiftById.has(shift.id)) {
      shiftById.set(shift.id, {
        id: shift.id,
        name: shift.name,
        startTime: String(shift.startTime ?? "").slice(0, 5),
      });
    }
  }
  for (const rs of routeShifts) {
    const shift = rs.shift;
    if (shift?.id && !shiftById.has(shift.id)) {
      shiftById.set(shift.id, {
        id: shift.id,
        name: shift.name,
        startTime: String(shift.startTime ?? "").slice(0, 5),
      });
    }
  }
  const shifts = [...shiftById.values()].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name),
  );

  const profilesForSelect = turnoFilter
    ? profiles.filter((p) => p.routeShift?.shiftId === turnoFilter)
    : profiles;

  let filtered = occurrences;
  if (turnoFilter) {
    filtered = filtered.filter((o) => o.profile?.routeShift?.shiftId === turnoFilter);
  }
  if (perfilFilter) {
    filtered = filtered.filter(
      (o) => o.serviceProfileId === perfilFilter || o.profile?.code === perfilFilter,
    );
  }
  if (estado === "sin_verificar") {
    filtered = filtered.filter((o) => !o.complianceFact);
  } else if (estado !== "all") {
    filtered = filtered.filter((o) => o.complianceFact?.status === estado);
  }

  const stats = {
    total: filtered.length,
    cumplido: filtered.filter((o) => o.complianceFact?.status === "cumplido").length,
    no_cumplido: filtered.filter((o) => o.complianceFact?.status === "no_cumplido").length,
    pendiente: filtered.filter((o) => o.complianceFact?.status === "pendiente_evidencia").length,
    sin_verificar: filtered.filter((o) => !o.complianceFact).length,
  };

  const rows = filtered.map((occ) =>
    toOccurrenceRow(occ, "/cliente/servicio", client.slug, { showPlant: false }),
  );

  const statusFilters: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: "Todos" },
    { id: "sin_verificar", label: "Sin verificar" },
    { id: "cumplido", label: "Cumplido" },
    { id: "no_cumplido", label: "No cumplido" },
    { id: "pendiente_evidencia", label: "Pendiente" },
  ];

  const profileOptions = [...profilesForSelect]
    .sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name))
    .map((p) => ({
      value: p.id,
      label: `${p.code} — ${p.name}`,
    }));

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <UnitShell client={client} unit={unit} title={`Cumplimiento — ${unitLabel}`} />

        <p className="text-sm text-[var(--muted)]">
          Servicios verificados de <span className="text-white">{unitLabel}</span> contra el GPS del
          carrier. Elige el rango de fechas que quieras revisar.
        </p>

        <Card title="Cobertura de rutas">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              <span className="text-white">
                {coverage.routesProfiled} de {coverage.routesTotal}
              </span>{" "}
              rutas+turno con perfil · {coverage.profiles} perfil(es) activo(s)
              {coverage.routesTotal > coverage.routesProfiled ? (
                <span className="text-[var(--muted)]">
                  {" "}
                  · faltan {coverage.routesTotal - coverage.routesProfiled} por perfilar
                </span>
              ) : null}
            </p>
            <a href={perfilesHref} className="text-[var(--accent)] hover:underline">
              Ir a Perfiles →
            </a>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card title="En vista">
            <p className="text-2xl font-semibold">{stats.total}</p>
          </Card>
          <Card title="Cumplidos">
            <p className="text-2xl font-semibold text-emerald-300">{stats.cumplido}</p>
          </Card>
          <Card title="No cumplidos">
            <p className="text-2xl font-semibold text-red-300">{stats.no_cumplido}</p>
          </Card>
          <Card title="Pendientes">
            <p className="text-2xl font-semibold text-amber-200">{stats.pendiente}</p>
          </Card>
          <Card title="Sin verificar">
            <p className="text-2xl font-semibold text-[var(--muted)]">{stats.sin_verificar}</p>
          </Card>
        </div>

        <div className="space-y-3">
          <DateRangeFilter
            action={actionPath}
            range={range}
            hidden={{
              account: client.slug,
              estado: estado !== "all" ? estado : undefined,
              turno: turnoFilter,
              perfil: perfilFilter,
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--muted)]">Estado:</span>
            {statusFilters.map((s) => (
              <a
                key={s.id}
                href={complianceHref(baseHref, {
                  desde: range.fromIso,
                  hasta: range.toIso,
                  estado: s.id,
                  turno: turnoFilter,
                  perfil: perfilFilter,
                })}
                className={chipClass(estado === s.id)}
              >
                {s.label}
              </a>
            ))}
          </div>

          {shifts.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--muted)]">Turno:</span>
              <a
                href={complianceHref(baseHref, {
                  desde: range.fromIso,
                  hasta: range.toIso,
                  estado,
                  turno: null,
                  perfil: perfilFilter,
                })}
                className={chipClass(!turnoFilter)}
              >
                Todos
              </a>
              {shifts.map((s) => (
                <a
                  key={s.id}
                  href={complianceHref(baseHref, {
                    desde: range.fromIso,
                    hasta: range.toIso,
                    estado,
                    turno: s.id,
                    perfil: null,
                  })}
                  className={chipClass(turnoFilter === s.id)}
                >
                  {s.name}
                </a>
              ))}
            </div>
          ) : null}

          {profileOptions.length > 0 ? (
            <ComplianceSelectFilter
              label="Perfil"
              name="perfil"
              value={perfilFilter}
              options={profileOptions}
              allLabel="Todos los perfiles"
              filterState={{
                baseHref,
                desde: range.fromIso,
                hasta: range.toIso,
                estado,
                turno: turnoFilter,
              }}
            />
          ) : null}
        </div>

        <Card title={`Servicios — ${range.label} (${rows.length})`}>
          <OccurrenceTable rows={rows} showPlant={false} />
        </Card>
      </div>
    </main>
  );
}
