import Link from "next/link";
import { UNIT_CONFIG_STEPS, type UnitConfigStepId, unitConfigHubHrefFor, unitConfigStepHrefFor } from "@/lib/config-wizard";
import type { OperationalUnit } from "@jtel/domain";
import { unitContratosHref } from "@/lib/unit-routes";

const mono = "font-[family-name:var(--fuente-mono)]";

/**
 * Los pasos de la configuración de una unidad. Sale en las cuatro subrutas, así
 * que es la pieza que más veces se ve de toda la oficina.
 *
 * El paso donde estás va en acero —el color de lo medido, y aquí lo más
 * parecido a "esto es lo que tienes enfrente"—, nunca en el azul relleno de
 * antes: un bloque sólido de color de acción compitiendo con el contenido de la
 * pantalla. Los pasos se leen como una regla graduada, no como botonera.
 */
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
      className="mb-6 rounded-lg border border-[var(--linea)] bg-[var(--panel2)] p-3"
    >
      <div
        className={`mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] tracking-[.1em] uppercase ${mono} text-[var(--tenue)]`}
      >
        <span>Configuración de este sitio</span>
        <span className="flex flex-wrap gap-3 tracking-normal normal-case">
          <Link
            href={unitContratosHref(unit, clientSlug)}
            className="text-[var(--azul)] hover:underline"
          >
            Contrato
          </Link>
          <Link
            href={unitConfigHubHrefFor(unit, clientSlug)}
            className="text-[var(--azul)] hover:underline"
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
                aria-current={active ? "step" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1 text-[13px] ${
                  active
                    ? "border-[var(--b-acero)] bg-[var(--t-acero)] font-medium text-[var(--acero)]"
                    : "border-[var(--linea)] text-[var(--tenue)] hover:border-[var(--azul)] hover:text-[var(--azul)]"
                }`}
              >
                <span className={`text-[11px] ${mono} opacity-70`}>{step.n}.</span>
                {step.title}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
