import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import {
  computeDayRecall,
  HORAS_FALLO_MUDO,
  explicarMotivo,
  type MotivoSinEvidencia,
} from "@jtel/services";
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

  /*
   * EL MOTOR, ANTES QUE LA INGESTA.
   *
   * Esta pantalla vigilaba marcas de agua, alertas y recall — todo sobre los
   * datos que ENTRAN— y nada sobre si el árbitro llegó a dictar con ellos. Por
   * eso ocho servicios de un cliente vivo pasaron 35 días sin veredicto con
   * todo en verde.
   *
   * Los dos conteos miden cosas distintas y por eso llevan umbrales distintos:
   * sin veredicto es una verificación que reventó (2 h, porque el camino sano
   * escribe en minutos); estancado es un pendiente que no se resuelve (48 h,
   * porque el archivador tarda un p95 de ~30 h en cubrir una ventana).
   */
  const HORAS_ESTANCADO = 48;
  const [fallosMudos, estancados, detalleEstancados, ultimoLatido, fallosRegistrados] =
    await Promise.all([
      repos.occurrences.contarFallosMudos(HORAS_FALLO_MUDO),
      repos.occurrences.contarPendientesEstancados(HORAS_ESTANCADO),
      repos.occurrences.listarPendientesEstancados(HORAS_ESTANCADO, 25),
      repos.compliance.ultimoLatidoDelMotor(),
      repos.compliance.listarFallosDeVerificacion(10),
    ]);

  const minutosSinLatido = ultimoLatido
    ? (Date.now() - ultimoLatido.getTime()) / 60_000
    : null;
  const un = (n: number) => n.toFixed(1);

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

        <Card title="El motor">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Si el árbitro llegó a dictar. Todo lo de abajo mide la ingesta —los datos que
            entran—; esto mide si alguien los está usando para sellar.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-[var(--linea-tenue)] p-3">
              <p className="font-[family-name:var(--fuente-mono)] text-2xl tabular-nums text-[var(--acero)]">
                {fallosMudos.total}
              </p>
              <p className="mt-1 text-sm">servicios vencidos SIN veredicto</p>
              <p className="mt-1 font-[family-name:var(--fuente-mono)] text-[11px] text-[var(--tenue)]">
                umbral {HORAS_FALLO_MUDO} h
                {fallosMudos.masAntiguoHoras != null
                  ? ` · el más viejo hace ${un(fallosMudos.masAntiguoHoras)} h`
                  : ""}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                No es &quot;sin evidencia&quot;: un servicio sin señal sí escribe su hecho.
                Cero hechos = la verificación reventó.
              </p>
            </div>

            <div className="rounded border border-[var(--linea-tenue)] p-3">
              <p className="font-[family-name:var(--fuente-mono)] text-2xl tabular-nums text-[var(--acero)]">
                {estancados.total}
              </p>
              <p className="mt-1 text-sm">pendientes sin resolver</p>
              <p className="mt-1 font-[family-name:var(--fuente-mono)] text-[11px] text-[var(--tenue)]">
                umbral {HORAS_ESTANCADO} h
                {estancados.masAntiguoHoras != null
                  ? ` · el más viejo hace ${un(estancados.masAntiguoHoras)} h`
                  : ""}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Los retirados por no tener evidencia posible no cuentan: salieron de la cola a
                propósito.
              </p>
            </div>

            <div className="rounded border border-[var(--linea-tenue)] p-3">
              <p className="font-[family-name:var(--fuente-mono)] text-2xl tabular-nums text-[var(--acero)]">
                {minutosSinLatido == null ? "—" : un(minutosSinLatido)}
              </p>
              <p className="mt-1 text-sm">min desde el último sello</p>
              <p className="mt-1 font-[family-name:var(--fuente-mono)] text-[11px] text-[var(--tenue)]">
                {ultimoLatido ? localDateTimeShort(ultimoLatido) : "sin sellos registrados"}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Actividad, NO latido del cron: el motor solo escribe cuando hay algo que
                sellar, así que el silencio es normal si no hay servicios vencidos. Que el
                cron esté vivo necesita su propia señal, y todavía no existe.
              </p>
            </div>
          </div>

          {detalleEstancados.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-[var(--azul)]">
                Por qué siguen pendientes · {detalleEstancados.length} de {estancados.total},
                los más viejos
              </summary>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Interno. El motivo distingue lo que se arregla esperando de lo que no. La
                planta no lo ve: para ella el resultado es pendiente por evidencia y nada más.
              </p>
              <ul className="mt-2 space-y-1">
                {detalleEstancados.map((e) => (
                  <li
                    key={e.occurrenceId}
                    className="rounded border border-[var(--linea-tenue)] p-2 text-xs"
                  >
                    <Link
                      href={`/jstaff/diagnostico/${e.occurrenceId}`}
                      className="font-[family-name:var(--fuente-mono)] text-[var(--azul)]"
                    >
                      {e.serviceDate}
                    </Link>{" "}
                    <span className="text-[var(--muted)]">
                      · {e.contrato} · {e.intentos} intentos
                    </span>
                    <p className="mt-1 text-[var(--tenue)]">
                      {e.motivo
                        ? explicarMotivo(e.motivo as MotivoSinEvidencia)
                        : "El motor no dejó motivo escrito para este servicio."}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {fallosRegistrados.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-[var(--azul)]">
                Verificaciones que reventaron ({fallosRegistrados.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {fallosRegistrados.map((f) => (
                  <li key={f.id} className="text-xs text-[var(--muted)]">
                    <span className="font-[family-name:var(--fuente-mono)] text-[var(--tenue)]">
                      {localDateTimeShort(f.createdAt)}
                    </span>{" "}
                    · {f.tipo ?? "error"} · {(f.error ?? "").slice(0, 120)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card title="Salud de ingesta">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Heartbeat: si no entran puntos en &gt;15 min en horario operativo, se crea alerta{" "}
            <code>heartbeat_stale</code>.
          </p>
          <ul className="space-y-2 text-sm">
            {healthRows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap justify-between gap-2 rounded border border-[var(--linea-tenue)] p-3"
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
                  className="rounded border border-[var(--linea-tenue)] p-3"
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
                className="mt-1 w-full rounded border border-[var(--linea)] bg-black/40 px-3 py-2"
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
                className="mt-1 w-full rounded border border-[var(--linea)] bg-black/40 px-3 py-2"
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
                className="mt-1 w-full rounded border border-[var(--linea)] bg-black/40 px-3 py-2"
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
