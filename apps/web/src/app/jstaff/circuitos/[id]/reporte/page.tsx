import Link from "next/link";
import { notFound } from "next/navigation";
import { localDateTimeSeconds, localTimeHHMM } from "@jtel/domain";
import type { TrazadoParaMedir } from "@jtel/domain";
import { yaArrancoElServicio } from "@jtel/domain/publico";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { duracion, fechaCivilLarga } from "@/lib/formato-tiempo";
import { aperturaDelHorario } from "@/lib/operar-circuito";
import {
  agruparHistorial,
  armarReporte,
  PUNTO_DE_CONTROL,
  type ReporteDelDia,
  type ReporteDeUnidad,
} from "@/lib/reporte-comportamiento";

/**
 * **Reporte de comportamiento** — el tercer piso de la cara del concesionario.
 *
 * Operar contesta «qué está pasando ahora»; esto contesta **«qué pasó hoy»**, y
 * son pantallas distintas a propósito: el encabezado de Operar declara que
 * velocidades, kilómetros, vueltas e historia son otro piso, y éste es ese piso.
 *
 * ## Lectura, no sello — y aquí importa más que en ningún lado
 *
 * Un reporte del día sobre un transportista es exactamente la superficie donde
 * un producto se convierte en un vigilante. La ley del Tramo JB lo cierra: los
 * concesionarios que se sumen lo hacen a una plataforma **que los muestra, no
 * que los vigila**, y si el sistema empezara a firmar faltas desde el día uno la
 * invitación cambia de naturaleza y el universo no nace.
 *
 * Por eso en esta pantalla **no hay un solo color de veredicto**, no hay
 * «cumplió», no hay «va atrasada», y ninguna cifra se pinta de rojo. Todo lo
 * medido va en acero, que es lo que el lenguaje de la casa reserva para
 * medición.
 *
 * ## Lo que esta pantalla dice de sí misma
 *
 * Tres huecos se declaran arriba en vez de esconderse:
 *
 * 1. **Hasta dónde llega el archivo.** No es la hora del reloj: el archivador
 *    mete su propio retraso, así que «hoy» significa «hasta aquí».
 * 2. **Que las vueltas son OBSERVADAS.** Una vuelta que ocurrió con el GPS
 *    callado no está, y llamarlas «vueltas del día» a secas afirmaría sobre el
 *    día lo que sólo vale para lo que el instrumento vio.
 * 3. **Que sin frecuencia declarada no hay contra qué comparar.** Es lo único
 *    que el PLAN pedía y que hoy no se puede dar, y se dice.
 *
 * ## Y un cuarto caso, que no es un hueco: el circuito sin arrancar
 *
 * Antes del día de arranque no hay jornada, y esta pantalla se reemplaza
 * entera. Sus cifras serían todas correctas y todas falsas: «0 vueltas» se lee
 * como que nadie dio una, y «con señal 0 de 5» como que cinco unidades
 * callaron. No callaron — el servicio todavía no existe.
 *
 * ## La puerta
 *
 * Igual que Operar: cuelga de `/jstaff` porque una cuenta de tipo `concesion`
 * todavía no puede entrar a ninguna parte. **La única línea que sabe quién puede
 * entrar es la de abajo**, y mudarla es cambiarla y mover el archivo.
 */

export const dynamic = "force-dynamic";

const mono = "font-[family-name:var(--fuente-mono)]";

export default async function ReportePage({ params }: { params: Promise<{ id: string }> }) {
  // La única línea de audiencia de esta pantalla. Ver el encabezado.
  await exigirEnPagina({ tipo: "jstaff" });

  const { id } = await params;
  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) notFound();

  const ahora = new Date();

  /*
   * ANTES DEL ARRANQUE NO HAY JORNADA, y por eso esto corta aquí arriba.
   *
   * Con el circuito sin arrancar, cada cifra de este reporte sería cierta y
   * diría algo falso: «0 vueltas observadas» se lee como que nadie dio una,
   * «con señal 0 de 5» como que cinco unidades callaron, y «no se puede medir
   * el intervalo» como una carencia del instrumento. Ninguna de las tres es un
   * hueco: no hay nada que medir porque el servicio todavía no existe.
   *
   * Corta ANTES de consultar el historial, y no sólo por ahorro: leer el
   * archivo de una jornada que no empezó es preguntar por algo que no tiene
   * respuesta.
   */
  if (!yaArrancoElServicio(ahora, circuito.serviceLaunchDate, circuito.timeZone)) {
    return (
      <main className="min-h-screen bg-[var(--fondo)] px-4 pt-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Marco
            nombre={circuito.name}
            concesion={(await repos.accounts.findById(circuito.concessionAccountId))?.name ?? null}
            circuitoId={id}
          />
          <SinArrancar
            arrancaEl={circuito.serviceLaunchDate}
            zona={circuito.timeZone}
            abreALas={circuito.serviceStartLocal.slice(0, 5)}
            cierraALas={circuito.serviceEndLocal.slice(0, 5)}
          />
        </div>
      </main>
    );
  }

  /*
   * El día del reporte es la JORNADA DE SERVICIO que corre ahora, no el día
   * civil. Se reusa `aperturaDelHorario`, que ya aguanta que la ventana cruce
   * la medianoche y tiene su prueba: con un servicio de 22:00 a 06:00, a las
   * 02:00 la jornada empezó ayer, y cortar por el día civil partiría la noche
   * en dos reportes que ninguno describe el turno.
   */
  const desde = aperturaDelHorario(ahora, circuito);

  const [concesion, trazados, plan, corteDelArchivo] = await Promise.all([
    repos.accounts.findById(circuito.concessionAccountId),
    repos.circuits.getPaths(id),
    repos.circuits.listPlanDelCircuitoConPosicion(id),
    repos.circuits.ultimoPuntoArchivado(id, desde, ahora),
  ]);

  const filas = await repos.circuits.listHistorialDelCircuito(id, desde, ahora);

  const reporte = armarReporte({
    desde,
    hasta: ahora,
    corteDelArchivo,
    trazados: trazados.map((t) => ({
      sentido: t.sentido,
      coordenadas: t.coordinates as Array<[number, number]>,
    })) satisfies TrazadoParaMedir[],
    corredorMetros: circuito.corridorToleranceMeters,
    frecuenciaDeclaradaMin: circuito.declaredFrequencyMinutes,
    historial: agruparHistorial(
      filas,
      plan.map((u) => ({ unitId: u.unitId, unitLabel: u.unitLabel })),
    ),
  });

  const zona = circuito.timeZone;

  return (
    <main className="min-h-screen bg-[var(--fondo)] px-4 pt-4 pb-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Marco nombre={circuito.name} concesion={concesion?.name ?? null} circuitoId={id} />
        <Dominante reporte={reporte} zona={zona} sinTrazado={reporte.sinTrazado} />
        <Intervalo reporte={reporte} />
        <PorUnidad reporte={reporte} zona={zona} />
      </div>
    </main>
  );
}

/* ── El marco ───────────────────────────────────────────────────────────── */

function Marco({
  nombre,
  concesion,
  circuitoId,
}: {
  nombre: string;
  concesion: string | null;
  circuitoId: string;
}) {
  return (
    <header className="mb-5">
      <Link
        href={`/jstaff/circuitos/${circuitoId}/operar`}
        className={`${mono} text-[11px] tracking-[.1em] text-[var(--tenue)] uppercase hover:text-[var(--texto)]`}
      >
        ← Operar
      </Link>
      <h1 className="mt-1 text-[26px] leading-tight font-bold tracking-[-.02em] text-[var(--texto)]">
        {nombre}
      </h1>
      {concesion ? (
        <p className={`${mono} mt-0.5 truncate text-[12px] text-[var(--tenue)]`}>{concesion}</p>
      ) : null}

      {/* El asiento de Lenore, igual que en Operar y en todos los anchos. */}
      <div
        aria-hidden
        className="mt-3 h-[26px] w-full rounded-md border border-dashed border-[var(--linea)]"
      />

      <p className="mt-3 border-l-2 border-[var(--linea-fuerte)] pl-3 text-[12.5px] leading-snug text-[var(--tenue)]">
        Reporte de la jornada. Aquí se mide y se reporta;{" "}
        <span className="text-[var(--texto)]">no se sella nada</span>, no se emite ningún
        resultado y no se califica a ningún transportista.
      </p>
    </header>
  );
}

/* ── El circuito que todavía no arranca ─────────────────────────────────── */

/**
 * Lo único que esta pantalla puede decir antes del arranque.
 *
 * **Reemplaza al reporte entero, no le pone un aviso encima.** Dejar las
 * secciones con sus ceros y un letrero arriba sería la §D en su forma de
 * agrupación: los ceros seguirían leyéndose como mediciones de una jornada que
 * no ocurrió, y el letrero no los desmiente — los acompaña.
 */
function SinArrancar({
  arrancaEl,
  zona,
  abreALas,
  cierraALas,
}: {
  arrancaEl: string | null;
  zona: string;
  abreALas: string;
  cierraALas: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--linea)] bg-gradient-to-b from-[var(--panel)] to-[var(--panel2)] p-5">
      <p className="text-[30px] leading-none font-extrabold tracking-[-.02em] text-[var(--tenue)]">
        {arrancaEl ? `Arranca el ${fechaCivilLarga(arrancaEl, zona)}` : "Sin arrancar"}
      </p>
      <p className="mt-2 text-[15px] leading-snug text-[var(--texto)]">
        El servicio de este circuito todavía no arranca, así que no hay jornada que reportar. Las
        vueltas, el intervalo entre camiones y la señal de cada unidad se empiezan a medir ese
        día.
      </p>

      <dl className="mt-4 space-y-1.5 border-t border-[var(--linea-tenue)] pt-3">
        {arrancaEl ? (
          <Renglon rotulo="Arranca">
            {fechaCivilLarga(arrancaEl, zona)} · declarado por el concesionario en el expediente
          </Renglon>
        ) : null}
        <Renglon rotulo="Horario">
          {abreALas} a {cierraALas} ({zona})
        </Renglon>
      </dl>
    </section>
  );
}

/* ── Uno · las vueltas observadas ───────────────────────────────────────── */

function Dominante({
  reporte,
  zona,
  sinTrazado,
}: {
  reporte: ReporteDelDia;
  zona: string;
  sinTrazado: boolean;
}) {
  const total = reporte.unidades.reduce(
    (n, u) => n + u.porSentido.reduce((m, s) => m + s.vueltas, 0),
    0,
  );

  return (
    <section className="rounded-lg border border-[var(--linea)] bg-gradient-to-b from-[var(--panel)] to-[var(--panel2)] p-5">
      {sinTrazado ? (
        /*
          Sin trazado no hay contra qué proyectar, y un «0 vueltas» sería cierto
          para su regla y falso como afirmación sobre la jornada: no es que no
          hayan dado vueltas, es que el sistema no tiene con qué contarlas.
          Cambia la forma, no el esqueleto.
        */
        <>
          <p className="text-[30px] leading-none font-extrabold tracking-[-.02em] text-[var(--tenue)]">
            Sin trazado cargado
          </p>
          <p className="mt-2 text-[15px] leading-snug text-[var(--texto)]">
            Las vueltas se cuentan proyectando cada unidad sobre el recorrido. Sin KML no hay
            contra qué medir — no es que no hayan dado vueltas.
          </p>
        </>
      ) : (
        <>
          <p className="flex items-baseline gap-2">
            <span className="text-[56px] leading-none font-extrabold tracking-[-.03em] text-[var(--acero)] tabular-nums">
              {total}
            </span>
            <span className={`${mono} text-[15px] text-[var(--tenue)]`}>
              {total === 1 ? "vuelta" : "vueltas"}
            </span>
          </p>
          {/*
            «OBSERVADAS», y la palabra no es adorno: una vuelta que ocurrió con
            el GPS callado no está en este número. Llamarlas «vueltas de hoy» a
            secas afirmaría sobre la jornada lo que sólo vale para lo que el
            instrumento alcanzó a ver.
          */}
          <p className="mt-2 text-[15px] leading-snug text-[var(--texto)]">
            observadas en la jornada — recorridos completos que el GPS vio de principio a fin
          </p>
        </>
      )}

      <dl className="mt-4 space-y-1.5 border-t border-[var(--linea-tenue)] pt-3">
        <Renglon rotulo="Jornada">
          desde las{" "}
          <span className={`${mono} text-[var(--acero)] tabular-nums`}>
            {localTimeHHMM(reporte.desde, zona)}
          </span>{" "}
          ({zona})
        </Renglon>
        {/*
          EL CORTE DEL ARCHIVO, y va arriba y no al pie.

          El archivador mete su propio retraso, así que este reporte no habla de
          «ahora»: habla hasta el último punto archivado. Sin decirlo, las cifras
          afirmarían sobre la jornada completa lo que sólo vale hasta aquí — que
          es la §D en su forma de alcance. Y el hueco va declarado cuando no hay
          ni un punto: nunca se rellena con la hora del reloj.
        */}
        <Renglon rotulo="Medido hasta">
          {reporte.corteDelArchivo ? (
            <>
              <span className={`${mono} text-[var(--acero)] tabular-nums`}>
                {localDateTimeSeconds(reporte.corteDelArchivo, zona)}
              </span>{" "}
              · el último punto archivado, no la hora del reloj
            </>
          ) : (
            <span className="text-[var(--tenue)]">
              sin un solo punto archivado de esta jornada
            </span>
          )}
        </Renglon>
        <Renglon rotulo="Con señal">
          <span className={`${mono} text-[var(--acero)] tabular-nums`}>{reporte.conSenal}</span> de{" "}
          <span className={`${mono} text-[var(--acero)] tabular-nums`}>{reporte.enElPlan}</span>{" "}
          {reporte.enElPlan === 1 ? "unidad asignada" : "unidades asignadas"}
        </Renglon>
      </dl>
    </section>
  );
}

/* ── Dos · el intervalo observado ───────────────────────────────────────── */

function Intervalo({ reporte }: { reporte: ReporteDelDia }) {
  const puntoPct = Math.round(PUNTO_DE_CONTROL * 100);

  return (
    <section className="mt-4 rounded-lg border border-[var(--linea)] bg-[var(--panel)] p-5">
      <h2
        className={`${mono} text-[11px] tracking-[.1em] text-[var(--tenue)] uppercase`}
      >
        Intervalo entre camiones
      </h2>

      {reporte.intervaloMedianoMin === null ? (
        /*
          Con menos de dos pasadas no hay intervalo que medir, y un cero diría
          que los camiones pasan pegados. Hueco declarado.
        */
        <p className="mt-2 text-[15px] leading-snug text-[var(--texto)]">
          <span className="text-[var(--tenue)]">
            No se puede medir todavía: hace falta que al menos dos unidades crucen el punto de
            control.
          </span>
        </p>
      ) : (
        <>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[38px] leading-none font-extrabold tracking-[-.03em] text-[var(--acero)] tabular-nums">
              {reporte.intervaloMedianoMin.toFixed(1)}
            </span>
            <span className={`${mono} text-[14px] text-[var(--tenue)]`}>min</span>
          </p>
          <p className="mt-1.5 text-[14px] leading-snug text-[var(--texto)]">
            mediana de{" "}
            <span className={`${mono} text-[var(--acero)] tabular-nums`}>
              {reporte.intervalosMedidos}
            </span>{" "}
            {reporte.intervalosMedidos === 1 ? "intervalo medido" : "intervalos medidos"} al{" "}
            {puntoPct}% del recorrido
          </p>
        </>
      )}

      <div className="mt-4 space-y-1.5 border-t border-[var(--linea-tenue)] pt-3">
        {/*
          EL HUECO QUE EL PLAN PEDÍA Y HOY NO SE PUEDE LLENAR.

          El PLAN pide «adelantada / a tiempo / atrasada contra la frecuencia
          declarada». Sin frecuencia declarada no hay contra qué comparar, y
          escoger un número sería exactamente lo que la 0031 vino a quitar: el
          `DEFAULT 20` hacía indistinguibles «declaró 20» y «no declaró nada».
          Se enuncia el hueco y se enciende solo el día que alguien la capture.
        */}
        <Renglon rotulo="Declarada">
          {reporte.frecuenciaDeclaradaMin === null ? (
            <span className="text-[var(--tenue)]">
              el concesionario no ha declarado una frecuencia — sin ella no hay contra qué
              comparar, y el reporte no escoge un número
            </span>
          ) : (
            <>
              cada{" "}
              <span className={`${mono} text-[var(--acero)] tabular-nums`}>
                {reporte.frecuenciaDeclaradaMin}
              </span>{" "}
              min, según el concesionario
            </>
          )}
        </Renglon>
        <Renglon rotulo="De dónde sale">
          de las horas a las que las unidades cruzaron el punto de verdad. No hay velocidad
          estimada de por medio
        </Renglon>
      </div>
    </section>
  );
}

/* ── Tres · unidad por unidad ───────────────────────────────────────────── */

function PorUnidad({ reporte, zona }: { reporte: ReporteDelDia; zona: string }) {
  if (reporte.unidades.length === 0) {
    return (
      <section className="mt-4 rounded-lg border border-[var(--linea)] bg-[var(--panel)] p-5">
        <p className="text-[15px] text-[var(--texto)]">
          El circuito no tiene unidades asignadas, así que no hay jornada que reportar.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-lg border border-[var(--linea)] bg-[var(--panel)] p-5">
      <h2 className={`${mono} text-[11px] tracking-[.1em] text-[var(--tenue)] uppercase`}>
        Unidad por unidad
      </h2>
      <ul className="mt-3 divide-y divide-[var(--linea-tenue)]">
        {reporte.unidades.map((u) => (
          <RenglonDeUnidad key={u.unitId} u={u} zona={zona} />
        ))}
      </ul>
    </section>
  );
}

function RenglonDeUnidad({ u, zona }: { u: ReporteDeUnidad; zona: string }) {
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`${mono} text-[15px] font-medium text-[var(--texto)] tabular-nums`}>
          {u.unitLabel}
        </span>
        {u.puntos === 0 ? (
          /*
            Sin un solo punto no se dibuja un cero: cero vueltas se leería como
            «no trabajó», y lo que el sistema sabe es que no la vio. Un hueco
            declarado vale más que un número inventado.
          */
          <span className={`${mono} text-[12px] text-[var(--tenue)]`}>sin señal en la jornada</span>
        ) : (
          <span className={`${mono} text-[12px] text-[var(--tenue)] tabular-nums`}>
            {u.puntos} puntos
          </span>
        )}
      </div>

      {u.puntos > 0 ? (
        <dl className="mt-1.5 space-y-1">
          {/*
            Las vueltas van SEPARADAS POR SENTIDO y no sumadas en una cifra.
            Tres de ida y cero de vuelta se vería idéntico a tres y tres, y lo
            que se pierde al colapsarlas es justo lo que distingue una jornada
            sana de una rota. §D, eje de la reducción.
          */}
          {u.porSentido.map((s) => (
            <Renglon key={s.sentido} rotulo={s.sentido === "ida" ? "Ida" : "Vuelta"}>
              <span className={`${mono} text-[var(--acero)] tabular-nums`}>{s.vueltas}</span>{" "}
              {s.vueltas === 1 ? "vuelta" : "vueltas"}
              {s.minutosMediana !== null ? (
                <>
                  {" · "}
                  <span className={`${mono} text-[var(--acero)] tabular-nums`}>
                    {duracion(s.minutosMediana)}
                  </span>{" "}
                  {/*
                    «(mediana)» sólo cuando hay de dónde sacar una. Con una sola
                    vuelta la mediana ES esa vuelta, y el rótulo sugiere una
                    distribución que no existe — un dato correcto afirmando de
                    más por el rótulo que lleva encima.
                  */}
                  {s.vueltas > 1 ? "por vuelta (mediana)" : null}
                </>
              ) : null}
              {s.enCurso ? (
                <span className="text-[var(--tenue)]"> · una en curso al cerrar el corte</span>
              ) : null}
            </Renglon>
          ))}

          <Renglon rotulo="Señal">
            {u.primeraSenal && u.ultimaSenal ? (
              <>
                <span className={`${mono} text-[var(--acero)] tabular-nums`}>
                  {localTimeHHMM(u.primeraSenal, zona)}
                </span>{" "}
                a{" "}
                <span className={`${mono} text-[var(--acero)] tabular-nums`}>
                  {localTimeHHMM(u.ultimaSenal, zona)}
                </span>
              </>
            ) : (
              <span className="text-[var(--tenue)]">—</span>
            )}
            {u.fueraDelCorredor > 0 ? (
              <>
                {" · "}
                <span className={`${mono} text-[var(--acero)] tabular-nums`}>
                  {u.fueraDelCorredor}
                </span>{" "}
                {u.fueraDelCorredor === 1 ? "punto" : "puntos"} fuera del corredor
              </>
            ) : null}
          </Renglon>
        </dl>
      ) : null}
    </li>
  );
}

/* ── Piezas ─────────────────────────────────────────────────────────────── */

function Renglon({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <dt
        className={`${mono} shrink-0 text-[10.5px] tracking-[.08em] text-[var(--tenue)] uppercase sm:w-[104px]`}
      >
        {rotulo}
      </dt>
      <dd className="m-0 text-[13.5px] leading-snug text-[var(--texto)]">{children}</dd>
    </div>
  );
}
