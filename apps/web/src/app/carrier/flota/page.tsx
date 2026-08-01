import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-[var(--linea)] bg-black/20 p-2 text-sm placeholder:text-[var(--tenue)]";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

export default async function CarrierFlotaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const carrier = await resolveAccountByType("carrier", searchParams);

  if (!carrier) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-5xl">
          <AppNav title="Gestión de flota" links={[{ href: "/carrier", label: "← Panel" }]} />
          <Card title="Sin carrier">
            <p className="text-sm text-[var(--muted)]">
              No hay cuentas carrier. Crea una en J-Staff → Cuentas.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  const units = await repos.fleet.getUnitsForCarrier(carrier.id);
  const devices = await repos.fleet.getDevicesForCarrier(carrier.id);
  const assignments = await repos.fleet.getActiveAssignmentsForCarrier(carrier.id);

  const deviceByUnit = new Map(
    assignments.map((a) => [a.unitId, a.device] as const),
  );
  const assignedDeviceIds = new Set(assignments.map((a) => a.deviceId));
  const unassignedDevices = devices.filter((d) => !assignedDeviceIds.has(d.id));

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav
          title="Gestión de flota"
          links={[{ href: withAccount("/carrier", carrier.slug), label: "← Panel" }]}
        />

        <p className="text-sm text-[var(--muted)]">
          Carrier: <span className="text-[var(--texto)]">{carrier.name}</span>. Orden:{" "}
          <strong className="text-[var(--texto)]">1)</strong> registra la unidad →{" "}
          <strong className="text-[var(--texto)]">2)</strong> registra el GPS →{" "}
          <strong className="text-[var(--texto)]">3)</strong> asígnalos.
        </p>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="1. Nueva unidad">
            <form action="/api/carrier/units" method="post" className="space-y-3">
              <input type="hidden" name="carrierSlug" value={carrier.slug} />
              <label className={labelClass}>
                Número económico / nombre
                <input
                  name="label"
                  required
                  className={inputClass}
                  placeholder="Ej. 10249"
                />
              </label>
              <label className={labelClass}>
                Placa (opcional)
                <input
                  name="plateNumber"
                  className={inputClass}
                  placeholder="Ej. 39-AZA-93"
                />
              </label>
              <button type="submit" className={btnClass}>
                Registrar unidad
              </button>
            </form>
          </Card>

          <Card title="2. Nuevo GPS">
            <form action="/api/carrier/devices" method="post" className="space-y-3">
              <input type="hidden" name="carrierSlug" value={carrier.slug} />
              <label className={labelClass}>
                IMEI
                <input
                  name="imei"
                  required
                  className={inputClass}
                  placeholder="15 dígitos del dispositivo"
                />
              </label>
              <label className={labelClass}>
                Nombre / serie (opcional)
                <input
                  name="label"
                  className={inputClass}
                  placeholder="Ej. Serie F262525"
                />
              </label>
              <button type="submit" className={btnClass}>
                Registrar GPS
              </button>
            </form>
          </Card>

          <Card title="3. Asignar GPS → unidad">
            {units.length === 0 || devices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Primero registra al menos una unidad y un GPS.
              </p>
            ) : (
              <form action="/api/carrier/assign" method="post" className="space-y-3">
                <input type="hidden" name="carrierSlug" value={carrier.slug} />
                <label className={labelClass}>
                  Unidad
                  <select name="unitId" required className={inputClass} defaultValue="">
                    <option value="" disabled>
                      Elige unidad…
                    </option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                        {u.plateNumber ? ` · ${u.plateNumber}` : ""}
                        {deviceByUnit.get(u.id) ? " (ya tiene GPS)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  GPS
                  <select name="deviceId" required className={inputClass} defaultValue="">
                    <option value="" disabled>
                      Elige GPS…
                    </option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label ? `${d.label} · ` : ""}
                        {d.imei}
                        {assignedDeviceIds.has(d.id) ? " (asignado)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-[var(--muted)]">
                  Si la unidad o el GPS ya tenían asignación, se cierra la anterior y queda la
                  nueva.
                </p>
                <button type="submit" className={btnClass}>
                  Asignar
                </button>
              </form>
            )}
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title={`Unidades (${units.length})`}>
            {units.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Sin unidades todavía.</p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
                {units.map((u) => {
                  const gps = deviceByUnit.get(u.id);
                  return (
                    <li key={u.id} className="rounded border border-[var(--linea-tenue)] p-3">
                      <p className="font-medium">{u.label}</p>
                      <p className="text-[var(--muted)]">
                        Placa: {u.plateNumber ?? "—"}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                        GPS:{" "}
                        {gps
                          ? `${gps.imei}${gps.label ? ` · ${gps.label}` : ""}`
                          : "sin asignar"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={`Dispositivos GPS (${devices.length})`}>
            {devices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Sin GPS todavía.</p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
                {devices.map((d) => {
                  const assigned = assignedDeviceIds.has(d.id);
                  return (
                    <li key={d.id} className="rounded border border-[var(--linea-tenue)] p-3">
                      <p className="font-mono text-xs">{d.imei}</p>
                      {d.label ? <p className="mt-0.5 text-[var(--muted)]">{d.label}</p> : null}
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {assigned ? "Asignado a una unidad" : "Sin asignar"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {unassignedDevices.length > 0 ? (
              <p className="mt-3 text-xs text-amber-200/80">
                {unassignedDevices.length} GPS sin unidad — asígnalos en el paso 3.
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </main>
  );
}
