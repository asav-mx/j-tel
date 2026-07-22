import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { computeDayRecall } from "@jtel/services";
import { localDateTimeShort } from "@jtel/domain";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JStaffVerificacionPage() {
  const repos = getRepos();
  const carriers = await repos.accounts.listByType("carrier");
  const watermarks = await repos.telemetry.listWatermarks();
  const wmByCarrier = new Map(watermarks.map((w) => [w.carrierAccountId, w]));
  const unresolved = await repos.ingestAlerts.listUnresolved(20);
  const recentAlerts = await repos.ingestAlerts.listRecent(15);
  const groundTruth = await repos.groundTruth.listRecent(20);

  const clients = await repos.accounts.listByType("client");
  const contracts = [];
  for (const c of clients) {
    contracts.push(...(await repos.contracts.findForClient(c.id)));
  }

  const recallRows = [];
  for (const gt of groundTruth.slice(0, 10)) {
    const contract = contracts.find((c) => c.id === gt.contractId);
    const metrics = await computeDayRecall(repos, gt.contractId, gt.serviceDate);
    recallRows.push({
      ...metrics,
      serviceDate: gt.serviceDate,
      contractName: contract?.name ?? gt.contractId.slice(0, 8),
      expectedAllCumplido: gt.expectedAllCumplido,
    });
  }

  const now = Date.now();
  const healthRows = await Promise.all(
    carriers.map(async (carrier) => {
      const wm = wmByCarrier.get(carrier.id);
      const ageMin = wm
        ? Math.round((now - wm.lastRecordedAt.getTime()) / 60_000)
        : null;
      const latestAge = await repos.telemetry.latestPointAgeMinutes(carrier.id);
      const pointsLastHour = await repos.telemetry.countPointsSince(
        carrier.id,
        new Date(now - 60 * 60_000),
      );
      return {
        id: carrier.id,
        name: carrier.name,
        watermarkAgeMinutes: ageMin,
        latestPointAgeMinutes: latestAge != null ? Math.round(latestAge) : null,
        pointsLastHour,
      };
    }),
  );

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <AppNav
          title="Verificación — salud y recall"
          links={[
            { href: "/jstaff", label: "← Panel" },
            { href: "/jstaff/soporte", label: "Soporte" },
          ]}
        />

        <Card title="Salud de ingesta">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Heartbeat: si no entran puntos en &gt;15 min en horario operativo, se crea alerta{" "}
            <code>heartbeat_stale</code>.
          </p>
          <ul className="space-y-2 text-sm">
            {healthRows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap justify-between gap-2 rounded border border-white/5 p-3"
              >
                <span>{r.name}</span>
                <span className="text-[var(--muted)]">
                  watermark {r.watermarkAgeMinutes ?? "—"} min · último punto{" "}
                  {r.latestPointAgeMinutes ?? "—"} min · {r.pointsLastHour} pts/h
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Alertas abiertas (${unresolved.length})`}>
          {unresolved.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Ninguna alerta abierta.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {unresolved.map((a) => (
                <li key={a.id} className="rounded border border-red-500/30 p-3">
                  <p className="font-medium">
                    {a.kind} · {a.severity}
                  </p>
                  <p className="text-[var(--muted)]">{a.message}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {a.createdAt ? localDateTimeShort(a.createdAt) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {recentAlerts.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-[var(--muted)]">Historial reciente</summary>
              <ul className="mt-2 space-y-1">
                {recentAlerts.map((a) => (
                  <li key={a.id} className="text-xs text-[var(--muted)]">
                    {a.resolvedAt ? "✓" : "!"} {a.kind}: {a.message.slice(0, 80)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card title="Recall vs ground truth">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Recall = cumplido / (cumplido + no_cumplido).{" "}
            <code>pendiente_evidencia</code> no cuenta como error de veredicto.
          </p>
          {recallRows.length === 0 ? (
            <p className="mb-4 text-sm text-[var(--muted)]">
              Aún no hay días de ground truth. Registra uno abajo.
            </p>
          ) : (
            <ul className="mb-6 space-y-2 text-sm">
              {recallRows.map((r) => (
                <li
                  key={`${r.contractName}-${r.serviceDate}`}
                  className="rounded border border-white/5 p-3"
                >
                  <p className="font-medium">
                    {r.contractName} · {r.serviceDate}
                  </p>
                  <p className="text-[var(--muted)]">
                    {r.cumplido}/{r.total} cumplido · {r.noCumplido} no_cumplido ·{" "}
                    {r.pendienteEvidencia} pendiente · recall{" "}
                    {r.recall == null ? "—" : `${(r.recall * 100).toFixed(0)}%`}
                    {r.expectedAllCumplido
                      ? ` · FN=${r.falseNegatives}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <form action="/api/jstaff/ground-truth" method="post" className="grid gap-3 text-sm md:grid-cols-2">
            <label className="block">
              <span className="text-[var(--muted)]">Contrato</span>
              <select
                name="contractId"
                required
                className="mt-1 w-full rounded border border-white/10 bg-black/40 px-3 py-2"
                defaultValue=""
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[var(--muted)]">Fecha (YYYY-MM-DD)</span>
              <input
                name="serviceDate"
                type="date"
                required
                className="mt-1 w-full rounded border border-white/10 bg-black/40 px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 md:col-span-2">
              <input type="checkbox" name="expectedAllCumplido" value="true" defaultChecked />
              Esperado: 100% cumplido (verdad de campo del operador)
            </label>
            <label className="block md:col-span-2">
              <span className="text-[var(--muted)]">Notas</span>
              <input
                name="notes"
                className="mt-1 w-full rounded border border-white/10 bg-black/40 px-3 py-2"
                placeholder="p.ej. operador confirma que todos los servicios salieron"
              />
            </label>
            <input type="hidden" name="recordedBy" value="jstaff" />
            <button
              type="submit"
              className="rounded bg-[var(--accent)] px-4 py-2 font-medium text-black md:col-span-2 md:w-fit"
            >
              Registrar ground truth
            </button>
          </form>
        </Card>

        <p className="text-xs text-[var(--muted)]">
          Cron: <Link href="/api/cron/ingest-heartbeat">/api/cron/ingest-heartbeat</Link> cada 5
          min (Bearer CRON_SECRET).
        </p>
      </div>
    </main>
  );
}
