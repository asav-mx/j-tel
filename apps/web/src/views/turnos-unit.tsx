import Link from "next/link";
import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { UnitShell } from "@/components/unit-shell";
import { Card } from "@/components/ui";
import { confirmMessages } from "@/lib/confirm-messages";
import { unitConfigStepHrefFor } from "@/lib/config-wizard";
import type { UnitPageContext } from "@/lib/unit-context";
import {
  contractMatchesScope,
  operationalUnitLabel,
} from "@/lib/operational-scope";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

const createdLabels: Record<string, string> = {
  turno: "Turno registrado. Ya puedes crear rutas vinculadas a este turno.",
  turno_eliminado: "Turno eliminado.",
};

function fmtTime(t: string) {
  return t.slice(0, 5);
}

export async function TurnosUnitView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const created = typeof sp?.created === "string" ? sp.created : null;
  const { client, unit, scope } = ctx;

  const repos = getRepos();

  const [shifts, contracts] = await Promise.all([
    repos.routes.getShiftsForScope(scope),
    repos.contracts.findForClient(client.id).then((all) =>
      all.filter((c) => contractMatchesScope(c, scope)),
    ),
  ]);

  const samplePolicy = contracts.find((c) => c.status === "active")?.policy ?? contracts[0]?.policy;
  const anticipation = samplePolicy?.arrivalAnticipationMinutes ?? 15;

  const scopeHidden =
    scope.kind === "plant" ? (
      <input type="hidden" name="plantId" value={scope.plantId} />
    ) : (
      <input type="hidden" name="plantGroupId" value={scope.plantGroupId} />
    );

  const rutasHref = unitConfigStepHrefFor(unit, client.slug, "rutas");

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <UnitShell
          client={client}
          unit={unit}
          title={`Turnos — ${operationalUnitLabel(unit)}`}
          step="turnos"
        />

        <p className="text-sm text-[var(--muted)]">
          Los turnos son los horarios de entrada del personal en{" "}
          <span className="text-white">{operationalUnitLabel(unit)}</span>. Después defines la{" "}
          <span className="text-white">trayectoria (ruta)</span> vinculada a cada turno.
        </p>

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

        <Card title="Cómo encaja en el flujo">
          <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--muted)]">
            <li>
              <span className="text-white">Geocercas</span> — destino / fin de la ruta.
            </li>
            <li>
              <span className="text-white">Turnos</span> — horarios de entrada (este paso).
            </li>
            <li>
              <span className="text-white">Rutas</span> — trazado KML por turno. Riveras 7 turno 1 ≠
              turno 2.
            </li>
            <li>
              <span className="text-white">Perfiles</span> — contrato + ruta + geocerca.
            </li>
          </ol>
        </Card>

        <Card title="Registrar turno">
          <p className="mb-3 text-sm text-[var(--muted)]">
            Un turno es la hora en que entra el personal. La ruta que debe cumplirse es{" "}
            <span className="text-white">turno + trazado KML</span>.
          </p>
          <form action="/api/cliente/turnos" method="post" className="space-y-3">
            <input type="hidden" name="clientSlug" value={client.slug} />
            {scopeHidden}
            <input type="hidden" name="action" value="shift" />
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                Nombre del turno
                <input name="name" required className={inputClass} placeholder="Ej. Entrada 7:00" />
              </label>
              <label className={labelClass}>
                Hora de inicio (cuándo entra el personal)
                <input name="startTime" required type="time" className={inputClass} defaultValue="07:00" />
              </label>
            </div>
            <p className="text-xs text-[var(--muted)]">
              El deadline (llegada a geocerca) = esta hora − anticipación del contrato (
              {anticipation} min por defecto).
            </p>
            <button type="submit" className={btnClass}>
              Registrar turno
            </button>
          </form>
        </Card>

        <Card title={`Turnos registrados — ${operationalUnitLabel(unit)}`}>
          {shifts.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {shifts.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded border border-white/5 px-2 py-1.5"
                >
                  <span>{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--muted)]">inicio {fmtTime(s.startTime)}</span>
                    <ConfirmForm
                      action="/api/cliente/turnos"
                      method="post"
                      confirmMessage={confirmMessages.deleteShift(s.name, fmtTime(s.startTime))}
                    >
                      <input type="hidden" name="clientSlug" value={client.slug} />
                      {scopeHidden}
                      <input type="hidden" name="action" value="deleteShift" />
                      <input type="hidden" name="shiftId" value={s.id} />
                      <button
                        type="submit"
                        className="rounded border border-red-500/30 px-2 py-0.5 text-xs text-red-200 hover:border-red-400"
                      >
                        Eliminar
                      </button>
                    </ConfirmForm>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Sin turnos todavía. Registra al menos uno antes de crear rutas.
            </p>
          )}
          {shifts.length > 0 ? (
            <p className="mt-4 text-sm">
              <Link href={rutasHref} className="text-[var(--accent)]">
                Siguiente: crear rutas →
              </Link>
            </p>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
