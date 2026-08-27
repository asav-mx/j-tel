import { notFound } from "next/navigation";
import { AppNav, Card } from "@/components/ui";
import { localDateTimeShort } from "@jtel/domain";
import { CircuitoEditor } from "@/components/circuito-editor";
import { CircuitoUnidades } from "@/components/circuito-unidades";
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

  const [trazados, paradas, asignaciones, asignables] = await Promise.all([
    repos.circuits.getPaths(id),
    repos.circuits.listStopsVigentes(id),
    repos.circuits.listAssignments(id),
    repos.circuits.listUnidadesAsignables(circuito.concessionAccountId),
  ]);

  const publicado = circuito.publishedAt !== null;
  const unidadesVigentes = asignaciones.filter((a) => !a.validTo).length;

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

        {/*
          El interruptor de publicación, antes que nada de lo que se edita.

          Va arriba porque responde la pregunta que cambia el significado de
          todo lo de abajo: si esto ya lo ve un pasajero o todavía no. Un
          circuito se arma por partes, y durante ese rato tiene que poder
          probarse con datos reales sin aparecer en la app.

          Estado operativo, no veredicto: acero y tenue. Ni verde ni ámbar.
        */}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {publicado ? (
                <>
                  <p className="text-sm font-medium text-[var(--texto)]">
                    Publicado
                    <span className="ml-2 font-[family-name:var(--fuente-mono)] tabular-nums text-[var(--acero)]">
                      desde {localDateTimeShort(circuito.publishedAt as Date, circuito.timeZone)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--tenue)]">
                    La app del pasajero lo ve. Responde en{" "}
                    <code>/circuitos/{circuito.publicSlug}/unidades</code>.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-[var(--texto)]">No publicado</p>
                  <p className="mt-1 text-xs text-[var(--tenue)]">
                    Este circuito no existe para la app del pasajero: el endpoint contesta lo
                    mismo que para un slug inventado. Se puede armar y probar sin que nadie lo
                    vea.
                  </p>
                </>
              )}

              {/*
                Lo que le falta se ENUNCIA, no se bloquea. Publicar sin trazado
                es legítimo —el endpoint contesta igual, con el sentido en
                nulo—, y un candado aquí decidiría por quien opera.
              */}
              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {(
                  [
                    ["Trazado", `${trazados.length} de 2 sentidos`, trazados.length > 0],
                    ["Paradas", String(paradas.length), paradas.length > 0],
                    ["Unidades corriendo", String(unidadesVigentes), unidadesVigentes > 0],
                  ] as const
                ).map(([que, cuanto, hay]) => (
                  <li key={que} className={hay ? "text-[var(--tenue)]" : "text-[var(--texto)]"}>
                    {que}:{" "}
                    <span className="font-[family-name:var(--fuente-mono)] tabular-nums text-[var(--acero)]">
                      {cuanto}
                    </span>
                    {!hay && <span className="text-[var(--tenue)]"> — falta</span>}
                  </li>
                ))}
              </ul>
            </div>

            <form
              action={`/api/jstaff/circuitos/${circuito.id}/publicacion`}
              method="post"
              className="shrink-0"
            >
              <input type="hidden" name="publicar" value={publicado ? "no" : "si"} />
              <button
                type="submit"
                className="rounded border border-[var(--azul)]/50 bg-[var(--azul)]/10 px-4 py-2 text-sm font-medium text-[var(--azul)] hover:bg-[var(--azul)]/20"
              >
                {publicado ? "Despublicar" : "Publicar"}
              </button>
            </form>
          </div>
        </Card>

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
                  ["velocidadKmh", "Velocidad efectiva (km/h)", circuito.avgSpeedKmh],
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
                    min={campo === "velocidadKmh" ? 0.1 : 1}
                    step={campo === "velocidadKmh" ? 0.1 : 1}
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

          {/*
            Quién corre el circuito vive aquí y no en pantalla aparte: el
            trazado, las paradas y las unidades son las tres respuestas de la
            misma pregunta, y separarlas obliga a recordar dónde quedó cada una.
          */}
          <CircuitoUnidades
            circuitoId={circuito.id}
            zonaHoraria={circuito.timeZone}
            asignacionesIniciales={asignaciones.map((a) => ({
              id: a.id,
              unitId: a.unitId,
              unitLabel: a.unitLabel,
              plateNumber: a.plateNumber,
              carrierName: a.carrierName,
              validFrom: a.validFrom.toISOString(),
              validTo: a.validTo ? a.validTo.toISOString() : null,
              motivo: a.motivo,
            }))}
            asignablesIniciales={asignables.map((u) => ({
              unitId: u.unitId,
              label: u.label,
              plateNumber: u.plateNumber,
              carrierName: u.carrierName,
              ocupadaEnCircuitoId: u.ocupadaEnCircuitoId,
              ocupadaEnCircuito: u.ocupadaEnCircuito,
              ocupadaDesde: u.ocupadaDesde ? u.ocupadaDesde.toISOString() : null,
            }))}
          />
        </Card>
      </div>
    </main>
  );
}
