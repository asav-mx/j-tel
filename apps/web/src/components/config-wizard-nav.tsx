import Link from "next/link";
import { CONFIG_STEPS, type ConfigStepId, configHubHref, configStepHref } from "@/lib/config-wizard";

export function ConfigWizardNav({
  clientSlug,
  current,
}: {
  clientSlug: string;
  current: ConfigStepId;
}) {
  return (
    <nav
      aria-label="Pasos de configuración"
      className="mb-6 rounded-xl border border-[var(--linea)] bg-black/20 p-3"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>Guía de configuración</span>
        <Link href={configHubHref(clientSlug)} className="text-[var(--accent)] hover:underline">
          Ver resumen →
        </Link>
      </div>
      <ol className="flex flex-wrap gap-2">
        {CONFIG_STEPS.map((step) => {
          const active = step.id === current;
          return (
            <li key={step.id}>
              <Link
                href={configStepHref(clientSlug, step.id)}
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
