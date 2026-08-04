import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

export default async function CarrierCombustiblePage({
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
          title="Combustible / Diésel"
          links={[{ href: withAccount("/carrier", carrier?.slug), label: "← Panel" }]}
        />
        <Card title="Captura manual v1">
          <p className="text-sm text-[var(--muted)]">
            Registros de combustible para {carrier?.name ?? "carrier"}. Telemetría automática en
            versión futura.
          </p>
          <p className="mt-4 text-sm">
            Use la API de flota o el seed de demo para registrar cargas de combustible.
          </p>
        </Card>
      </div>
    </main>
  );
}
