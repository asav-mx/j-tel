import Link from "next/link";
import { redirect } from "next/navigation";
import { CorporateShell } from "@/components/unit-shell";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { operationalUnitLabel } from "@/lib/operational-scope";
import { unitDashboardHref } from "@/lib/unit-routes";
import { getVisibleOperationalUnits } from "@/lib/alcance-cliente";

export const dynamic = "force-dynamic";

export default async function ClienteDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;

  const client = await resolveAccountByType("client", searchParams);

  if (!client) {
    return (
      <main className="p-8">
        <p>No hay cuentas cliente. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const units = await getVisibleOperationalUnits(client);

  // Una sola planta o campus: se entra directo, sin pedir que se escoja.
  if (!error && units.length === 1) {
    redirect(unitDashboardHref(units[0], client.slug));
  }

  return (
    <main className="min-h-screen bg-[var(--fondo)] p-6 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <CorporateShell client={client} title={client.name} />

        {error ? (
          <div className="rounded-sm border border-[var(--rojo)]/30 bg-[var(--rojo)]/10 p-4 text-sm text-[var(--texto)]">
            {error}
          </div>
        ) : null}

        <p className="text-sm text-[var(--tenue)]">Tus plantas y campus.</p>

        {units.length === 0 ? (
          <div className="rounded-sm border border-[var(--linea)] bg-[var(--panel)] p-6">
            <p className="text-sm text-[var(--texto)]">
              Sin plantas ni campus todavía.{" "}
              <Link
                href={withAccount("/cliente/plantas", client.slug)}
                className="text-[var(--azul)]"
              >
                Crear la primera
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--linea)] rounded-sm border border-[var(--linea)] bg-[var(--panel)]">
            {units.map((unit) => (
              <li key={`${unit.kind}-${unit.id}`}>
                <Link
                  href={unitDashboardHref(unit, client.slug)}
                  className="flex items-center justify-between px-5 py-4 transition hover:bg-white/[0.03]"
                >
                  <div>
                    <p
                      className="text-[11px] uppercase tracking-[.13em] text-[var(--tenue)]"
                      style={{ fontFamily: "var(--fuente-mono)" }}
                    >
                      {unit.kind === "plant_group" ? "Campus" : "Planta"}
                    </p>
                    <p className="text-[15px] text-[var(--texto)]">{operationalUnitLabel(unit)}</p>
                  </div>
                  <span className="text-[var(--tenue)]">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href={withAccount("/cliente/plantas", client.slug)}
            className="text-[var(--azul)] hover:underline"
          >
            Administrar plantas →
          </Link>
          <Link
            href={withAccount("/cliente/reportes", client.slug)}
            className="text-[var(--azul)] hover:underline"
          >
            Reportes corporativos →
          </Link>
        </div>
      </div>
    </main>
  );
}
