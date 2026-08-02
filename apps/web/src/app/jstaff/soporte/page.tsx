import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { PurgePlantForm } from "@/components/purge-plant-form";
import { PurgeProfileForm } from "@/components/purge-profile-form";
import { ReverifyRangeForm } from "@/components/reverify-range-form";
import { AppNav, AvisoSistema, Card } from "@/components/ui";
import { DateRangeFilter } from "@/components/date-range-filter";
import { confirmMessages } from "@/lib/confirm-messages";
import {
  inServiceDateRange,
  resolveDateRange,
} from "@/lib/date-range";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-[var(--linea)] bg-black/20 p-2 text-sm";

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

  let loadError: string | null = null;
  let pending: Awaited<
    ReturnType<ReturnType<typeof getRepos>["occurrences"]["findPendingVerification"]>
  > = [];
  let activeContracts: Array<{
    id: string;
    name: string;
    plantLabel: string;
  }> = [];
  let plants: Array<{
    id: string;
    name: string;
    code: string;
    clientName: string;
  }> = [];
  let profilesForPurge: Array<{
    id: string;
    code: string;
    name: string;
    plantId: string;
    contractName: string;
    occurrenceCount: number;
  }> = [];

  try {
    const repos = getRepos();
    const pendingAll = await repos.occurrences.findPendingVerification(new Date());
    pending = pendingAll
      .filter((row) =>
        inServiceDateRange(String(row.occurrence.serviceDate), range.fromIso, range.toIso),
      )
      .sort((a, b) =>
        String(b.occurrence.serviceDate).localeCompare(String(a.occurrence.serviceDate)),
      );

    const clients = await repos.accounts.listByType("client");
    const contracts = [];
    for (const c of clients) {
      contracts.push(...(await repos.contracts.findForClient(c.id)));
      const clientPlants = await repos.clients.getPlantsForAccount(c.id);
      for (const p of clientPlants) {
        if (!p.plantGroupId) {
          plants.push({
            id: p.id,
            name: p.name,
            code: p.code,
            clientName: c.name,
          });
        }
      }
    }

    activeContracts = contracts
      .filter((c) => c.status === "active" || c.status === "demo")
      .map((c) => ({
        id: c.id,
        name: c.name,
        plantLabel: c.plant
          ? `${c.plant.name} (${c.plant.code})`
          : (c.plantGroup?.name ?? "—"),
      }));

    for (const plant of plants) {
      try {
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
      } catch (err) {
        console.error("[jstaff/soporte] listForPlant", plant.id, err);
      }
    }
  } catch (err) {
    console.error("[jstaff/soporte] load", err);
    loadError = err instanceof Error ? err.message : "Error al cargar soporte.";
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav title="Compuerta de atención" links={[{ href: "/jstaff", label: "← Panel" }]} />

        {error || loadError ? (
          <AvisoSistema lead="No se hizo.">{error ?? loadError}</AvisoSistema>
        ) : null}
        {resync === "ok" ? (
          <AvisoSistema lead="Re-sync listo.">{status ? `→ ${status}` : null}</AvisoSistema>
        ) : null}
        {resync === "skip" ? (
          <AvisoSistema lead="No se recalculó.">
            El hecho ya está cerrado ({status ?? "cumplido/no_cumplido"}). Para reabrir un día
            cerrado usa «Re-verificar» abajo.
          </AvisoSistema>
        ) : null}
        {reverify === "ok" ? (
          <AvisoSistema lead="Listo.">
            Día {day} re-verificado ({n} servicios). Resumen: {summary}.
          </AvisoSistema>
        ) : null}
        {purge === "ok" ? (
          <AvisoSistema lead="Purga lista.">
            Planta {purgedPlant}: {purgedProfiles} perfiles, {purgedOccs} ocurrencias,{" "}
            {purgedGeofences} geocercas huérfanas.
          </AvisoSistema>
        ) : null}
        {purgeOne === "ok" ? (
          <AvisoSistema lead="Perfil borrado.">
            {purgedOneCode}
            {purgedOneName ? ` («${purgedOneName}»)` : ""} · {purgedOneOccs ?? "0"} ocurrencias.
          </AvisoSistema>
        ) : null}

        <Card title="Re-verificar resultados (rango)">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Para después de corregir geocercas: recalcula cumplido / no cumplido con la geocerca
            actual, <span className="text-[var(--texto)]">día por día</span>, sin volver a bajar GPS
            (más estable; evita el error 500 por tiempo). Ideal para Tecma 47.
          </p>
          {activeContracts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No hay contratos activos.</p>
          ) : (
            <ReverifyRangeForm
              contracts={activeContracts.map((c) => ({
                id: c.id,
                label: `${c.name} · ${c.plantLabel}`,
              }))}
            />
          )}
        </Card>

        <Card title="Re-verificar un solo día">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Misma lógica, una sola fecha. Usa evidencia guardada por defecto.
          </p>
          <ConfirmForm
            action="/api/jstaff/reverify-day"
            method="post"
            className="grid gap-3 md:grid-cols-2"
            confirmTemplate="¿Re-verificar {serviceDate} del contrato elegido? Se recalcularán los hechos de ese día con la geocerca/política actual."
            pendingLabel="Re-verificando día… (puede tardar)"
          >
            <input type="hidden" name="keepEvidence" value="1" />
            <label className="block text-sm">
              Contrato
              <select name="contractId" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Elige contrato…
                </option>
                {activeContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.plantLabel}
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
            Solo reintenta <span className="text-[var(--texto)]">pendiente_evidencia</span>. Los hechos
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
                <li key={row.occurrence.id} className="rounded border border-[var(--linea-tenue)] p-3">
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
