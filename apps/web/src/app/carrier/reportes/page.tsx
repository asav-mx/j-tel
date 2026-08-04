import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

export default async function CarrierReportesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se renderiza. Va en la PÁGINA y no solo en el layout:
  // un redirect de layout no impide que la hija se renderice, y su payload
  // viaja igual en la respuesta (regla 7 del plan).
  await exigirSesion();

  const carrier = await resolveAccountByType("carrier", searchParams);
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav
          title="Reportes al cliente"
          links={[{ href: withAccount("/carrier", carrier?.slug), label: "← Panel" }]}
        />
        <Card title="Entregables contractuales">
          <ul className="list-inside list-disc space-y-2 text-sm text-[var(--muted)]">
            <li>Reporte GPS mensual</li>
            <li>Distancia por unidad</li>
            <li>Cargos por ruta</li>
            <li>Lista de choferes</li>
            <li>Reporte de mantenimiento mensual</li>
          </ul>
          <p className="mt-4 text-sm">
            Generados desde los mismos hechos de cumplimiento — el carrier no recalcula verdad.
          </p>
        </Card>
      </div>
    </main>
  );
}
