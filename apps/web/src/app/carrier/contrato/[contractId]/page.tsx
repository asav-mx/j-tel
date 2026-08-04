import { notFound } from "next/navigation";
import { CarrierShell } from "@/components/unit-shell";
import { ExpedienteContratoView } from "@/views/expediente-contrato";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { loadExpedienteContrato } from "@/lib/expediente-contrato-data";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

/**
 * El expediente del contrato, cara transportista.
 *
 * **Mismo contenido que ve el cliente**, con el mismo componente: es el
 * documento de la relación y una relación no tiene dos versiones. Lo único que
 * falta de este lado es la puerta a la Oficina —el auditado no edita las
 * reglas— y el enlace al expediente de ruta, que es pantalla de cliente.
 */
export default async function ExpedienteContratoCarrierPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se renderiza. Va en la PÁGINA y no solo en el layout:
  // un redirect de layout no impide que la hija se renderice, y su payload
  // viaja igual en la respuesta (regla 7 del plan).
  await exigirSesion();

  const { contractId } = await params;
  const cuenta = await resolveAccountByType("carrier", searchParams);
  if (!cuenta) {
    return (
      <main className="p-8">
        <p className="text-sm">Sin cuentas de transportista. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const d = await loadExpedienteContrato(cuenta, contractId);
  if (!d) notFound();

  const enlace = (ruta: string) => withAccount(ruta, cuenta.slug);

  return (
    <CarrierShell carrier={cuenta} title={`${cuenta.name} — ${d.contrato.nombre}`}>
      <ExpedienteContratoView
        d={d}
        enlace={enlace}
        // El expediente de ruta vive del lado cliente: desde aquí no se abre.
        rutaHref={null}
        hermanoHref={(id) => enlace(`/carrier/contrato/${id}`)}
      />
    </CarrierShell>
  );
}
