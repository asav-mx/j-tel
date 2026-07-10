import Link from "next/link";
import type { OperationalUnit } from "@jtel/domain";
import { AppNav } from "@/components/ui";
import { ClientAccountSwitcher } from "@/components/account-switcher";
import { UnitConfigWizardNav } from "@/components/unit-config-wizard-nav";
import { withAccount } from "@/lib/account-context";
import { operationalUnitLabel } from "@/lib/operational-scope";
import {
  unitBasePath,
  unitComplianceHref,
  unitConfigHubHref,
  unitContratosHref,
  unitDashboardHref,
} from "@/lib/unit-routes";
import type { UnitConfigStepId } from "@/lib/config-wizard";

export function unitNavLinks(unit: OperationalUnit, clientSlug: string, clientName: string) {
  const dash = unitDashboardHref(unit, clientSlug);
  return [
    { href: dash, label: "Panel" },
    { href: unitComplianceHref(unit, clientSlug), label: "Cumplimiento" },
    { href: unitConfigHubHref(unit, clientSlug), label: "Configuración" },
    { href: unitContratosHref(unit, clientSlug), label: "Contratos" },
    { href: withAccount("/cliente/notificaciones", clientSlug), label: "Notificaciones" },
    { href: withAccount("/cliente", clientSlug), label: `← ${clientName}` },
  ];
}

export function UnitShell({
  client,
  unit,
  title,
  step,
  children,
}: {
  client: { slug: string; name: string };
  unit: OperationalUnit;
  title?: string;
  step?: UnitConfigStepId;
  children?: React.ReactNode;
}) {
  const unitLabel = operationalUnitLabel(unit);
  const heading = title ?? unitLabel;

  return (
    <>
      <AppNav title={heading} links={unitNavLinks(unit, client.slug, client.name)} />
      <ClientAccountSwitcher
        currentSlug={client.slug}
        basePath={unitBasePath(unit)}
      />
      <p className="mb-4 text-sm text-[var(--muted)]">
        {client.name} ·{" "}
        <span className="text-white">
          {unit.kind === "plant_group" ? "Campus: " : "Planta: "}
          {unitLabel}
        </span>
      </p>
      {step ? <UnitConfigWizardNav clientSlug={client.slug} unit={unit} current={step} /> : null}
      {children}
    </>
  );
}

export function CorporateNavLinks(clientSlug: string) {
  return [
    { href: withAccount("/cliente", clientSlug), label: "Unidades" },
    { href: withAccount("/cliente/plantas", clientSlug), label: "Administrar plantas" },
    { href: withAccount("/cliente/reportes", clientSlug), label: "Reportes" },
    { href: withAccount("/cliente/notificaciones", clientSlug), label: "Notificaciones" },
  ];
}

export function CorporateShell({
  client,
  title,
  children,
}: {
  client: { slug: string; name: string };
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <AppNav title={title} links={CorporateNavLinks(client.slug)} />
      <ClientAccountSwitcher currentSlug={client.slug} basePath="/cliente" />
      {children}
    </>
  );
}
