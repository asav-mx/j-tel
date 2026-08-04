/**
 * El microscopio del motor — un servicio a la vez. Cara J-Staff, interna.
 *
 * Aquí sí se enseñan las tripas del árbitro: el cliente nunca ve esta
 * pantalla. Por eso el registro es crudo — números completos, códigos del
 * motor sin traducir, el ledger tal cual quedó sellado.
 *
 * Lo que la pantalla NO hace: verificar. Todo lo que muestra salió del hecho
 * y del ledger sellados en su momento (ley 2). La única cuenta que se hace al
 * abrir es geometría de dibujo, con las mismas funciones y los mismos puntos
 * que usó el motor.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/ui";
import { ChipResultado } from "@/components/chip-resultado";
import { MicroscopioRuta } from "@/components/microscopio-ruta";
import { RielDeRuta, RielDeVentana } from "@/components/rieles-diagnostico";
import { MedidasDelMotor } from "@/components/medidas-motor";
import { cargarDiagnostico } from "@/lib/diagnostico-data";
import { km, pct } from "@/lib/diagnostico-lectura";
import { duracion, fechaDeIso, reloj } from "@/lib/formato-tiempo";
import { HistoriaDelSello } from "@/components/historia-del-sello";
import type { LedgerPairing } from "@jtel/db";
import type { EstadoServicio } from "@jtel/services";
import { exigirEnPagina } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

/** Cuántas trazas acompañan a la decisiva en el dibujo. */
const MAX_TRAZAS_ACOMPANANTES = 4;
/** Cuántas filas de candidatas van a la vista antes del cajón. */
const MAX_FILAS_A_LA_VISTA = 12;

export default async function DiagnosticoPage({
  params,
}: {
  params: Promise<{ occurrenceId: string }>;
}) {
  // La comprobación va cerca del dato: un layout no se re-renderiza
  // al navegar entre rutas hermanas, así que como única guardia es frágil.
  await exigirEnPagina({ tipo: "jstaff" });

  const { occurrenceId } = await params;
  const datos = await cargarDiagnostico(occurrenceId);
  if (!datos) notFound();

  const { ocurrencia, hecho, ventana, lectura, trazado, emparejamiento } = datos;
  const decisiva = datos.candidatas.find((c) => c.esLaDecisiva) ?? null;

  // Una flota entera encimada no es un dibujo, es un espagueti. Se acompañan
  // las que compitieron de verdad — las de mejor puntaje en el orden del motor
  // — y el resto se declara en la leyenda en vez de desaparecer en silencio.
  const puntaje = new Map(
    (lectura?.candidatas ?? []).map((c) => [
      c.clave,
      Math.min(c.matchRutaPct ?? -1, c.precisionCorredorPct ?? -1),
    ]),
  );
  const otras = datos.candidatas
    .filter((c) => !c.esLaDecisiva)
    .sort((a, b) => (puntaje.get(b.clave) ?? -1) - (puntaje.get(a.clave) ?? -1));
  const otrasDibujadas = otras.slice(0, MAX_TRAZAS_ACOMPANANTES);

  const candidatasOrdenadas = [...(lectura?.candidatas ?? [])].sort(
    (a, b) =>
      Number(b.clave === lectura?.decisiva?.clave) - Number(a.clave === lectura?.decisiva?.clave) ||
      (puntaje.get(b.clave) ?? -1) - (puntaje.get(a.clave) ?? -1),
  );
  const alFrente = candidatasOrdenadas.slice(0, MAX_FILAS_A_LA_VISTA);
  const enElCajon = candidatasOrdenadas.slice(MAX_FILAS_A_LA_VISTA);
  // La política congelada manda; el ledger sirve de respaldo cuando el hecho
  // es anterior a que la política guardara la perilla.
  const toleranciaOrigen =
    ocurrencia.toleranciaDeOrigen ?? lectura?.decision?.toleranciaDeOrigen ?? null;

  return (
    <main className="min-h-screen p-6 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-10">
        <AppNav
          title="Microscopio del motor"
          links={[
            { href: "/jstaff/diagnostico", label: "← Elegir servicio" },
            { href: "/jstaff/verificacion", label: "Salud y recall" },
          ]}
        />

        {/* La cara importa: esto no se enseña afuera. */}
        <p className="rounded-sm border border-dashed border-[var(--azul)]/45 px-4 py-2.5 font-[family-name:var(--fuente-mono)] text-[11.5px] text-[var(--azul)]">
          Superficie interna. Muestra la maquinaria del árbitro — métricas, umbrales y
          pasos. No se enseña a un cliente ni a un carrier: ellos ven el hecho, no cómo
          se calculó.
        </p>

        {/* — Encabezado: el hecho, y en una línea por qué — */}
        <header className="space-y-4">
          <p className="font-[family-name:var(--fuente-mono)] text-[12px] text-[var(--tenue)]">
            {ocurrencia.contrato}
          </p>
          <h1 className="font-[family-name:var(--fuente-archivo)] text-[26px] leading-tight font-bold text-[var(--texto)]">
            {ocurrencia.ruta} · {ocurrencia.turno}
          </h1>
          <p className="font-[family-name:var(--fuente-mono)] text-[13px] text-[var(--tenue)]">
            {fechaDeIso(ocurrencia.fecha)} · hora límite {reloj(ocurrencia.deadline)}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {hecho ? (
              <ChipResultado estado={hecho.estado as EstadoServicio} />
            ) : (
              <span className="font-[family-name:var(--fuente-mono)] text-[12px] text-[var(--tenue)]">
                Sin hecho sellado
              </span>
            )}
          </div>

          {/*
            El cajón completo vive aquí y no en las bandejas: J-Staff es la
            superficie de razonamiento, donde el operador experto sí quiere la
            cadena entera. Abierto por defecto cuando hubo versiones — quien
            entra a diagnosticar viene justamente a leerlas.
          */}
          {hecho && (
            <HistoriaDelSello
              historia={hecho.historiaSello}
              conCajon
              abiertoPorDefecto
            />
          )}

          {/* La línea que el operador viene a leer. */}
          <p className="max-w-4xl border-l-2 border-[var(--acero)] pl-4 text-[15px] leading-relaxed text-[var(--texto)]">
            {lectura?.porQue ??
              motivoDeAusencia(emparejamiento)}
          </p>
        </header>

        {/* — El dibujo — */}
        <Seccion
          titulo="El trazado, el corredor y lo que se observó"
          apoyo={
            trazado
              ? `Variante ${trazado.variante} · ${trazado.tramo.kmTotales.toFixed(1)} km · corredor ${(lectura?.umbrales.corredorMetros ?? 120).toFixed(0)} m`
              : "Sin trazado vigente a la fecha del servicio"
          }
        >
          {trazado ? (
            <MicroscopioRuta
              waypoints={trazado.waypoints}
              tramo={trazado.tramo}
              geocerca={datos.geocerca}
              recorrido={decisiva?.puntos ?? []}
              otrosRecorridos={otrasDibujadas.map((o) => ({ clave: o.clave, puntos: o.puntos }))}
              otrosOmitidos={otras.length - otrasDibujadas.length}
              corredorMetros={lectura?.umbrales.corredorMetros ?? 120}
            />
          ) : (
            <p className="font-[family-name:var(--fuente-mono)] text-sm text-[var(--tenue)]">
              Esta ruta no tiene KML vigente a la fecha del servicio, así que el motor
              resolvió por destino y no hay corredor que dibujar.
            </p>
          )}
          {datos.trazaCortadaEnLlegada && (
            <p className="mt-4 font-[family-name:var(--fuente-mono)] text-[11.5px] text-[var(--tenue)]">
              La traza se corta en la llegada a la geocerca. Lo que la unidad hizo
              después no se muestra en ninguna cara, tampoco en esta.
            </p>
          )}
        </Seccion>

        {/* — La ventana sobre la ruta: lo que hoy no se puede ver — */}
        {trazado && (
          <Seccion
            titulo="La ventana sobre la ruta"
            apoyo="Desde dónde miró el sistema, y qué tramo quedó fuera"
          >
            <RielDeRuta tramo={trazado.tramo} toleranciaOrigen={toleranciaOrigen} />
          </Seccion>
        )}

        {/* — La ventana sobre el tiempo — */}
        {ventana && (
          <Seccion
            titulo="La ventana sobre el tiempo"
            apoyo={`${duracion((ventana.hasta.getTime() - ventana.desde.getTime()) / 60_000)} de observación`}
          >
            <RielDeVentana
              ventana={ventana}
              deadline={ocurrencia.deadline}
              toleranciaMinutos={ocurrencia.toleranciaMinutos}
              instantes={datos.instantesDecisiva}
              llegada={hecho?.llegada ?? null}
              huecoMinimoMinutos={lectura?.umbrales.huecoMaxMinutos ?? 10}
              candidata={decisiva?.etiqueta ?? null}
            />
          </Seccion>
        )}

        {/* — Las cuatro medidas — */}
        {lectura && (
          <Seccion titulo="Las cuatro medidas" apoyo="Cada cifra con el umbral que le aplicó">
            <MedidasDelMotor
              medidas={lectura.medidas}
              decisiva={
                lectura.decisiva && lectura.papelDeLaDecisiva
                  ? {
                      clave: datos.etiquetas[lectura.decisiva.clave] ?? lectura.decisiva.clave,
                      papel: lectura.papelDeLaDecisiva,
                    }
                  : null
              }
            />
          </Seccion>
        )}

        {/* — Las candidatas, densas — */}
        {lectura && lectura.candidatas.length > 0 && (
          <Seccion
            titulo={`Las candidatas · ${lectura.candidatas.length}`}
            apoyo="Ordenadas como el motor las rankea: primero el menor de match y corredor"
          >
            <TablaDeCandidatas
              filas={alFrente}
              claveDecisiva={lectura.decisiva?.clave ?? null}
              papel={lectura.papelDeLaDecisiva}
              etiquetas={datos.etiquetas}
            />
            {enElCajon.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer font-[family-name:var(--fuente-mono)] text-[11.5px] text-[var(--azul)]">
                  Las otras {enElCajon.length} candidatas · ninguna pasó de{" "}
                  {pct(
                    Math.max(
                      ...enElCajon.map((c) =>
                        Math.min(c.matchRutaPct ?? 0, c.precisionCorredorPct ?? 0),
                      ),
                    ),
                  )}
                </summary>
                <div className="mt-3">
                  <TablaDeCandidatas
                    filas={enElCajon}
                    claveDecisiva={lectura.decisiva?.clave ?? null}
                    papel={lectura.papelDeLaDecisiva}
                    etiquetas={datos.etiquetas}
                  />
                </div>
              </details>
            )}
            <p className="mt-3 text-[11.5px] text-[var(--tenue)]">
              «Observable» es la fracción de la ruta sobre la que se calculó el match. Un
              match alto sobre una fracción baja no es un match alto de la ruta. Un guion
              significa que esa corrida no selló la cifra, no que fuera la ruta completa.
            </p>
          </Seccion>
        )}

        {/* — El ledger crudo — */}
        <Seccion
          titulo="Los pasos del árbitro"
          apoyo={
            emparejamiento.paired
              ? "Tal como quedaron sellados, sin traducir"
              : "No disponibles para esta corrida"
          }
        >
          {emparejamiento.paired ? (
            <ol className="space-y-2">
              {datos.pasos.map((p, i) => (
                <li
                  key={`${p.step}-${i}`}
                  className="rounded-sm border border-[var(--linea)] p-3 font-[family-name:var(--fuente-mono)] text-[11.5px]"
                >
                  <p className="text-[var(--texto)]">
                    <span className="text-[var(--tenue)]">{String(i + 1).padStart(2, "0")}</span>{" "}
                    {p.step} → {p.result}
                  </p>
                  {p.details && Object.keys(p.details).length > 0 && (
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-[var(--tenue)]">
                      {JSON.stringify(p.details, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-[var(--tenue)]">{motivoDeAusencia(emparejamiento)}</p>
          )}
        </Seccion>

        <p className="font-[family-name:var(--fuente-mono)] text-[11.5px] text-[var(--tenue)]">
          Servicio {ocurrencia.id} ·{" "}
          <Link href={`/cliente/servicio/${ocurrencia.id}`} className="text-[var(--azul)]">
            expediente que ve el cliente
          </Link>
        </p>
      </div>
    </main>
  );
}

/**
 * Por qué no hay medición. Se dice el motivo exacto en vez de un "no
 * disponible" genérico: cuál de los tres es cambia qué hay que arreglar.
 */
function motivoDeAusencia(
  emparejamiento: LedgerPairing<{ action: string; createdAt: Date }>,
): string {
  if (emparejamiento.paired) return "";
  switch (emparejamiento.reason) {
    case "no_entry":
      return "Medición no disponible: no quedó ninguna entrada de ledger desde el sello de este hecho. Sin ella no se puede decir con qué números se decidió.";
    case "ambiguous":
      return `Medición no disponible: hay ${emparejamiento.candidates} corridas después del sello y no hay forma de saber cuál produjo el hecho vigente. Antes que adivinar, se deja el hueco.`;
    case "out_of_tolerance":
      return "Medición no disponible: la única entrada de ledger quedó demasiado lejos del sello como para atribuirla a este hecho.";
  }
}

function TablaDeCandidatas({
  filas,
  claveDecisiva,
  papel,
  etiquetas,
}: {
  filas: ReadonlyArray<import("@/lib/diagnostico-lectura").Candidata>;
  claveDecisiva: string | null;
  papel: "gano" | "mas_cercana" | null;
  etiquetas: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse font-[family-name:var(--fuente-mono)] text-[12px] tabular-nums">
        <thead>
          <tr className="border-b border-[var(--linea)] text-left text-[var(--tenue)]">
            <th className="py-2 pr-4 font-medium">Candidata</th>
            <th className="py-2 pr-4 text-right font-medium">Match</th>
            <th className="py-2 pr-4 text-right font-medium">Corredor</th>
            <th className="py-2 pr-4 text-right font-medium">Fréchet</th>
            <th className="py-2 pr-4 text-right font-medium">Dirección</th>
            <th className="py-2 pr-4 text-right font-medium">Observable</th>
            <th className="py-2 font-medium">Sirvió</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((c) => {
            const esDecisiva = c.clave === claveDecisiva;
            return (
              <tr
                key={c.clave}
                className="border-b border-[var(--linea)]"
                style={esDecisiva ? undefined : { color: "var(--tenue)" }}
              >
                <td className="py-2 pr-4">
                  {etiquetas[c.clave] ?? c.clave}
                  {esDecisiva && (
                    <span className="ml-2 text-[10.5px] text-[var(--azul)]">
                      {papel === "gano" ? "acreditada" : "la más cercana"}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right">{pct(c.matchRutaPct)}</td>
                <td className="py-2 pr-4 text-right">{pct(c.precisionCorredorPct)}</td>
                <td className="py-2 pr-4 text-right">{km(c.frechetKm)}</td>
                <td className="py-2 pr-4 text-right">
                  {c.similitudDireccion == null ? "—" : c.similitudDireccion.toFixed(3)}
                </td>
                <td className="py-2 pr-4 text-right">
                  {c.fraccionObservable == null
                    ? "—"
                    : `${(c.fraccionObservable * 100).toFixed(1)}%`}
                </td>
                <td className="py-2">{c.sirvioRuta ? "sí" : "no"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Seccion({
  titulo,
  apoyo,
  children,
}: {
  titulo: string;
  apoyo?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-[var(--linea)] pb-2">
        <h2 className="font-[family-name:var(--fuente-archivo)] text-[17px] font-semibold text-[var(--texto)]">
          {titulo}
        </h2>
        {apoyo && (
          <p className="mt-0.5 font-[family-name:var(--fuente-mono)] text-[11.5px] text-[var(--tenue)]">
            {apoyo}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
