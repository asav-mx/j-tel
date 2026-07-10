import Link from "next/link";
import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { AppNav, Card } from "@/components/ui";
import { withAccount } from "@/lib/account-context";
import { confirmMessages } from "@/lib/confirm-messages";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

export default async function JStaffComercialPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const updated = typeof sp?.updated === "string" ? sp.updated : null;
  const clientSlug = typeof sp?.client === "string" ? sp.client : null;

  const repos = getRepos();
  const [clients, allCarriers] = await Promise.all([
    repos.accounts.listByType("client"),
    repos.accounts.listByType("carrier"),
  ]);

  const selectedClient = clientSlug
    ? clients.find((c) => c.slug === clientSlug) ?? null
    : clients[0] ?? null;

  const authorizations = selectedClient
    ? await repos.commercial.listForClient(selectedClient.id)
    : [];

  const authorizedIds = new Set(
    authorizations.filter((a) => a.status === "active").map((a) => a.carrierAccountId),
  );
  const availableCarriers = allCarriers.filter((c) => !authorizedIds.has(c.id));

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav
          title="Proceso comercial — Carriers autorizados"
          links={[
            { href: "/jstaff", label: "Panel" },
            { href: "/jstaff/cuentas", label: "Cuentas" },
            { href: "/jstaff/comercial", label: "Comercial" },
          ]}
        />

        <p className="text-sm text-[var(--muted)]">
          El catálogo completo de carriers es <span className="text-white">privado de J-Staff</span>.
          Aquí autorizas qué carriers puede contratar cada cliente (
          <span className="text-white">autorización active/suspended</span>
          ). Eso no activa el contrato: el contrato se crea en borrador y se activa en{" "}
          <span className="text-white">Contratos</span> de cada unidad operativa.
        </p>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {updated ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {updated === "autorizado"
              ? "Carrier autorizado para el cliente."
              : "Autorización suspendida."}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
          <span className="text-[var(--muted)]">Cliente:</span>
          {clients.length === 0 ? (
            <span className="text-[var(--muted)]">Sin clientes — créalos en Cuentas.</span>
          ) : (
            clients.map((c) => {
              const active = selectedClient?.id === c.id;
              return (
                <Link
                  key={c.id}
                  href={`/jstaff/comercial?client=${encodeURIComponent(c.slug)}`}
                  className={`rounded-full px-3 py-1 ${
                    active
                      ? "bg-[var(--accent)] font-medium text-black"
                      : "border border-white/10 hover:border-[var(--accent)]"
                  }`}
                >
                  {c.name}
                </Link>
              );
            })
          )}
        </div>

        {!selectedClient ? (
          <Card title="Elige un cliente">
            <p className="text-sm text-[var(--muted)]">Selecciona un cliente arriba.</p>
          </Card>
        ) : (
          <>
            <Card title={`Autorizar carrier — ${selectedClient.name}`}>
              {availableCarriers.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Todos los carriers registrados ya están autorizados para este cliente, o no hay
                  carriers en el catálogo.
                </p>
              ) : (
                <ConfirmForm
                  action="/api/jstaff/comercial"
                  method="post"
                  className="grid gap-3 md:grid-cols-2"
                  confirmTemplate={confirmMessages.authorizeCarrierTemplate(selectedClient.name)}
                >
                  <input type="hidden" name="action" value="authorize" />
                  <input type="hidden" name="clientSlug" value={selectedClient.slug} />
                  <label className={labelClass}>
                    Carrier del catálogo JTEL
                    <select name="carrierAccountId" required className={inputClass} defaultValue="">
                      <option value="" disabled>
                        Elige carrier…
                      </option>
                      {availableCarriers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.slug})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Notas (opcional)
                    <input
                      name="notes"
                      className={inputClass}
                      placeholder="Ej. Contrato marco 2026, zona Juárez"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <button type="submit" className={btnClass}>
                      Autorizar carrier
                    </button>
                  </div>
                </ConfirmForm>
              )}
            </Card>

            <Card title={`Carriers autorizados (${authorizations.filter((a) => a.status === "active").length})`}>
              {authorizations.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Este cliente aún no tiene carriers autorizados. No podrá crear contratos hasta que
                  J-Staff autorice al menos uno.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {authorizations.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/5 p-3"
                    >
                      <div>
                        <p className="font-medium">{a.carrier?.name ?? "—"}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {a.carrier?.slug ?? "—"} · {a.status}
                          {a.notes ? ` · ${a.notes}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={withAccount("/cliente", selectedClient.slug)}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:border-[var(--accent)]"
                        >
                          Unidades del cliente →
                        </Link>
                        {a.status === "active" ? (
                          <ConfirmForm
                            action="/api/jstaff/comercial"
                            method="post"
                            confirmMessage={confirmMessages.suspendCarrier(
                              a.carrier?.name ?? "—",
                              selectedClient.name,
                            )}
                          >
                            <input type="hidden" name="action" value="suspend" />
                            <input type="hidden" name="clientSlug" value={selectedClient.slug} />
                            <input type="hidden" name="carrierAccountId" value={a.carrierAccountId} />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-200 hover:border-red-400"
                            >
                              Suspender
                            </button>
                          </ConfirmForm>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
