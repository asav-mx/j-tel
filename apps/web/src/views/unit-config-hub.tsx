import Link from "next/link";
import { getRepos } from "@/lib/db";
import { ChipEstado, Panel } from "@/components/ui";
import { UnitShell } from "@/components/unit-shell";
import type { UnitPageContext } from "@/lib/unit-context";
import { contractMatchesScope, operationalUnitLabel } from "@/lib/operational-scope";
import {
  UNIT_CONFIG_STEPS,
  unitConfigStepHrefFor,
} from "@/lib/config-wizard";
import { unitContratosHref, unitDashboardHref } from "@/lib/unit-routes";

const mono = "font-[family-name:var(--fuente-mono)]";

/**
 * Cómo se dice un conteo de configuración.
 *
 * "3 listo(s)" no dice nada: el usuario tiene que abrir para saber tres qué. El
 * conteo va con su sustantivo, y el cero se dice como ausencia —"sin turnos"—
 * en vez de disfrazarse de número.
 */
const CUENTA: Record<string, { uno: string; varios: string; vacio: string }> = {
  geocercas: { uno: "geocerca", varios: "geocercas", vacio: "sin geocercas" },
  turnos: { uno: "turno", varios: "turnos", vacio: "sin turnos" },
  rutas: { uno: "ruta", varios: "rutas", vacio: "sin rutas" },
  servicios: { uno: "servicio", varios: "servicios", vacio: "sin servicios" },
};

function decirCuenta(id: string, n: number): string {
  const c = CUENTA[id];
  if (!c) return String(n);
  if (n === 0) return c.vacio;
  return `${n} ${n === 1 ? c.uno : c.varios}`;
}

export async function UnitConfigHub({
  ctx,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const { client, unit, scope } = ctx;
  const unitLabel = operationalUnitLabel(unit);

  const [geofences, routeShifts, shifts, profiles] = await Promise.all([
    repos.geofences.findForScope(scope, client.id),
    repos.routes.getRouteShiftsForScope(scope),
    repos.routes.getShiftsForScope(scope),
    repos.profiles.findForClient(client.id).then(async (all) => {
      const { operationalScopeFromContract } = await import("@jtel/domain");
      return all.filter((p) => {
        const cs = operationalScopeFromContract(p.contract ?? {});
        return cs && contractMatchesScope(p.contract ?? {}, scope);
      });
    }),
  ]);

  const stepCounts: Record<string, number> = {
    geocercas: geofences.length,
    turnos: shifts.length,
    rutas: routeShifts.length,
    servicios: profiles.length,
  };

  return (
    <UnitShell client={client} unit={unit} title={`Configuración — ${unitLabel}`}>
      <p className="max-w-[76ch] text-[13.5px] text-[var(--tenue)]">
        Lo que hay que dejar en pie para que{" "}
        <span className="text-[var(--texto)]">{unitLabel}</span> se pueda juzgar: dónde debe llegar
        la unidad, a qué hora entra el personal, por dónde va y con qué contrato. Cada paso aplica
        solo a esta unidad operativa.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={unitContratosHref(unit, client.slug)}
          className="block rounded-lg border border-[var(--linea)] bg-[var(--panel)] p-5 transition hover:border-[var(--azul)] md:col-span-2"
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className={`text-[9.5px] tracking-[.12em] text-[var(--tenue)] uppercase ${mono}`}
            >
              Requisito para los servicios
            </span>
            <span className="text-[13px] text-[var(--azul)]">Abrir →</span>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold text-[var(--texto)]">Contrato</h3>
          <p className="mt-1 max-w-[70ch] text-[12.5px] text-[var(--tenue)]">
            Con estas reglas se juzga: la hora límite, cuánta señal hace falta y qué pasa con el
            resultado. Debe estar activo antes del último paso.
          </p>
        </Link>
        {UNIT_CONFIG_STEPS.map((step) => {
          const count = stepCounts[step.id] ?? 0;
          const listo = count > 0;
          return (
            <Link
              key={step.id}
              href={unitConfigStepHrefFor(unit, client.slug, step.id)}
              className="block rounded-lg border border-[var(--linea)] bg-[var(--panel)] p-5 transition hover:border-[var(--azul)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full bg-[var(--t-acero)] text-[12px] text-[var(--acero)] ${mono}`}
                >
                  {step.n}
                </span>
                {/*
                 * Un paso terminado NO es un `cumplido`: aquí no hay ningún
                 * servicio verificado. Antes iba en verde relleno y el que
                 * faltaba en ámbar —los colores de `cumplido` y de `pendiente
                 * por evidencia`—, así que el ojo leía un resultado donde solo
                 * había configuración. Acero para lo que ya está en pie, tenue
                 * para lo que falta.
                 */}
                <ChipEstado tono={listo ? "acero" : "tenue"}>
                  {decirCuenta(step.id, count)}
                </ChipEstado>
              </div>
              <h3 className="mt-3 text-[15px] font-semibold text-[var(--texto)]">{step.title}</h3>
              <p className="mt-1 text-[12.5px] text-[var(--tenue)]">{step.desc}</p>
            </Link>
          );
        })}
      </div>

      <Panel
        titulo="En qué orden"
        nota="Cada paso necesita el anterior: no se puede trazar una ruta sin turno, ni generar servicios sin contrato activo."
      >
        <ol className="space-y-1.5 text-[13px] text-[var(--tenue)]">
          <li>
            <span className="text-[var(--texto)]">Contrato</span> con el transportista — actívalo si
            está en borrador.
          </li>
          <li>
            <span className="text-[var(--texto)]">Geocerca</span> de llegada — dónde termina la
            ruta.
          </li>
          <li>
            <span className="text-[var(--texto)]">Turnos</span> — la hora a la que entra el
            personal.
          </li>
          <li>
            <span className="text-[var(--texto)]">Rutas</span> — el trazado de cada turno. El mismo
            recorrido en dos turnos distintos son dos rutas distintas.
          </li>
          <li>
            <span className="text-[var(--texto)]">Servicios</span> — contrato, ruta y geocerca
            juntos, con su calendario.
          </li>
        </ol>
        <p className="mt-4 text-[13px]">
          <Link href={unitDashboardHref(unit, client.slug)} className="text-[var(--azul)]">
            ← Volver al panel de la unidad
          </Link>
        </p>
      </Panel>
    </UnitShell>
  );
}
