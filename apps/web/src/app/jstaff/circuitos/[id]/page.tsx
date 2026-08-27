import { notFound } from "next/navigation";
import { AppNav, Card } from "@/components/ui";
import { CircuitoEditor } from "@/components/circuito-editor";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

export default async function CircuitoPage({ params }: { params: Promise<{ id: string }> }) {
  // La comprobación va cerca del dato, no en el layout.
  await exigirEnPagina({ tipo: "jstaff" });

  const { id } = await params;
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

        <Card>
          <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[var(--muted)]">Frecuencia declarada</dt>
              <dd>{circuito.declaredFrequencyMinutes} min</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Dato viejo a los</dt>
              <dd>{Math.round(circuito.staleAfterSeconds / 60)} min</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Piso del rango</dt>
              <dd>±{Math.round(circuito.arrivalRangeFloorSeconds / 60)} min</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Tolerancia de pegado</dt>
              <dd>{circuito.stopSnapToleranceMeters} m</dd>
            </div>
          </dl>
          <p className="mb-4 text-xs text-[var(--muted)]">
            Horario {String(circuito.serviceStartLocal).slice(0, 5)}–
            {String(circuito.serviceEndLocal).slice(0, 5)} · {circuito.timeZone} · slug público{" "}
            <code>{circuito.publicSlug}</code>
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
