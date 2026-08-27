import { notFound } from "next/navigation";
import { AppNav, Card } from "@/components/ui";
import { CircuitoEditor } from "@/components/circuito-editor";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

export default async function CircuitoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // La comprobación va cerca del dato, no en el layout.
  await exigirEnPagina({ tipo: "jstaff" });

  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const ok = typeof sp?.ok === "string" ? sp.ok : null;
  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) notFound();

  const [trazados, paradas] = await Promise.all([
    repos.circuits.getPaths(id),
    repos.circuits.listStopsVigentes(id),
  ]);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <AppNav title={circuito.name} links={[{ href: "/jstaff", label: "← Panel" }]} />

        {error && (
          <p className="mb-4 rounded border border-[var(--linea-tenue)] p-3 text-sm">⚠ {error}</p>
        )}
        {ok && (
          <p className="mb-4 rounded border border-[var(--linea-tenue)] p-3 text-sm">✓ {ok}</p>
        )}

        <Card>
          {/*
            Todo lo del circuito se edita aquí. No son constantes con cara de
            formulario: si el concesionario cambia su frecuencia el martes, el
            martes se ajusta, sin desplegar. Los CHECK de la base son la última
            palabra sobre lo que es un valor válido.
          */}
          <form action={`/api/jstaff/circuitos/${circuito.id}`} method="post" className="mb-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs text-[var(--muted)]" htmlFor="nombre">
                  Nombre del circuito
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  defaultValue={circuito.name}
                  className="w-full rounded border border-[var(--linea-tenue)] bg-transparent px-2 py-1 text-sm"
                />
              </div>
              {(
                [
                  ["frecuenciaMin", "Frecuencia declarada (min)", circuito.declaredFrequencyMinutes],
                  ["umbralSeg", "Dato viejo a los (seg)", circuito.staleAfterSeconds],
                  ["pisoSeg", "Piso del rango (seg)", circuito.arrivalRangeFloorSeconds],
                  ["toleranciaM", "Tolerancia de pegado (m)", circuito.stopSnapToleranceMeters],
                ] as const
              ).map(([campo, etiqueta, valor]) => (
                <div key={campo}>
                  <label className="mb-1 block text-xs text-[var(--muted)]" htmlFor={campo}>
                    {etiqueta}
                  </label>
                  <input
                    id={campo}
                    name={campo}
                    type="number"
                    min={1}
                    defaultValue={Number(valor)}
                    className="w-full rounded border border-[var(--linea-tenue)] bg-transparent px-2 py-1 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]" htmlFor="horaInicio">
                  Inicio de servicio
                </label>
                <input
                  id="horaInicio"
                  name="horaInicio"
                  type="time"
                  defaultValue={String(circuito.serviceStartLocal).slice(0, 5)}
                  className="w-full rounded border border-[var(--linea-tenue)] bg-transparent px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]" htmlFor="horaFin">
                  Fin de servicio
                </label>
                <input
                  id="horaFin"
                  name="horaFin"
                  type="time"
                  defaultValue={String(circuito.serviceEndLocal).slice(0, 5)}
                  className="w-full rounded border border-[var(--linea-tenue)] bg-transparent px-2 py-1 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="rounded border border-[var(--linea-tenue)] px-3 py-1 text-sm"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </form>

          <p className="mb-4 text-xs text-[var(--muted)]">
            {circuito.timeZone} · slug público <code>{circuito.publicSlug}</code> — el slug no se
            edita: se comparte y cambiarlo rompe las ligas que ya circulan.
          </p>

          <CircuitoEditor
            circuitoId={circuito.id}
            toleranciaMetros={circuito.stopSnapToleranceMeters}
            trazadosIniciales={trazados.map((t) => ({
              sentido: t.sentido,
              coordinates: t.coordinates,
              pointCount: t.pointCount,
              lengthMeters: t.lengthMeters,
              sourceLayerName: t.sourceLayerName,
            }))}
            paradasIniciales={paradas.map((p) => ({
              stopId: p.stopId,
              qrSlug: p.qrSlug,
              name: p.name,
              orden: p.orden,
              latitude: p.latitude,
              longitude: p.longitude,
            }))}
          />
        </Card>
      </div>
    </main>
  );
}
