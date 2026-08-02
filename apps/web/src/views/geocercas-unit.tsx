import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { UnitShell } from "@/components/unit-shell";
import {
  AvisoSistema,
  ChipEstado,
  Panel,
  botonPrimario,
  botonSecundario,
  campo,
  etiqueta,
} from "@/components/ui";
import { confirmMessages } from "@/lib/confirm-messages";
import { inferCircleFromPolygon } from "@/lib/geo";
import type { UnitPageContext } from "@/lib/unit-context";
import { operationalUnitLabel } from "@/lib/operational-scope";

export const dynamic = "force-dynamic";

const mono = "font-[family-name:var(--fuente-mono)]";

const createdLabels: Record<string, string> = {
  geocerca: "La geocerca ya aparece en la lista.",
  geocerca_actualizada: "Se actualizó la geocerca.",
  geocerca_eliminada: "Se eliminó la geocerca.",
};

/**
 * El papel de cada geocerca, dicho por lo que hace y no por su llave.
 *
 * Solo el destino entra al juicio: es el punto contra el que se mide la llegada
 * y donde se corta la traza. Decirlo aquí evita que alguien cargue una caseta
 * como destino y después no entienda por qué los resultados no cuadran.
 */
const PAPELES = [
  {
    valor: "destino",
    etiqueta: "Destino — dónde debe llegar",
    explica: "Es la que se juzga: contra ella se mide la llegada y en ella se corta la traza.",
  },
  { valor: "base", etiqueta: "Base", explica: "Punto de salida o resguardo. No se juzga." },
  { valor: "caseta", etiqueta: "Caseta", explica: "Punto de paso. No se juzga." },
  { valor: "otro", etiqueta: "Otro", explica: "Referencia en el mapa. No se juzga." },
] as const;

const papelEtiqueta = (v: string) =>
  PAPELES.find((p) => p.valor === v)?.etiqueta.split(" — ")[0] ?? v;

export async function GeocercasUnitView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const created = typeof sp?.created === "string" ? sp.created : null;
  const { client, unit } = ctx;

  const repos = getRepos();

  const allGeofences = await repos.geofences.findForClient(client.id);

  const ownerRef =
    unit.kind === "plant_group"
      ? (`plant_group:${unit.id}` as const)
      : (`plant:${unit.id}` as const);

  const unitLabel =
    unit.kind === "plant_group"
      ? `Campus: ${operationalUnitLabel(unit)}`
      : `${unit.name} (${unit.code})`;

  const unitGeofences = allGeofences.filter((g) => {
    if (unit.kind === "plant_group") {
      return g.ownerType === "plant_group" && g.ownerPlantGroupId === unit.id;
    }
    return g.ownerPlantId === unit.id;
  });

  return (
    <UnitShell
      client={client}
      unit={unit}
      title={`Geocercas — ${operationalUnitLabel(unit)}`}
      step="geocercas"
    >
      <p className="max-w-[76ch] text-[13.5px] text-[var(--tenue)]">
        La geocerca marca <span className="text-[var(--texto)]">dónde debe llegar</span> la unidad
        en <span className="text-[var(--texto)]">{operationalUnitLabel(unit)}</span>. Es la frontera
        de la evidencia: la traza se corta al entrar, y lo que la unidad haga después no se muestra
        a nadie.
        {unit.kind === "plant_group"
          ? " En un campus compartido suele bastar una sola geocerca de llegada en la entrada."
          : null}
      </p>

      {error ? <AvisoSistema lead="No se guardó.">{error}</AvisoSistema> : null}
      {created ? (
        <AvisoSistema lead="Guardado.">{createdLabels[created] ?? null}</AvisoSistema>
      ) : null}

      <Panel
        titulo={`Nueva geocerca — ${operationalUnitLabel(unit)}`}
        nota={
          <>
            Pertenece a <span className="text-[var(--texto)]">{unitLabel}</span>.
          </>
        }
      >
        <form action="/api/cliente/geocercas" method="post" className="space-y-4">
          <input type="hidden" name="clientSlug" value={client.slug} />
          <input type="hidden" name="ownerRef" value={ownerRef} />
          <input type="hidden" name="action" value="create" />
          <div className="grid gap-4 md:grid-cols-2">
            <label className={etiqueta}>
              Para qué sirve
              <select name="role" className={campo} defaultValue="destino">
                {PAPELES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.etiqueta}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block max-w-[54ch] text-[12px] text-[var(--tenue)]">
                {PAPELES[0].explica}
              </span>
            </label>
            <label className={etiqueta}>
              Nombre
              <input name="name" required className={campo} placeholder="Ej. Entrada Campus Norte" />
            </label>
            <label className={etiqueta}>
              Radio
              <input
                name="radiusMeters"
                required
                className={campo}
                placeholder="150"
                defaultValue="150"
                inputMode="decimal"
              />
              <span className="mt-1.5 block text-[12px] text-[var(--tenue)]">
                En metros desde el centro. Un radio corto exige una precisión que el GPS de la
                unidad puede no tener.
              </span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={etiqueta}>
                Latitud
                <input name="lat" required className={campo} placeholder="31.6904" inputMode="decimal" />
              </label>
              <label className={etiqueta}>
                Longitud
                <input name="lng" required className={campo} placeholder="-106.4245" inputMode="decimal" />
              </label>
            </div>
          </div>
          <p className="max-w-[70ch] text-[12px] text-[var(--tenue)]">
            En Google Maps, clic derecho sobre el punto: el primer valor es la latitud y el segundo
            la longitud.
          </p>
          <button type="submit" className={botonPrimario}>
            Crear geocerca
          </button>
        </form>
      </Panel>

      <Panel titulo={`Geocercas — ${operationalUnitLabel(unit)} (${unitGeofences.length})`}>
        {unitGeofences.length === 0 ? (
          <p className="text-[13.5px] text-[var(--tenue)]">
            Todavía no hay geocercas en esta unidad. Sin una de destino no se puede juzgar ninguna
            llegada.
          </p>
        ) : (
          <ul className="space-y-3">
            {unitGeofences.map((g) => {
              const circle = inferCircleFromPolygon(g.polygon);
              return (
                <li key={g.id} className="rounded border border-[var(--linea-tenue)] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[15px] font-medium text-[var(--texto)]">{g.name}</span>
                      <ChipEstado tono={g.role === "destino" ? "acero" : "tenue"}>
                        {papelEtiqueta(g.role)}
                      </ChipEstado>
                    </span>
                    <span className={`text-[12px] ${mono} text-[var(--tenue)]`}>
                      {circle ? (
                        <>
                          radio <span className="text-[var(--acero)]">{circle.radiusMeters} m</span>{" "}
                          ·{" "}
                        </>
                      ) : null}
                      {g.polygon.length} vértices
                      {g.ownerType === "plant_group" ? " · campus" : ""}
                    </span>
                  </div>
                  <ConfirmForm
                    action="/api/cliente/geocercas"
                    method="post"
                    confirmMessage={confirmMessages.updateGeofence(g.name)}
                    className="grid gap-4 md:grid-cols-2"
                  >
                    <input type="hidden" name="clientSlug" value={client.slug} />
                    <input type="hidden" name="ownerRef" value={ownerRef} />
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="geofenceId" value={g.id} />
                    <label className={etiqueta}>
                      Para qué sirve
                      <select name="role" className={campo} defaultValue={g.role}>
                        {PAPELES.map((p) => (
                          <option key={p.valor} value={p.valor}>
                            {p.etiqueta}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={etiqueta}>
                      Nombre
                      <input name="name" required className={campo} defaultValue={g.name} />
                    </label>
                    <label className={etiqueta}>
                      Radio (metros)
                      <input
                        name="radiusMeters"
                        required
                        className={campo}
                        defaultValue={circle?.radiusMeters ?? 150}
                        inputMode="decimal"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className={etiqueta}>
                        Latitud
                        <input
                          name="lat"
                          required
                          className={campo}
                          defaultValue={circle?.lat ?? ""}
                          inputMode="decimal"
                        />
                      </label>
                      <label className={etiqueta}>
                        Longitud
                        <input
                          name="lng"
                          required
                          className={campo}
                          defaultValue={circle?.lng ?? ""}
                          inputMode="decimal"
                        />
                      </label>
                    </div>
                    <div className="md:col-span-2">
                      <button type="submit" className={botonPrimario}>
                        Guardar cambios
                      </button>
                    </div>
                  </ConfirmForm>
                  <div className="mt-3 border-t border-[var(--linea-tenue)] pt-3">
                    <ConfirmForm
                      action="/api/cliente/geocercas"
                      method="post"
                      confirmMessage={confirmMessages.deleteGeofence(g.name)}
                      className="inline"
                    >
                      <input type="hidden" name="clientSlug" value={client.slug} />
                      <input type="hidden" name="ownerRef" value={ownerRef} />
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="geofenceId" value={g.id} />
                      <button type="submit" className={botonSecundario}>
                        Eliminar geocerca
                      </button>
                    </ConfirmForm>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </UnitShell>
  );
}
