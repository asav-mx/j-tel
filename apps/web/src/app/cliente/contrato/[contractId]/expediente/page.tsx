import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/ui";
import { ExpedienteContratoView } from "@/views/expediente-contrato";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { loadExpedienteContrato } from "@/lib/expediente-contrato-data";

export const dynamic = "force-dynamic";

/**
 * El expediente del contrato, cara cliente.
 *
 * Es la misma vista que ve el transportista: el contenido no cambia entre las
 * dos partes, solo dónde vive. Esta cara además tiene la puerta a la Oficina,
 * porque el cliente es quien configura las reglas (ley 5).
 */
export default async function ExpedienteContratoClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { contractId } = await params;
  const cuenta = await resolveAccountByType("client", searchParams);
  if (!cuenta) {
    return (
      <main className="p-8">
        <p className="text-sm">Sin cuentas de cliente. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const d = await loadExpedienteContrato(cuenta, contractId);
  if (!d) notFound();

  const enlace = (ruta: string) => withAccount(ruta, cuenta.slug);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <AppNav
          title="Expediente del contrato"
          links={[
            { href: enlace("/cliente"), label: "Inicio" },
            { href: enlace("/cliente/configuracion/contratos"), label: "Contratos" },
          ]}
        />
        <nav className="font-[family-name:var(--fuente-mono)] text-[10.5px] text-[var(--tenue)]" aria-label="Migas">
          <Link
            href={enlace("/cliente/configuracion/contratos")}
            className="hover:text-[var(--azul)] hover:underline"
          >
            Contratos
          </Link>
          <span aria-hidden> › </span>
          <span className="text-[var(--texto)]">{d.contrato.nombre}</span>
        </nav>

        <ExpedienteContratoView
          d={d}
          enlace={enlace}
          rutaHref={(routeId) => enlace(`/cliente/ruta/${routeId}`)}
          hermanoHref={(id) => enlace(`/cliente/contrato/${id}/expediente`)}
        />
      </div>
    </main>
  );
}
