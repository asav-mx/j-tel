import Link from "next/link";
import { UNIT_CONFIG_STEPS, type UnitConfigStepId, unitConfigHubHrefFor, unitConfigStepHrefFor } from "@/lib/config-wizard";
import type { OperationalUnit } from "@jtel/domain";
import { unitContratosHref } from "@/lib/unit-routes";

export function UnitConfigWizardNav({
  clientSlug,
  unit,
  current,
}: {
  clientSlug: string;
  unit: OperationalUnit;
  current: UnitConfigStepId;
}) {
  return (
    <nav
      aria-label="Pasos de configuración"
      className="mb-6 rounded-xl border border-[var(--linea)] bg-black/20 p-3"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>Configuración de esta unidad</span>
        <span className="flex flex-wrap gap-3">
          <Link
            href={unitContratosHref(unit, clientSlug)}
            className="text-[var(--accent)] hover:underline"
          >
            Contratos
          </Link>
          <Link
            href={unitConfigHubHrefFor(unit, clientSlug)}
            className="text-[var(--accent)] hover:underline"
          >
            Ver resumen →
          </Link>
        </span>
      </div>
      <ol className="flex flex-wrap gap-2">
        {UNIT_CONFIG_STEPS.map((step) => {
          const active = step.id === current;
          return (
            <li key={step.id}>
              <Link
                href={unitConfigStepHrefFor(unit, clientSlug, step.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
                  active
                    ? "bg-[var(--accent)] font-medium text-black"
                    : "border border-[var(--linea)] hover:border-[var(--accent)]"
                }`}
              >
                <span className="text-xs opacity-80">{step.n}.</span>
                {step.title}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
