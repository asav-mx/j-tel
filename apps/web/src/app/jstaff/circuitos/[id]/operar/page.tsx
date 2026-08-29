import Link from "next/link";
import { notFound } from "next/navigation";
import { localDateTimeSeconds, localDateTimeShort } from "@jtel/domain";
import type { TrazadoDeSentido } from "@jtel/domain/publico";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import { duracion } from "@/lib/formato-tiempo";
import { armarOperacion, type Operacion, type UnidadOperando } from "@/lib/operar-circuito";
import { OperarMapa } from "@/components/operar-mapa";
import { FrescuraDelCorte } from "@/components/frescura-del-corte";

/**
 * **Operar** — el día a día del concesionario sobre un circuito.
 *
 * La pantalla contesta tres preguntas en este orden: cuántas están dando
 * servicio, quién necesita atención, y dónde van. Nada más: velocidades,
 * kilómetros, vueltas, porcentajes e historia son otro piso y no entran.
 *
 * ## La puerta de hoy, y cómo se muda
 *
 * Cuelga de `/jstaff` porque **hoy una cuenta de tipo `concesion` no puede
 * entrar a ninguna parte**: `createConcession` crea la cuenta y su perfil y no
 * crea membresía, no hay cara `/concesion`, y la guardia sólo conoce
 * `jstaff · cliente · carrier`. Darle puerta propia al concesionario es un
 * frente de autenticación aparte, no algo que se resuelva de paso aquí.
 *
 * Por eso **la única línea que sabe quién puede entrar es la de abajo.** La
 * pantalla no pregunta por membresías, no ramifica por rol y no esconde
 * secciones según quién mire: recibe una concesión y un circuito cualesquiera y
 * los dibuja. El día que exista la cara del concesionario, mudarla es cambiar
 * esa línea y mover el archivo de carpeta.
 *
 * ## Teléfono primero
 *
 * El concesionario no usa computadora. Todo se apila en una columna, el mapa
 * ocupa media pantalla y lo ancho es una mejora, no el diseño.
 */

export const dynamic = "force-dynamic";

const mono = "font-[family-name:var(--fuente-mono)]";

export default async function OperarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // La única línea de audiencia de esta pantalla. Ver el encabezado.
  await exigirEnPagina({ tipo: "jstaff" });

  const { id } = await params;
  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) notFound();

  const [concesion, trazados, paradas, plan] = await Promise.all([
    repos.accounts.findById(circuito.concessionAccountId),
    repos.circuits.getPaths(id),
    repos.circuits.listStopsVigentes(id),
    repos.circuits.listPlanDelCircuitoConPosicion(id),
  ]);

  /*
   * La hora del corte se toma UNA vez y se usa para todo: el número, las
   * antigüedades y el rótulo. Tomarla dos veces produciría una pantalla donde
   * el encabezado y la lista hablan de instantes distintos por unos
   * milisegundos, que es de las cosas que sólo se notan cuando ya no se puede
   * explicar por qué el 3 de arriba no cuadra con los renglones de abajo.
   */
  const ahora = new Date();

  const trazadosDeSentido: TrazadoDeSentido[] = trazados.map((t) => ({
    sentido: t.sentido,
    coordinates: t.coordinates as Array<[number, number]>,
  }));

  const op = armarOperacion({
    ahora,
    circuito,
    trazados: trazadosDeSentido,
    paradas,
    plan,
  });

  const zona = circuito.timeZone;
  const abreALas = circuito.serviceStartLocal.slice(0, 5);
  const cierraALas = circuito.serviceEndLocal.slice(0, 5);

  return (
    <main className="min-h-screen bg-[var(--fondo)] px-4 pt-4 pb-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <MarcoSuperior
          nombre={circuito.name}
          concesion={concesion?.name ?? null}
          circuitoId={id}
        />

        <Dominante
          op={op}
          zona={zona}
          abreALas={abreALas}
          cierraALas={cierraALas}
          umbralFrescuraSeg={circuito.staleAfterSeconds}
          corredorMetros={circuito.corridorToleranceMeters}
        />

        {op.atencion.length > 0 ? (
          <Atencion op={op} zona={zona} abreALas={abreALas} />
        ) : null}

        <Mapa
          op={op}
          trazados={trazadosDeSentido}
          colorTrazado={circuito.colorHex}
          hayTrazado={trazados.length > 0}
        />

        <PlanDelDia op={op} zona={zona} abreALas={abreALas} cierraALas={cierraALas} />

        <AlExpediente circuitoId={id} />
      </div>
    </main>
  );
}

/* ── El marco superior ──────────────────────────────────────────────────── */

function MarcoSuperior({
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
      <div className="min-w-0">
        <Link
          href={`/jstaff/circuitos/${circuitoId}`}
          className={`${mono} text-[11px] tracking-[.1em] text-[var(--tenue)] uppercase hover:text-[var(--texto)]`}
        >
          ← Expediente del circuito
        </Link>
        <h1 className="mt-1 text-[26px] leading-tight font-bold tracking-[-.02em] text-[var(--texto)]">
          {nombre}
        </h1>
        {concesion ? (
          <p className={`${mono} mt-0.5 truncate text-[12px] text-[var(--tenue)]`}>{concesion}</p>
        ) : null}
      </div>

      {/*
        El asiento de Lenore.

        Va vacío a propósito y ocupa su lugar desde hoy: cuando el copiloto
        entre, entra AQUÍ, y el marco no se rediseña ni se le mueve el título al
        operador que ya se acostumbró a dónde está cada cosa. Un hueco declarado
        es más barato que un rediseño.

        **De una línea y en TODOS los anchos**, no una caja que aparece a partir
        de la tableta. Reservarlo sólo en ancho no reserva nada: el
        concesionario abre esto en el teléfono siempre, así que el rediseño que
        el asiento existe para evitar ocurriría exactamente donde no estaba
        reservado. Y de una línea porque el copiloto habla en una frase.
      */}
      <div
        aria-hidden
        className="mt-3 h-[26px] w-full rounded-md border border-dashed border-[var(--linea)]"
      />

      {/*
        La leyenda, permanente y no al pie en chico.

        En concesionado el motor MIDE Y REPORTA: no hay sello, no hay veredicto
        y no hay cierre del que salga un resultado. Decirlo arriba es lo que
        impide que un renglón de esta pantalla se lea como una falta imputada a
        un transportista.
      */}
      <p className="mt-3 border-l-2 border-[var(--linea-fuerte)] pl-3 text-[12.5px] leading-snug text-[var(--tenue)]">
        Vista en vivo. Aquí se mide y se reporta;{" "}
        <span className="text-[var(--texto)]">no se sella nada</span> y no se emite ningún
        resultado.
      </p>
    </header>
  );
}

/* ── Uno · ¿cuántas están dando servicio? ───────────────────────────────── */

function Dominante({
  op,
  zona,
  abreALas,
  cierraALas,
  umbralFrescuraSeg,
  corredorMetros,
}: {
  op: Operacion;
  zona: string;
  abreALas: string;
  cierraALas: string;
  umbralFrescuraSeg: number;
  corredorMetros: number;
}) {
  return (
    <section className="rounded-lg border border-[var(--linea)] bg-gradient-to-b from-[var(--panel)] to-[var(--panel2)] p-5">
      {op.enHorario ? (
        <>
          <p className="flex items-baseline gap-2">
            <span className="text-[56px] leading-none font-extrabold tracking-[-.03em] text-[var(--acero)] tabular-nums">
              {op.enRuta}
            </span>
            <span className={`${mono} text-[15px] text-[var(--tenue)] tabular-nums`}>
              de {op.enElPlan}
            </span>
          </p>
          {/*
            La lectura dice QUÉ son los dos números, no los vuelve a contar.
            Decía «de las 6 que el circuito tiene asignadas» con el 6 ya escrito
            arriba: un número repetido obliga a comprobar que los dos digan lo
            mismo, y esa comprobación es trabajo que la pantalla le pasa a quien
            lee. Un rótulo nombra; no recuenta.
          */}
          <p className="mt-2 text-[15px] leading-snug text-[var(--texto)]">
            en ruta ahora, de las unidades asignadas al circuito
          </p>
        </>
      ) : (
        <>
          {/*
            Cerrado, el «0 de 5» sería cierto y se leería como un reproche. Lo
            que ocupa el lugar del número es el hecho que manda: el circuito no
            está operando, así que no hay nada que contar.
          */}
          <p className="text-[34px] leading-none font-extrabold tracking-[-.02em] text-[var(--tenue)]">
            Fuera de horario
          </p>
          <p className="mt-2 text-[15px] leading-snug text-[var(--texto)]">
            El circuito abre a las{" "}
            <span className={`${mono} text-[var(--acero)] tabular-nums`}>{abreALas}</span>. Tiene{" "}
            <span className={`${mono} text-[var(--acero)] tabular-nums`}>{op.enElPlan}</span>{" "}
            {op.enElPlan === 1 ? "unidad asignada" : "unidades asignadas"}.
          </p>
        </>
      )}

      <dl className="mt-4 space-y-1.5 border-t border-[var(--linea-tenue)] pt-3">
        <Renglon rotulo="Corte">
          {localDateTimeSeconds(op.ahora, zona)} · hora local del circuito ({zona})
        </Renglon>
        <Renglon rotulo="Horario">
          {abreALas} a {cierraALas}
        </Renglon>
        {op.enHorario ? (
          <Renglon rotulo="En ruta es">
            señal de menos de {duracion(umbralFrescuraSeg / 60)} y dentro del corredor de{" "}
            {Math.round(corredorMetros)} m — la misma medición que ve el pasajero
          </Renglon>
        ) : null}
      </dl>

      {/*
        Lo único de la pantalla que se mueve sin que llegue un dato nuevo, y se
        mueve envejeciendo. La hora del corte de arriba es la evidencia; esto es
        para que a los veinte minutos la pantalla no se siga viendo igual de
        firme que al segundo uno.
      */}
      <FrescuraDelCorte corteIso={op.ahora.toISOString()} />
    </section>
  );
}

function Renglon({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-[12.5px] leading-snug">
      <dt className={`${mono} shrink-0 tracking-[.06em] text-[var(--tenue)] uppercase`}>
        {rotulo}
      </dt>
      <dd className={`${mono} min-w-0 text-[var(--acero)] tabular-nums`}>{children}</dd>
    </div>
  );
}

/* ── Dos · ¿quién necesita atención? ────────────────────────────────────── */

function Atencion({ op, zona, abreALas }: { op: Operacion; zona: string; abreALas: string }) {
  const sinSenal = op.atencion.filter((u) => u.situacion === "sin_senal");
  const noHanSalido = op.atencion.filter((u) => u.situacion === "no_ha_salido");
  const desdeQueAbrio = op.aperturaDelHorario
    ? duracion((op.ahora.getTime() - op.aperturaDelHorario.getTime()) / 60_000)
    : null;

  return (
    <section className="mt-4 rounded-lg border border-[var(--b-ambar)] bg-[var(--t-ambar)] p-4">
      <h2 className="text-[15px] font-semibold text-[var(--texto)]">Qué necesita atención</h2>
      {/*
        El ámbar marca la sección, no a la unidad. Ninguno de estos renglones
        dice que alguien haya incumplido: dicen qué se planeó y qué se ve, y son
        dos cosas que pueden no coincidir por razones que la pantalla no conoce
        —taller, cambio de rol, una prueba de campo—. Quien sabe eso es el
        operador, y por eso decide él.
      */}
      <p className="mt-1 text-[12.5px] leading-snug text-[var(--tenue)]">
        El plan y lo que el GPS ve, uno frente al otro. No es una falta ni un resultado.
      </p>

      {sinSenal.length > 0 ? (
        <Grupo
          titulo="Sin señal"
          nota="Estaba reportando en el corredor y dejó de hacerlo."
          cuantas={sinSenal.length}
        >
          {sinSenal.map((u) => (
            <Renglones key={u.assignmentId} u={u}>
              <Dato rotulo="Sin señal desde hace">
                {duracion((u.medida?.antiguedadSeg ?? 0) / 60)}
              </Dato>
              <Dato rotulo="Última señal">
                {u.recordedAt ? localDateTimeSeconds(u.recordedAt, zona) : "—"}
              </Dato>
              <Dato rotulo="Dónde se vio">
                sobre el corredor
                {u.paradaMasCercana
                  ? ` · a ${metros(u.paradaMasCercana.metros)} de ${u.paradaMasCercana.name}`
                  : ""}
              </Dato>
            </Renglones>
          ))}
        </Grupo>
      ) : null}

      {noHanSalido.length > 0 ? (
        <Grupo
          titulo="Asignada y no ha salido"
          nota="El circuito ya abrió y su GPS no la ve en el corredor."
          cuantas={noHanSalido.length}
        >
          {noHanSalido.map((u) => (
            <Renglones key={u.assignmentId} u={u}>
              {/*
                El horario es del CIRCUITO y así se escribe. La franja horaria
                por unidad —«la 10249 sale a las 07:00»— no existe en el modelo,
                y escribirla como si existiera sería inventar una hora que nadie
                declaró para que el renglón se vea completo.
              */}
              <Dato rotulo="El circuito abrió">
                a las {abreALas}
                {desdeQueAbrio ? ` · hace ${desdeQueAbrio}` : ""}
              </Dato>
              {u.medida ? (
                <>
                  <Dato rotulo="Su GPS la ve">
                    {u.distanciaAlCorredorMetros !== null
                      ? `a ${metros(u.distanciaAlCorredorMetros)} del corredor`
                      : "fuera del corredor"}
                    {u.paradaMasCercana
                      ? ` · lo más cerca de ${u.paradaMasCercana.name}`
                      : ""}
                  </Dato>
                  <Dato rotulo="Última señal">
                    {u.recordedAt ? localDateTimeSeconds(u.recordedAt, zona) : "—"} · hace{" "}
                    {duracion(u.medida.antiguedadSeg / 60)}
                  </Dato>
                </>
              ) : (
                /*
                  Sin una sola señal no se finge una distancia ni una hora. El
                  hueco declarado vale más que un número inventado, y esta es
                  justo la unidad que la consulta vieja dejaba fuera de la lista
                  sin decir nada.
                */
                <Dato rotulo="Su GPS">
                  no ha reportado nunca desde esta unidad
                </Dato>
              )}
            </Renglones>
          ))}
        </Grupo>
      ) : null}
    </section>
  );
}

function Grupo({
  titulo,
  nota,
  cuantas,
  children,
}: {
  titulo: string;
  nota: string;
  cuantas: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3 className="flex flex-wrap items-baseline gap-x-2">
        <span className={`${mono} text-[11px] tracking-[.11em] text-[var(--ambar)] uppercase`}>
          {titulo}
        </span>
        <span className={`${mono} text-[11px] text-[var(--tenue)] tabular-nums`}>{cuantas}</span>
      </h3>
      <p className="mt-0.5 text-[12px] leading-snug text-[var(--tenue)]">{nota}</p>
      <ul className="mt-2 space-y-2">{children}</ul>
    </div>
  );
}

function Renglones({ u, children }: { u: UnidadOperando; children: React.ReactNode }) {
  return (
    <li className="rounded border border-[var(--linea)] bg-[var(--panel)] p-3">
      <Identidad u={u} />
      <dl className="mt-2 space-y-1">{children}</dl>
    </li>
  );
}

function Identidad({ u }: { u: UnidadOperando }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={`${mono} text-[16px] font-medium text-[var(--texto)] tabular-nums`}>
        {u.unitLabel}
      </span>
      {u.plateNumber ? (
        <span className={`${mono} text-[11.5px] text-[var(--tenue)]`}>{u.plateNumber}</span>
      ) : null}
      <span className="text-[11.5px] text-[var(--tenue)]">{u.carrierName}</span>
    </p>
  );
}

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-[12.5px] leading-snug">
      <dt className={`${mono} shrink-0 tracking-[.06em] text-[var(--tenue)] uppercase`}>
        {rotulo}
      </dt>
      <dd className={`${mono} min-w-0 text-[var(--acero)] tabular-nums`}>{children}</dd>
    </div>
  );
}

/* ── Tres · ¿dónde van? ─────────────────────────────────────────────────── */

function Mapa({
  op,
  trazados,
  colorTrazado,
  hayTrazado,
}: {
  op: Operacion;
  trazados: TrazadoDeSentido[];
  colorTrazado: string;
  hayTrazado: boolean;
}) {
  /*
   * Se dibujan las que tienen una posición, frescas o no. Las calladas van
   * apagadas y con su «hace N min»: un camión que perdió señal no se fue a
   * ningún lado, pero tampoco está donde dice el punto en este segundo, y las
   * dos cosas tienen que verse a la vez.
   *
   * Las que no han reportado nunca NO se dibujan, y no es un olvido: no hay
   * dónde ponerlas. Se cuentan al pie para que su ausencia del mapa sea un
   * dato y no un hueco.
   */
  const dibujables = op.unidades
    .filter((u) => u.medida !== null && u.latitude !== null && u.longitude !== null)
    .map((u) => ({
      unitId: u.unitId,
      unitLabel: u.unitLabel,
      lat: u.latitude as number,
      lon: u.longitude as number,
      fresco: u.medida!.fresco,
      antiguedadSeg: u.medida!.antiguedadSeg,
      enCorredor: u.medida!.enCorredor,
    }));

  const sinPosicion = op.unidades.length - dibujables.length;

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-[15px] font-semibold text-[var(--texto)]">Dónde van</h2>

      {hayTrazado ? (
        <OperarMapa trazados={trazados} unidades={dibujables} colorTrazado={colorTrazado} />
      ) : (
        /*
          Sin trazado no hay mapa. Dibujar unidades sobre una ciudad vacía
          afirmaría que van sobre un recorrido que el circuito todavía no tiene
          cargado — y sin trazado tampoco se puede decir quién está en corredor.
        */
        <p className="rounded-lg border border-dashed border-[var(--linea)] p-5 text-[13px] text-[var(--tenue)]">
          Este circuito todavía no tiene trazado cargado, así que no hay recorrido sobre el cual
          dibujar. Se sube en el expediente del circuito.
        </p>
      )}

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--tenue)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[9px] w-[9px] rounded-full bg-[var(--acero)]" />
          con señal fresca
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[9px] w-[9px] rounded-full bg-[var(--tenue)]" />
          callada, con cuánto hace que se le vio
        </span>
        {sinPosicion > 0 ? (
          <span className={mono}>
            {sinPosicion} sin posición, no se {sinPosicion === 1 ? "dibuja" : "dibujan"}
          </span>
        ) : null}
      </p>
    </section>
  );
}

/* ── El plan del día ────────────────────────────────────────────────────── */

function PlanDelDia({
  op,
  zona,
  abreALas,
  cierraALas,
}: {
  op: Operacion;
  zona: string;
  abreALas: string;
  cierraALas: string;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-semibold text-[var(--texto)]">El plan de hoy</h2>
      {/*
        «El plan de hoy» son las asignaciones VIGENTES, y hay que decirlo así:
        el modelo guarda vigencia por fechas abiertas, no un rol por día. Si el
        rótulo dijera «hoy» a secas, el lector entendería que alguien armó una
        lista esta mañana, y nadie la armó.
      */}
      <p className="mt-1 text-[12.5px] leading-snug text-[var(--tenue)]">
        Las unidades con asignación vigente al circuito. El horario es del circuito —{" "}
        {abreALas} a {cierraALas} — y es el mismo para todas: la franja horaria por unidad
        todavía no se declara en el sistema.
      </p>

      {op.unidades.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--linea)] p-5 text-[13px] text-[var(--tenue)]">
          Este circuito no tiene ninguna unidad asignada. Se asignan en el expediente del
          circuito.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--linea-tenue)] rounded-lg border border-[var(--linea)] bg-[var(--panel)]">
          {op.unidades.map((u) => (
            <li key={u.assignmentId} className="p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Identidad u={u} />
                <span className={`${mono} text-[11.5px] text-[var(--tenue)] tabular-nums`}>
                  {abreALas}–{cierraALas}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-[var(--acero)]">
                {enPalabras(u, zona)}
              </p>
              <p className={`${mono} mt-0.5 text-[11px] text-[var(--tenue)] tabular-nums`}>
                Asignada desde {localDateTimeShort(u.assignedFrom, zona)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * El estado de una unidad, en palabras y sin adjetivos.
 *
 * Ninguna de estas frases juzga. «No ha salido» describe lo que el GPS ve, no
 * lo que la unidad debió hacer; el sistema no sabe si está en el taller, si la
 * mandaron a cubrir otra cosa, o si es una prueba de campo.
 */
function enPalabras(u: UnidadOperando, zona: string): string {
  switch (u.situacion) {
    case "fuera_de_horario":
      return "El circuito está cerrado.";
    case "en_ruta":
      return `En ruta · señal de hace ${duracion((u.medida?.antiguedadSeg ?? 0) / 60)}.`;
    case "sin_senal":
      return `Sin señal desde hace ${duracion((u.medida?.antiguedadSeg ?? 0) / 60)} · la última se vio sobre el corredor${
        u.recordedAt ? `, ${localDateTimeShort(u.recordedAt, zona)}` : ""
      }.`;
    case "no_ha_salido":
      if (!u.medida) return "Su GPS no ha reportado nunca desde esta unidad.";
      return `Su GPS la ve fuera del corredor${
        u.distanciaAlCorredorMetros !== null
          ? `, a ${metros(u.distanciaAlCorredorMetros)}`
          : ""
      } · señal de hace ${duracion(u.medida.antiguedadSeg / 60)}.`;
  }
}

/* ── Se mira aquí, se actúa en el expediente ────────────────────────────── */

function AlExpediente({ circuitoId }: { circuitoId: string }) {
  return (
    <section className="mt-6 rounded-lg border border-[var(--linea)] bg-[var(--panel)] p-4">
      <Link
        href={`/jstaff/circuitos/${circuitoId}`}
        className="inline-block rounded border border-[var(--azul)]/40 bg-[var(--azul)]/10 px-4 py-2 text-[13.5px] font-medium text-[var(--texto)] hover:border-[var(--azul)]"
      >
        Abrir el expediente del circuito →
      </Link>
      <p className="mt-2 text-[12.5px] leading-snug text-[var(--tenue)]">
        Aquí se mira. Subir o bajar una unidad, mover el trazado y las paradas se hace en el
        expediente: esta pantalla no ejecuta cambios.
      </p>
    </section>
  );
}

/** Metros hasta el kilómetro, y de ahí en kilómetros. Exacto, sin «~». */
function metros(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
