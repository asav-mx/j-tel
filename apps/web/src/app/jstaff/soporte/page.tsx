import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { AppNav, Card } from "@/components/ui";
import { confirmMessages } from "@/lib/confirm-messages";

export const dynamic = "force-dynamic";

export default async function JStaffSoportePage() {
  const repos = getRepos();
  const pending = await repos.occurrences.findPendingVerification(new Date());

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <AppNav title="Compuerta de atención" links={[{ href: "/jstaff", label: "← Panel" }]} />
        <Card title="Diagnóstico sin alterar la verdad">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Acciones permitidas: re-sync evidencia, marcar excusable, escalar. Toda acción queda en
            el ledger. Los hechos materializados no se sobrescriben.
          </p>
          <h3 className="mb-2 font-medium">Ocurrencias pendientes de verificación</h3>
          <ul className="space-y-2 text-sm">
            {pending.length === 0 ? (
              <li className="text-[var(--muted)]">Ninguna pendiente en este momento.</li>
            ) : (
              pending.slice(0, 20).map((row) => (
                <li key={row.occurrence.id} className="rounded border border-white/5 p-3">
                  <p>
                    {row.occurrence.serviceDate} · contrato {row.contract.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Evidencia: {row.trip.evidenceStatus} · Viaje {row.trip.id}
                  </p>
                  <ConfirmForm
                    action={`/api/occurrences/${row.occurrence.id}/verify`}
                    method="post"
                    confirmMessage={confirmMessages.verifyOccurrence(
                      row.occurrence.serviceDate,
                      row.contract.name,
                    )}
                  >
                    <button type="submit" className="mt-2 text-xs text-[var(--accent)]">
                      Re-sync / verificar
                    </button>
                  </ConfirmForm>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </main>
  );
}
