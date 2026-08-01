import { loadMonitoreo } from "@/lib/monitoreo-data";
import { diagnosticarTorre } from "@/lib/monitoreo-estado";
import { UnitShell } from "@/components/unit-shell";
import { withAccount } from "@/lib/account-context";
import { MonitoreoTorre } from "@/components/monitoreo-torre";
import {
  CuentaNueva,
  SinTurnoActivo,
  SistemaSinSenal,
} from "@/components/monitoreo-estados";
import { getRepos } from "@/lib/db";
import type { UnitPageContext } from "@/lib/unit-context";
import { scopeToUnitPath } from "@/lib/unit-routes";
import { localDateIso, pickActiveShift, pickNextShift } from "@/lib/local-time";
import { JTTEL_TZ, localTimeHHMM } from "@jtel/domain";
import Link from "next/link";

/**
 * Monitoreo — la torre (Ficha-Monitoreo.md).
 *
 * Esta vista no dibuja: **decide cuál de los cuatro estados de §5 toca**, carga
 * lo que ese estado necesita y nada más. Es una sola pantalla; lo que cambia es
 * qué ocupa el lugar del mapa.
 */

function parseParam(
  sp: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | null {
  const v = sp?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function MonitoreoUnitView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const now = new Date();
  // Fecha civil en Juárez (no UTC), para que a las 10pm no salte al "día de mañana".
  const fechaAuto = localDateIso(now);
  const fechaOverride = parseParam(sp, "fecha");
  const fecha = fechaOverride ?? fechaAuto;
  const turnoOverride = parseParam(sp, "turno");
  const autoMode = !fechaOverride && !turnoOverride;

  const repos = getRepos();
  const day = new Date(`${fecha}T12:00:00`);
  const [occs, configuredShifts] = await Promise.all([
    repos.occurrences.findForScope(ctx.scope, day, day),
    repos.routes.getShiftsForScope(ctx.scope),
  ]);

  const shiftById = new Map<string, { id: string; name: string; startTime: string }>();
  for (const s of configuredShifts) {
    shiftById.set(s.id, {
      id: s.id,
      name: s.name,
      startTime: String(s.startTime ?? "").slice(0, 5),
    });
  }
  for (const o of occs) {
    const shift = o.profile?.routeShift?.shift;
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

  const active = pickActiveShift(shifts, now);
  const proximo = pickNextShift(shifts, now);
  const turnoId =
    turnoOverride && shiftById.has(turnoOverride)
      ? turnoOverride
      : (active?.id ?? shifts[0]?.id ?? null);
  const selectedShift = turnoId ? (shiftById.get(turnoId) ?? null) : null;

  const monitoreo =
    turnoId != null
      ? await loadMonitoreo({
          scope: ctx.scope,
          accountSlug: ctx.client.slug,
          fecha,
          turnoId,
          now,
        })
      : null;

  const abiertas = monitoreo
    ? monitoreo.routes.filter((r) => r.state !== "cerrado").length
    : 0;

  const estado = await diagnosticarTorre({
    scope: ctx.scope,
    clientAccountId: ctx.client.id,
    hayTurnos: shifts.length > 0,
    enVuelo: monitoreo?.enVuelo ?? false,
    serviciosAbiertos: abiertas,
    now,
  });

  // Cuántas rutas trae el turno que SIGUE — no el que se está mostrando, que
  // ya cerró. Se cuenta sobre las ocurrencias del día ya cargadas; si el
  // siguiente turno es de mañana no hay nada que contar todavía, y entonces el
  // bloque no se muestra en vez de pintar un cero que no significa "ninguna".
  const programadasDelProximo =
    proximo && !proximo.manana
      ? occs.filter((o) => o.profile?.routeShift?.shiftId === proximo.turno.id).length ||
        null
      : null;

  // El último cierre del día: el turno cuyo hecho más reciente quedó sellado.
  // Si hoy no ha cerrado nada, el bloque simplemente no se muestra.
  const ultimoCierre = ultimoCierreDelDia(occs, shiftById);

  const scopeParam =
    ctx.scope.kind === "plant"
      ? `plantId=${ctx.scope.plantId}`
      : `groupId=${ctx.scope.plantGroupId}`;
  const query =
    turnoId != null
      ? `account=${encodeURIComponent(ctx.client.slug)}&fecha=${fecha}&turno=${turnoId}&${scopeParam}`
      : "";

  const basePath = scopeToUnitPath(ctx.scope);
  const cierreHref = withAccount(`${basePath}/cierre`, ctx.client.slug);
  const liveHref = withAccount(`${basePath}/monitoreo`, ctx.client.slug);
  const rutasHref = proximo
    ? `${liveHref}&turno=${proximo.turno.id}`
    : liveHref;

  // §3.1 · La línea de contexto: turno vigente, hora de entrada del personal y
  // deadline de llegada. El deadline vive por ocurrencia y puede diferir entre
  // rutas del mismo turno; cuando difieren se dice el rango, no un número que
  // no le toca a ninguna.
  const deadlines = [...new Set((monitoreo?.routes ?? []).map((r) => r.expectedDeadline))]
    .filter((d) => d.length > 0)
    .sort();
  const contexto = selectedShift
    ? [
        // El nombre a secas: los turnos ya se llaman "Primer Turno", "Turno B".
        selectedShift.name,
        selectedShift.startTime ? `entrada del personal ${selectedShift.startTime}` : null,
        // Dicho completo porque el deadline es ANTES de la entrada, y visto sin
        // etiqueta parece un error de captura.
        deadlines.length === 1
          ? `deadline de llegada ${deadlines[0]}`
          : deadlines.length > 1
            ? `deadline de llegada ${deadlines[0]}–${deadlines[deadlines.length - 1]}`
            : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const accion = (
    <Link
      href={cierreHref}
      className="rounded-sm border border-[var(--linea-fuerte)] px-3 py-1.5 text-[12px] text-[var(--texto)] transition-colors hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--azul)]"
    >
      Cierre del turno →
    </Link>
  );

  return (
    <UnitShell client={ctx.client} unit={ctx.unit} title="Monitoreo" contexto={contexto} accion={accion}>
      {!autoMode ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-[var(--b-acero)] bg-[var(--t-acero)] px-3 py-2 font-mono text-[11px] text-[var(--texto)] tabular-nums">
          <span>
            Vista forzada · {fecha}
            {selectedShift ? ` · ${selectedShift.name}` : ""}
          </span>
          <Link href={liveHref} className="text-[var(--azul)] hover:underline">
            Volver al turno en curso →
          </Link>
        </p>
      ) : null}

      {contenido()}

      <SelectorDeTurno
        clientSlug={ctx.client.slug}
        fecha={fecha}
        turnoId={turnoId}
        shifts={shifts}
      />
    </UnitShell>
  );

  function contenido() {
    // Forzar una fecha o un turno es pedir explícitamente esos datos: los
    // estados de §5 describen el ahora, y aquí el usuario no está mirando el
    // ahora. Se le muestra lo que pidió.
    if (!autoMode) {
      return monitoreo ? (
        <MonitoreoTorre initial={monitoreo} query={query} forzado />
      ) : (
        <SinDatos cierreHref={cierreHref} />
      );
    }

    if (estado.tipo === "cuenta_nueva") return <CuentaNueva pasos={estado.pasos} />;

    if (estado.tipo === "sin_senal") {
      return (
        <SistemaSinSenal
          edadMinutos={estado.edadMinutos}
          ultimaLectura={estado.ultimaLectura}
          serviciosEnRiesgo={estado.serviciosEnRiesgo}
        />
      );
    }

    if (estado.tipo === "sin_turno") {
      return (
        <SinTurnoActivo
          proximo={
            proximo
              ? {
                  nombre: proximo.turno.name,
                  hora: proximo.turno.startTime,
                  minutosPara: proximo.minutosPara,
                  manana: proximo.manana,
                }
              : null
          }
          ultimoCierre={ultimoCierre}
          programadas={programadasDelProximo}
          telemetriaViva={estado.telemetriaViva}
          edadMinutos={estado.edadMinutos}
          cierreHref={cierreHref}
          rutasHref={rutasHref}
          routes={monitoreo?.routes ?? []}
        />
      );
    }

    return monitoreo ? (
      <MonitoreoTorre initial={monitoreo} query={query} />
    ) : (
      <SinDatos cierreHref={cierreHref} />
    );
  }
}

function SinDatos({ cierreHref }: { cierreHref: string }) {
  return (
    <p className="rounded-sm border border-[var(--linea)] px-4 py-6 text-[13px] text-[var(--tenue)]">
      Este turno no tiene rutas programadas para la fecha elegida. Para jornadas pasadas
      ve al{" "}
      <Link href={cierreHref} className="text-[var(--azul)] hover:underline">
        cierre del turno
      </Link>
      .
    </p>
  );
}

/** Ver otro turno: es consulta, no la operación de ahora, y por eso va plegado. */
function SelectorDeTurno({
  clientSlug,
  fecha,
  turnoId,
  shifts,
}: {
  clientSlug: string;
  fecha: string;
  turnoId: string | null;
  shifts: Array<{ id: string; name: string; startTime: string }>;
}) {
  if (shifts.length === 0) return null;

  return (
    <details className="rounded-sm border border-[var(--linea)] px-3 py-2">
      <summary className="cursor-pointer font-mono text-[11px] tracking-[0.1em] text-[var(--tenue)] uppercase">
        Ver otra fecha o turno
      </summary>
      <form className="mt-3 flex flex-wrap items-end gap-3 text-[12px]" method="get">
        <input type="hidden" name="account" value={clientSlug} />
        <label>
          <span className="block text-[var(--tenue)]">Fecha</span>
          <input
            type="date"
            name="fecha"
            defaultValue={fecha}
            className="mt-1 block rounded-sm border border-[var(--linea)] bg-[var(--panel2)] px-2.5 py-1.5 font-mono text-[var(--texto)]"
          />
        </label>
        <label>
          <span className="block text-[var(--tenue)]">Turno</span>
          <select
            name="turno"
            defaultValue={turnoId ?? ""}
            className="mt-1 block rounded-sm border border-[var(--linea)] bg-[var(--panel2)] px-2.5 py-1.5 text-[var(--texto)]"
          >
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startTime})
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="cursor-pointer rounded-sm border border-[var(--b-acero)] px-3 py-1.5 text-[var(--acero)] transition-colors hover:bg-[var(--t-acero)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--azul)]"
        >
          Ver este turno
        </button>
      </form>
    </details>
  );
}

type OccConHecho = {
  profile?: { routeShift?: { shiftId?: string | null } | null } | null;
  complianceFact?: { materializedAt: Date } | null;
};

/**
 * El turno del día que selló más recientemente. Se lee de las ocurrencias que
 * ya se cargaron — no vale abrir otra consulta para una línea de apoyo.
 */
function ultimoCierreDelDia(
  occs: OccConHecho[],
  shiftById: Map<string, { id: string; name: string; startTime: string }>,
): { turno: string; hora: string } | null {
  let mejor: { shiftId: string; at: Date } | null = null;
  for (const o of occs) {
    const at = o.complianceFact?.materializedAt;
    const shiftId = o.profile?.routeShift?.shiftId;
    if (!at || !shiftId) continue;
    if (!mejor || at.getTime() > mejor.at.getTime()) mejor = { shiftId, at };
  }
  if (!mejor) return null;
  const turno = shiftById.get(mejor.shiftId);
  return {
    turno: turno?.name ?? "anterior",
    hora: localTimeHHMM(mejor.at, JTTEL_TZ),
  };
}
