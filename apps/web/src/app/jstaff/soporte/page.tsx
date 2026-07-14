import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { PurgePlantForm } from "@/components/purge-plant-form";
import { PurgeProfileForm } from "@/components/purge-profile-form";
import { AppNav, Card } from "@/components/ui";
import { DateRangeFilter } from "@/components/date-range-filter";
import { confirmMessages } from "@/lib/confirm-messages";
import {
  inServiceDateRange,
  resolveDateRange,
} from "@/lib/date-range";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm";

export default async function JStaffSoportePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const resync = typeof sp?.resync === "string" ? sp.resync : null;
  const reverify = typeof sp?.reverify === "string" ? sp.reverify : null;
  const purge = typeof sp?.purge === "string" ? sp.purge : null;
  const purgeOne = typeof sp?.purge_one === "string" ? sp.purge_one : null;
  const status = typeof sp?.status === "string" ? sp.status : null;
  const day = typeof sp?.day === "string" ? sp.day : null;
  const n = typeof sp?.n === "string" ? sp.n : null;
  const summary = typeof sp?.summary === "string" ? sp.summary : null;
  const purgedPlant = typeof sp?.plant === "string" ? sp.plant : null;
  const purgedProfiles = typeof sp?.profiles === "string" ? sp.profiles : null;
  const purgedOccs = typeof sp?.occs === "string" ? sp.occs : null;
  const purgedGeofences = typeof sp?.geofences === "string" ? sp.geofences : null;
  const purgedOneCode = typeof sp?.code === "string" ? sp.code : null;
  const purgedOneName = typeof sp?.name === "string" ? sp.name : null;
  const purgedOneOccs = typeof sp?.occs === "string" ? sp.occs : null;

  const range = resolveDateRange(sp, { defaultDaysBack: 29 });

  const repos = getRepos();
  const pendingAll = await repos.occurrences.findPendingVerification(new Date());
  const pending = pendingAll
    .filter((row) =>
      inServiceDateRange(String(row.occurrence.serviceDate), range.fromIso, range.toIso),
    )
    .sort((a, b) =>
      String(b.occurrence.serviceDate).localeCompare(String(a.occurrence.serviceDate)),
    );

  const clients = await repos.accounts.listByType("client");
  const contracts = [];
  const plants = [];
  for (const c of clients) {
    contracts.push(...(await repos.contracts.findForClient(c.id)));
    const clientPlants = await repos.clients.getPlantsForAccount(c.id);
    for (const p of clientPlants) {
      // Solo plantas independientes (no campus): ahí se generan perfiles “por planta”.
      if (!p.plantGroupId) {
        plants.push({ ...p, clientName: c.name, clientSlug: c.slug });
      }
    }
  }
  const activeContracts = contracts.filter(
    (c) => c.status === "active" || c.status === "demo",
  );

  const profilesForPurge: Array<{
    id: string;
    code: string;
    name: string;
    plantId: string;
    contractName: string;
    occurrenceCount: number;
  }> = [];
  for (const plant of plants) {
    const plantProfiles = await repos.profiles.listForPlant(plant.id);
    for (const p of plantProfiles) {
      profilesForPurge.push({
        id: p.id,
        code: p.code,
        name: p.name,
        plantId: plant.id,
        contractName: p.contract?.name ?? "—",
        occurrenceCount: p.occurrenceCount,
      });
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav title="Compuerta de atención" links={[{ href: "/jstaff", label: "← Panel" }]} />

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {resync === "ok" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Re-sync listo{status ? ` → ${status}` : ""}.
          </div>
        ) : null}
        {resync === "skip" ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            No se recalculó: el hecho ya está cerrado ({status ?? "cumplido/no_cumplido"}).
            Para reabrir un día cerrado usa «Re-verificar día» abajo.
          </div>
        ) : null}
        {reverify === "ok" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Día {day} re-verificado ({n} servicios). Resumen: {summary}.
          </div>
        ) : null}
        {purge === "ok" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Purga lista en planta {purgedPlant}: {purgedProfiles} perfiles, {purgedOccs}{" "}
            ocurrencias, {purgedGeofences} geocercas huérfanas.
          </div>
        ) : null}
        {purgeOne === "ok" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Perfil borrado: {purgedOneCode}
            {purgedOneName ? ` («${purgedOneName}»)` : ""} · {purgedOneOccs ?? "0"} ocurrencias.
          </div>
        ) : null}

        <Card title="Re-verificar un día (con política actual)">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Usa esto cuando cambiaste la política y quieres recalcular un día ya cerrado.
            <span className="text-white"> Sí sobrescribe</span> cumplido / no cumplido de esa
            fecha. Puede tardar 1–2 minutos.
          </p>
          <ConfirmForm
            action="/api/jstaff/reverify-day"
            method="post"
            className="grid gap-3 md:grid-cols-2"
            confirmTemplate="¿Re-verificar {serviceDate} del contrato elegido con la política actual? Se recalcularán los hechos de ese día."
            pendingLabel="Re-verificando día… (puede tardar)"
          >
            <label className="block text-sm">
              Contrato
              <select name="contractId" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Elige contrato…
                </option>
                {activeContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Fecha
              <input name="serviceDate" type="date" required className={inputClass} />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
              >
                Re-verificar día
              </button>
            </div>
          </ConfirmForm>
        </Card>

        <Card title="Borrar basura de prueba">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Desde el cliente no se puede eliminar un perfil que ya tiene ocurrencias (el botón
            «Eliminar» desaparece). Aquí sí: un perfil, o toda la planta.
            Si solo confundiste la geocerca, usa Configuración → Perfiles → «Aplicar a todos».
          </p>
          {plants.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No hay plantas independientes (sin campus) para purgar.
            </p>
          ) : (
            <div className="space-y-4">
              <PurgeProfileForm
                plants={plants.map((p) => ({
                  id: p.id,
                  code: p.code,
                  label: `${p.clientName} · ${p.name}`,
                }))}
                profiles={profilesForPurge}
              />
              <PurgePlantForm
                plants={plants.map((p) => ({
                  id: p.id,
                  code: p.code,
                  label: `${p.clientName} · ${p.name}`,
                }))}
              />
            </div>
          )}
        </Card>

        <Card title={`Pendientes de verificación — ${range.label} (${pending.length})`}>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Solo reintenta <span className="text-white">pendiente_evidencia</span>. Los hechos
            ya cerrados (cumplido / no cumplido) no se tocan aquí.
          </p>

          <div className="mb-4">
            <DateRangeFilter action="/jstaff/soporte" range={range} />
          </div>

          <ul className="space-y-2 text-sm">
            {pending.length === 0 ? (
              <li className="text-[var(--muted)]">
                Ninguna pendiente en este rango. Prueba ampliar Desde / Hasta.
              </li>
            ) : (
              pending.map((row) => (
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
                    pendingLabel="Verificando…"
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
