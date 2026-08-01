import type { OperationalUnit } from "@jtel/domain";
import { NavLateral, type GrupoNav } from "@/components/nav-lateral";
import { MarcoPlataforma } from "@/components/marco-plataforma";
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

/**
 * Las secciones de una unidad operativa, agrupadas por naturaleza.
 *
 * Dos etiquetas no coinciden con su ruta a propósito, porque el vocabulario se
 * congeló después de que se escribieron esas rutas: `Inicio` vive en
 * `/` de la unidad (Ficha-Inicio-Dos-Caras) y `Oficina` en `/configuracion`
 * (Ficha-Oficina-Contrato). Cambia el nombre, no el destino.
 */
export function gruposUnidad(
  unit: OperationalUnit,
  clientSlug: string,
  _clientName: string,
): GrupoNav[] {
  const base = unitBasePath(unit);

  const operacion = [
    { href: unitDashboardHref(unit, clientSlug), label: "Inicio" },
    { href: withAccount(`${base}/monitoreo`, clientSlug), label: "Monitoreo" },
    { href: withAccount(`${base}/cierre`, clientSlug), label: "Cierre del turno" },
    { href: unitComplianceHref(unit, clientSlug), label: "Cumplimiento" },
  ];
  // Cara planta únicamente por ahora — campus no tiene esta ruta todavía.
  if (unit.kind === "plant") {
    operacion.push({
      href: withAccount(`${base}/pendiente-por-evidencia`, clientSlug),
      label: "Pendiente por evidencia",
    });
  }

  return [
    { titulo: "Operación", renglones: operacion },
    {
      titulo: "Contrato",
      renglones: [
        { href: unitContratosHref(unit, clientSlug), label: "Contratos" },
        { href: unitConfigHubHref(unit, clientSlug), label: "Oficina" },
      ],
    },
    {
      titulo: "Vistas",
      renglones: [
        { href: withAccount("/cliente/notificaciones", clientSlug), label: "Notificaciones" },
      ],
    },
  ];
}

export function UnitShell({
  client,
  unit,
  title,
  contexto,
  accion,
  step,
  children,
}: {
  client: { slug: string; name: string };
  unit: OperationalUnit;
  title?: string;
  contexto?: React.ReactNode;
  accion?: React.ReactNode;
  step?: UnitConfigStepId;
  children?: React.ReactNode;
}) {
  const unitLabel = operationalUnitLabel(unit);
  const heading = title ?? unitLabel;
  const etiquetaUnidad = `${unit.kind === "plant_group" ? "Campus" : "Planta"}: ${unitLabel}`;

  return (
    <MarcoPlataforma
      titulo={heading}
      /*
       * Sin contexto por defecto: la nav ya dice dónde estás parado, y
       * repetirlo debajo del título lo dice dos veces en la misma pantalla.
       * Queda disponible para lo que sí sitúa a esta pantalla en particular —
       * el turno vigente y su deadline, en Monitoreo.
       */
      contexto={contexto}
      accion={accion}
      nav={
        <NavLateral
          cuenta={client}
          grupos={gruposUnidad(unit, client.slug, client.name)}
          raiz={unitBasePath(unit)}
          contexto={etiquetaUnidad}
          regreso={{ href: withAccount("/cliente", client.slug), label: client.name }}
        />
      }
    >
      {step ? <UnitConfigWizardNav clientSlug={client.slug} unit={unit} current={step} /> : null}
      {children}
    </MarcoPlataforma>
  );
}

export function gruposCorporativos(clientSlug: string): GrupoNav[] {
  return [
    {
      titulo: "Operación",
      renglones: [
        // En corporativo la lista de unidades ES la pantalla de inicio: un
        // renglón "Unidades" que no lleva a otro lado confunde.
        { href: withAccount("/cliente", clientSlug), label: "Inicio" },
        { href: withAccount("/cliente/plantas", clientSlug), label: "Administrar plantas" },
      ],
    },
    {
      titulo: "Vistas",
      renglones: [
        { href: withAccount("/cliente/reportes", clientSlug), label: "Reportes" },
        { href: withAccount("/cliente/notificaciones", clientSlug), label: "Notificaciones" },
      ],
    },
  ];
}

export function CorporateShell({
  client,
  title,
  contexto,
  accion,
  children,
}: {
  client: { slug: string; name: string };
  title: string;
  contexto?: React.ReactNode;
  accion?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <MarcoPlataforma
      titulo={title}
      contexto={contexto}
      accion={accion}
      nav={
        <NavLateral
          cuenta={client}
          grupos={gruposCorporativos(client.slug)}
          raiz="/cliente"
          contexto="Panorama corporativo"
        />
      }
    >
      {children}
    </MarcoPlataforma>
  );
}
