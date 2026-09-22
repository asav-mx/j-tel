import Link from "next/link";
import { notFound } from "next/navigation";
import { localDateIso } from "@jtel/domain";
import { cargarJornadaParaJStaff } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Titular, Vacio } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";
import { MapaDeLaJornada } from "@/components/casa/mapa-de-la-jornada";
import { VueltasDeLaJornada, type VueltaEnPantalla } from "@/components/casa/vueltas-de-la-jornada";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import {
  contraQueEnPalabras,
  conteoDeVueltasEnPalabras,
  diaVecino,
  estadoDeVueltaEnPalabras,
  faltanEnPalabras,
  intervaloEnPalabras,
} from "@/lib/casa/jornada";
import { textoDeReferencia, textoDelIntervalo } from "@/lib/casa/torre";

export const dynamic = "force-dynamic";

/**
 * La jornada de una unidad — su día en un circuito (PR C de la ficha de
 * Circuitos, 22-sep-2026). **Sólo J-Staff** en este PR; la cara del
 * transportista va después, con su muro, si ASAV lo decide.
 *
 * Es **recuerdo, no vida**: cero cobre, y todo sale del motor (B): el resumen en
 * números medidos, el recorrido sobre la ruta —sin trayecto en los silencios—,
 * las vueltas con el vocabulario de la 9.3c y, al tocar una, sus pasos con el
 * intervalo del SERVICIO en cada parada.
 *
 * **La hoja mide, no califica** (ficha): ningún puntaje, ranking ni comparación
 * entre unidades, choferes o transportistas. El chofer no aparece: la jornada es
 * de la unidad.
 */
export default async function JornadaDeLaUnidad({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; unitId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirEnPagina({ tipo: "jstaff" });
  const [{ id, unitId }, sp] = await Promise.all([params, searchParams]);
  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) notFound();
  const zona = circuito.timeZone;
  const ahora = new Date();
  const hoy = localDateIso(ahora, zona);
  const pedida = typeof sp.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) && sp.fecha <= hoy ? sp.fecha : hoy;

  // Las asignaciones de TODO el circuito las lee la cara de J-Staff (la valla de listAssignments) y se las pasa al motor.
  const asignaciones = await repos.circuits.listAssignments(id);
  const r = await cargarJornadaParaJStaff(repos, { circuitId: id, unitId, fecha: pedida, ahora, asignaciones });
  const etiqueta = asignaciones.find((a) => a.unitId === unitId)?.unitLabel ?? "unidad";

  const hora = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", { timeZone: zona, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const fechaLarga = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${pedida}T12:00:00Z`),
  );
  const base = `/casa/jstaff/circuitos/${id}/unidades/${unitId}`;
  const antes = diaVecino(pedida, -1, hoy);
  const despues = diaVecino(pedida, 1, hoy);

  return (
    <Marco casa={CASAS.jstaff} alcance={ALCANCE_SIN_CUENTA} lugar="/casa/jstaff/circuitos">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <Migas
          pasos={[
            { nombre: "Circuitos", ruta: "/casa/jstaff/circuitos" },
            { nombre: circuito.name, ruta: `/casa/jstaff/circuitos/${id}#unidades` },
            { nombre: etiqueta },
          ]}
        />
        <Titular nombre={`${etiqueta} · la jornada`} bajo={`${circuito.name} · ${fechaLarga}${pedida === hoy ? " · hoy" : ""}`} />

        {/* El día: uno antes, uno después, nunca más allá de hoy. */}
        <nav aria-label="Escoger el día" className="flex flex-wrap items-center gap-2">
          {antes && (
            <Link href={`${base}?fecha=${antes}`} className={clases.secundario}>
              ‹ día anterior
            </Link>
          )}
          <form action={base} method="get" className="flex items-center gap-2">
            <input type="date" name="fecha" defaultValue={pedida} max={hoy} className={`${clases.campo.replace("w-full ", "")} w-auto`} aria-label="Día" />
            <button type="submit" className={clases.secundario}>
              Ver
            </button>
          </form>
          {despues && (
            <Link href={`${base}?fecha=${despues}`} className={clases.secundario}>
              día siguiente ›
            </Link>
          )}
        </nav>

        {r.estado === "no_existe" && <Vacio>No existe ese circuito</Vacio>}
        {r.estado === "no_ha_abierto" && <Vacio>El servicio de este día todavía no abre: abre a las {hora(r.abre)}.</Vacio>}
        {r.estado === "sin_asignacion" && (
          <Vacio>Ese día la {etiqueta} no estaba asignada a este circuito: no hay jornada que mostrar.</Vacio>
        )}

        {r.estado === "jornada" && (() => {
          const j = r.jornada;
          const intervaloDe = new Map(r.intervalos.map((m) => [`${m.stopId}|${m.pasoDesde.toISOString()}`, m]));
          const vueltas: VueltaEnPantalla[] = j.vueltas.map((v, i) => ({
            clave: `${v.sentido}-${v.desde.toISOString()}`,
            numero: i + 1,
            sentido: v.sentido === "ida" ? "Ida" : "Vuelta",
            desde: hora(v.desde),
            hasta: hora(v.hasta),
            pasos: `${v.pasos.length}/${v.paradasDelSentido} paradas`,
            estado: estadoDeVueltaEnPalabras(v),
            completa: v.estado === "completa",
            faltan: v.faltan.map(faltanEnPalabras),
            detalle: v.pasos.map((p) => {
              const m = intervaloDe.get(`${p.stopId}|${p.pasoDesde.toISOString()}`);
              return {
                clave: `${p.stopId}-${p.pasoDesde.toISOString()}`,
                parada: p.nombre,
                hora: hora(p.pasoDesde),
                intervalo: m ? intervaloEnPalabras(m.estado) : null,
                cifra: m ? [textoDelIntervalo(m.intervalo), textoDeReferencia(m.referencia)].filter(Boolean).join(" · ") : null,
                contra: m ? contraQueEnPalabras(m.anteriorEtiqueta, m.anteriorUnitId, unitId) : null,
              };
            }),
          }));
          const minutosFuera = j.cifras.minutosFueraDelCorredor;
          return (
            <>
              <section aria-label="Lo que se midió del día" className="flex flex-wrap gap-x-7 gap-y-3 rounded-xl border border-[var(--linea)] bg-[var(--pieza)] px-4 py-3">
                <Dato rubro="Vueltas" valor={j.vueltas.length === 0 ? "ninguna" : `${j.vueltas.length}`} nota={conteoDeVueltasEnPalabras(j.cifras.vueltas)} />
                <Dato rubro="Recorrido medido" valor={`${j.cifras.kmMedidos.toFixed(1)} km`} nota="sin contar los silencios" />
                <Dato
                  rubro="Silencio"
                  valor={`${Math.round(j.cifras.minutosDeSilencio)} min`}
                  nota={`${j.silencios.length === 1 ? "1 silencio" : `${j.silencios.length} silencios`} · más de ${j.umbrales.silencioSegundos} s sin posición`}
                />
                <Dato
                  rubro="Fuera del corredor"
                  valor={`${Math.round(minutosFuera)} min`}
                  nota={`${j.salidas.length === 1 ? "1 salida" : `${j.salidas.length} salidas`} · cuenta desde ${j.umbrales.minutosFuera} min seguidos a más de ${j.umbrales.corredorMetros} m`}
                />
                <Dato rubro="El día" valor={`${hora(j.ventana.desde)}–${hora(j.ventana.hasta)}`} nota={pedida === hoy ? "hasta ahora" : "de la apertura al cierre"} />
                <Dato
                  rubro="Medido hasta"
                  valor={j.medidoHasta ? hora(j.medidoHasta) : "todavía nada"}
                  nota="lo que sigue, todavía no se mide"
                />
              </section>

              <section aria-label="El recorrido sobre la ruta" className="flex flex-col gap-2">
                <h2 className="text-[16px]" style={{ fontFamily: "var(--letra-titular)", fontWeight: 700 }}>
                  El recorrido, sobre la ruta
                </h2>
                <p className="text-[13px] text-[var(--tenue)]">
                  La línea delgada es por dónde anduvo la {etiqueta}, según sus posiciones guardadas; la ancha y suave es la
                  ruta. Donde el GPS calló no se dibuja nada —sólo sus dos extremos—, y una salida del corredor va punteada.
                </p>
                <MapaDeLaJornada
                  color={circuito.colorHex}
                  trazados={r.mapa.trazados}
                  paradas={r.mapa.paradas.map((p) => ({ nombre: p.nombre, lat: p.lat, lon: p.lon }))}
                  tramos={r.mapa.tramos.map((t) => t.map((q) => ({ lat: q.lat, lng: q.lng, at: q.at.toISOString() })))}
                  salidas={j.salidas.map((s) => ({
                    desde: s.desde.toISOString(),
                    hasta: s.hasta.toISOString(),
                    rotulo: `salió del corredor · ${hora(s.desde)}–${hora(s.hasta)} · ${Math.round(s.minutos)} min`,
                  }))}
                />
              </section>

              <section aria-label="Las vueltas del día" className="flex flex-col gap-2">
                <h2 className="text-[16px]" style={{ fontFamily: "var(--letra-titular)", fontWeight: 700 }}>
                  Las vueltas
                </h2>
                <p className="text-[13px] text-[var(--tenue)]">
                  Cada vuelta, de la primera parada de su sentido a la última. Al tocar una, sus pasos con el intervalo del
                  servicio en esa parada: se mide contra el paso anterior de cualquier unidad, así que no es un veredicto de
                  la {etiqueta}.
                </p>
                <VueltasDeLaJornada vueltas={vueltas} />
              </section>

              <p className="text-[12.5px] text-[var(--tenue)]">
                Esta hoja mide, no califica. Todo sale de posiciones y pasos ya guardados; nada se infiere donde el GPS calló.
              </p>
            </>
          );
        })()}
      </div>
    </Marco>
  );
}

function Dato({ rubro, valor, nota }: { rubro: string; valor: string; nota: string }) {
  return (
    <span className="flex min-w-[150px] flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--tenue)]">{rubro}</span>
      <span data-medida className="text-[15px]">
        {valor}
      </span>
      {nota && <span className="text-[12px] text-[var(--tenue)]">{nota}</span>}
    </span>
  );
}
