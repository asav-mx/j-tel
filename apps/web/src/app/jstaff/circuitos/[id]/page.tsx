import Link from "next/link";
import { notFound } from "next/navigation";
import { addDaysIso, localDateIso, localDateTimeShort } from "@jtel/domain";
import {
  aperturasDeHoy,
  DIAS_DEL_RESUMEN,
  hayRegistro,
  LO_QUE_CUENTA,
  serieDeAperturas,
  type DiaDeAperturas,
} from "@/lib/resumen-de-aperturas";
import { CircuitoEditor } from "@/components/circuito-editor";
import { CircuitoUnidades } from "@/components/circuito-unidades";
import { getRepos } from "@/lib/db";
import { exigirEnPagina } from "@/lib/guardia-pagina";
import {
  faltantesDelCircuito,
  loQueDiraDelArranque,
  loQueDiraLaApp,
  perillasDeMedicion,
  type PerillaDeMedicion,
} from "@/lib/expediente-circuito";

/**
 * **El expediente del circuito** — el primer piso de la cara del concesionario.
 *
 * Un solo lugar donde vive todo lo que define un circuito, y donde se actúa
 * sobre él. Operar es la pantalla de mirar; ésta es la de cambiar, y por eso
 * aquí viven los botones.
 *
 * ## Organizada por lo que el operador viene a hacer
 *
 * Antes era una rejilla de tres columnas rotulada con nombres de columna —«Dato
 * viejo a los (seg)», «Piso del rango (seg)», «Tolerancia de pegado (m)»— y
 * ninguna decía qué pasaba al moverla. Ahora son cinco secciones que contestan
 * cinco preguntas distintas: **quién es y quién lo ve · qué declara el
 * concesionario · cómo se mide · por dónde va · quién lo corre.**
 *
 * ## Las tres reglas que gobiernan la copia
 *
 * 1. **Ningún campo trae valor sugerido que se pueda confundir con declarado.**
 *    La lección de la frecuencia con `DEFAULT 20` no se repite en ningún otro
 *    campo: lo que nace de origen se enuncia como de origen.
 * 2. **Todo número lleva su lectura**, que aquí significa qué le pasa a alguien
 *    cuando se mueve — al pasajero en la banqueta o al operador con el radio.
 * 3. **Cambiar un umbral no reescribe nada del pasado.** El sprint público mide
 *    y reporta, no sella; los cambios son hacia adelante y la pantalla lo dice.
 *
 * ## La puerta de hoy, y cómo se muda
 *
 * Cuelga de `/jstaff` por lo mismo que Operar: hoy una cuenta de tipo
 * `concesion` no puede entrar a ninguna parte —`createConcession` no crea
 * membresía, no hay cara `/concesion` y la guardia sólo conoce
 * `jstaff · cliente · carrier`—. **La única línea que sabe quién puede entrar es
 * la de abajo**: la pantalla no pregunta por membresías, no ramifica por rol y
 * no esconde secciones según quién mire.
 *
 * ## Teléfono primero
 *
 * Igual que Operar. El 10 de septiembre alguien va a estar capturando esto de
 * pie, con el concesionario enfrente. Todo se apila en una columna; lo ancho es
 * una mejora, no el diseño.
 */

export const dynamic = "force-dynamic";

const mono = "font-[family-name:var(--fuente-mono)]";
const campo =
  "w-full rounded border border-[var(--linea)] bg-transparent px-2.5 py-2 text-[15px] text-[var(--texto)]";
const etiqueta = "mb-1 block text-[12.5px] leading-snug text-[var(--texto)]";
const boton =
  "rounded border border-[var(--b-acero)] bg-[var(--t-acero)] px-4 py-2 text-[14px] font-medium text-[var(--acero)] hover:bg-[var(--t-acero2)]";

export default async function ExpedienteDelCircuitoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // La única línea de audiencia de esta pantalla. Ver el encabezado.
  await exigirEnPagina({ tipo: "jstaff" });

  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const ok = typeof sp?.ok === "string" ? sp.ok : null;

  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) notFound();

  /*
   * Hoy EN LA ZONA DEL CIRCUITO, y una sola vez para los dos que lo usan: la
   * lectura del arranque —que tiene que decir lo mismo que decide el endpoint—
   * y la serie de aperturas, que se guardó con esa misma fecha.
   *
   * Con el reloj del servidor, un circuito de otra zona enseñaría la serie
   * corrida un día y el renglón de «hoy» sería el de ayer, sin que nada se
   * rompa.
   */
  const hoyLocal = localDateIso(new Date(), circuito.timeZone);

  const [concesion, trazados, paradas, asignaciones, asignables, aperturas, primerDia] =
    await Promise.all([
      repos.accounts.findById(circuito.concessionAccountId),
      repos.circuits.getPaths(id),
      repos.circuits.listStopsVigentes(id),
      repos.circuits.listAssignments(id),
      repos.circuits.listUnidadesAsignables(circuito.concessionAccountId),
      repos.circuits.resumenDeAperturas(id, addDaysIso(hoyLocal, -(DIAS_DEL_RESUMEN - 1))),
      repos.circuits.primerDiaConAperturas(id),
    ]);

  const serie = serieDeAperturas({
    hoyLocal,
    filas: aperturas.map((a) => ({ localDate: a.localDate, aparatos: a.aparatos })),
    primerDiaConRegistro: primerDia,
  });

  const publicado = circuito.publishedAt !== null;
  const rangoEncendido = circuito.arrivalRangeEnabledAt !== null;
  const unidadesVigentes = asignaciones.filter((a) => !a.validTo).length;

  const faltantes = faltantesDelCircuito({
    trazados: trazados.length,
    paradas: paradas.length,
    unidadesVigentes,
    frecuenciaMin: circuito.declaredFrequencyMinutes,
    rangoEncendido,
    arrancaEl: circuito.serviceLaunchDate,
    zona: circuito.timeZone,
  });

  return (
    <main className="min-h-screen bg-[var(--fondo)] px-4 pt-4 pb-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <Link
              href="/jstaff/circuitos"
              className={`${mono} text-[11px] tracking-[.1em] text-[var(--tenue)] uppercase hover:text-[var(--texto)]`}
            >
              ← Circuitos
            </Link>
            {/*
              El camino natural es al revés del que se construyó: se mira en
              Operar y se viene aquí cuando hay algo que cambiar. Por eso la liga
              va en las dos pantallas.
            */}
            <Link
              href={`/jstaff/circuitos/${id}/operar`}
              className={`${mono} text-[11px] tracking-[.1em] text-[var(--acero)] uppercase hover:text-[var(--texto)]`}
            >
              Operar →
            </Link>
          </div>
          <h1 className="mt-1 text-[26px] leading-tight font-bold tracking-[-.02em] text-[var(--texto)]">
            {circuito.name}
          </h1>
          <p className={`${mono} mt-0.5 truncate text-[12px] text-[var(--tenue)]`}>
            {concesion?.name ?? "sin concesión"} · expediente
          </p>
        </header>

        {error ? <Aviso tono="error">{error}</Aviso> : null}
        {ok ? <Aviso tono="ok">{ok}</Aviso> : null}

        <IdentidadYPublicacion
          circuitoId={id}
          nombre={circuito.name}
          slug={circuito.publicSlug}
          colorHex={circuito.colorHex}
          publicado={publicado}
          publicadoDesde={circuito.publishedAt}
          rangoEncendido={rangoEncendido}
          rangoDesde={circuito.arrivalRangeEnabledAt}
          zona={circuito.timeZone}
          faltantes={faltantes}
          aperturas={serie}
        />

        <LoQueDeclara
          circuitoId={id}
          horaInicio={String(circuito.serviceStartLocal).slice(0, 5)}
          horaFin={String(circuito.serviceEndLocal).slice(0, 5)}
          zona={circuito.timeZone}
          frecuenciaMin={circuito.declaredFrequencyMinutes}
          arrancaEl={circuito.serviceLaunchDate}
          hoyLocal={hoyLocal}
        />

        <ComoSeMide circuitoId={id} perillas={perillasDeMedicion(circuito)} />

        <ElRecorrido
          circuitoId={id}
          pegadoParadasMetros={circuito.stopSnapToleranceMeters}
          trazados={trazados}
          paradas={paradas}
        />

        <LasUnidades
          circuitoId={id}
          zona={circuito.timeZone}
          asignaciones={asignaciones}
          asignables={asignables}
        />
      </div>
    </main>
  );
}

/* ── Piezas comunes ─────────────────────────────────────────────────────── */

function Aviso({ tono, children }: { tono: "error" | "ok"; children: React.ReactNode }) {
  /*
   * Ni verde ni rojo. Guardar un campo no es un veredicto sobre nadie, y los
   * tres colores de resultado están reservados a lo que el árbitro sella — que
   * en concesionado no existe.
   */
  return (
    <p
      className={
        tono === "error"
          ? "mb-4 rounded border border-[var(--b-ambar)] bg-[var(--t-ambar)] p-3 text-[13.5px] text-[var(--texto)]"
          : "mb-4 rounded border border-[var(--b-acero)] bg-[var(--t-acero)] p-3 text-[13.5px] text-[var(--texto)]"
      }
    >
      {tono === "error" ? "⚠ " : "✓ "}
      {children}
    </p>
  );
}

function Seccion({
  id,
  numero,
  titulo,
  pregunta,
  children,
}: {
  id: string;
  numero: string;
  titulo: string;
  pregunta: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-4 scroll-mt-4 rounded-lg border border-[var(--linea)] bg-[var(--panel)] p-4 sm:p-5"
    >
      <h2 className="flex flex-wrap items-baseline gap-x-2">
        {/*
          El número no es decoración: el proceso tiene orden real —identidad,
          declaración, medición, recorrido, unidades— y quien captura por primera
          vez lo recorre así.
        */}
        <span className={`${mono} text-[11px] tracking-[.11em] text-[var(--tenue)]`}>{numero}</span>
        <span className="text-[17px] leading-tight font-semibold text-[var(--texto)]">
          {titulo}
        </span>
      </h2>
      <p className="mt-1 text-[12.5px] leading-snug text-[var(--tenue)]">{pregunta}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Un renglón de medición: rótulo en mono tenue, valor en acero. */
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

/* ── Uno · ¿quién es y quién lo ve? ─────────────────────────────────────── */

function IdentidadYPublicacion({
  circuitoId,
  nombre,
  slug,
  colorHex,
  publicado,
  publicadoDesde,
  rangoEncendido,
  rangoDesde,
  zona,
  faltantes,
  aperturas,
}: {
  circuitoId: string;
  nombre: string;
  slug: string;
  colorHex: string;
  publicado: boolean;
  publicadoDesde: Date | null;
  rangoEncendido: boolean;
  rangoDesde: Date | null;
  zona: string;
  faltantes: ReturnType<typeof faltantesDelCircuito>;
  aperturas: DiaDeAperturas[];
}) {
  return (
    <Seccion
      id="identidad"
      numero="1"
      titulo="Identidad y publicación"
      pregunta="Cómo se llama, por dónde entra el pasajero, y si ya lo ve alguien."
    >
      <form action={`/api/jstaff/circuitos/${circuitoId}`} method="post" className="space-y-3">
        <input type="hidden" name="seccion" value="identidad" />
        <div>
          <label className={etiqueta} htmlFor="nombre">
            Nombre del circuito
          </label>
          <input id="nombre" name="nombre" defaultValue={nombre} className={campo} />
        </div>

        <div>
          <label className={etiqueta} htmlFor="colorHex">
            Color de la ruta
          </label>
          <div className="flex items-center gap-2">
            {/*
              Selector nativo, y al lado el hex escrito. El selector se maneja
              con el pulgar y el hex es el dato: sin él nadie puede repetir el
              color de otra ruta, ni decir cuál es en un mensaje.
            */}
            <input
              id="colorHex"
              name="colorHex"
              type="color"
              defaultValue={colorHex}
              className="h-10 w-14 shrink-0 rounded border border-[var(--linea)] bg-transparent"
            />
            <span className={`${mono} text-[13px] text-[var(--acero)] tabular-nums`}>
              {colorHex.toUpperCase()}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-[var(--tenue)]">
            Con lo que se pinta la ruta en el mapa del pasajero y en el de Operar. Con más rutas en
            la ciudad, el color las distingue antes que el nombre.
          </p>
        </div>

        <button type="submit" className={boton}>
          Guardar identidad
        </button>
      </form>

      <dl className="mt-4 space-y-1.5 border-t border-[var(--linea-tenue)] pt-3">
        <Dato rotulo="Slug público">{slug}</Dato>
      </dl>
      <p className="mt-1 text-[12px] leading-snug text-[var(--tenue)]">
        No se edita: va impreso en el QR de cada parada, y cambiarlo rompe los letreros que ya
        están atornillados al poste.
      </p>

      {/* ── Los dos interruptores ── */}
      <div className="mt-5 space-y-3 border-t border-[var(--linea-tenue)] pt-4">
        <Interruptor
          accion={`/api/jstaff/circuitos/${circuitoId}/publicacion`}
          campoOculto={{ nombre: "publicar", valor: publicado ? "no" : "si" }}
          titulo="Publicar el circuito"
          encendido={publicado}
          desde={publicadoDesde}
          zona={zona}
          // El slug de verdad, no un marcador. `/c/{slug}` escrito literal en la
          // pantalla es un hueco que se quedó sin llenar, y quien lo lee no
          // puede ir a comprobar que la app contesta.
          alPrenderlo={`La app del pasajero empieza a contestar en /c/${slug}: quien escanee el QR ve la ruta y los camiones.`}
          alApagarlo="El endpoint contesta lo mismo que para un slug inventado. No borra nada: trazado, paradas y unidades se quedan."
          textoBoton={publicado ? "Despublicar" : "Publicar"}
        />

        <Interruptor
          accion={`/api/jstaff/circuitos/${circuitoId}/rango`}
          campoOculto={{ nombre: "activar", valor: rangoEncendido ? "no" : "si" }}
          titulo="Mostrar el tiempo estimado de llegada"
          encendido={rangoEncendido}
          desde={rangoDesde}
          zona={zona}
          alPrenderlo="La app le dice al pasajero en cuántos minutos pasa el camión, calculado con la velocidad de abajo."
          alApagarlo="El pasajero sigue viendo el camión moverse en el mapa —eso es verdad observada—; lo único que se calla es el número de minutos."
          textoBoton={rangoEncendido ? "Apagar el tiempo estimado" : "Encender el tiempo estimado"}
        />
      </div>

      {/*
        LA LECTURA VA AQUÍ Y NO EN UNA SECCIÓN PROPIA, porque contesta la
        pregunta que esta sección ya hace: «y si ya lo ve alguien». Una sección
        seis para cuatro renglones habría prometido un tablero que no existe.
      */}
      <Aperturas serie={aperturas} />

      {/*
        Lo que le falta se ENUNCIA, no se bloquea. Publicar sin trazado es
        legítimo —el endpoint contesta igual, con el sentido en nulo— y un
        candado aquí decidiría por quien opera, que es el que sabe si el KML
        llega mañana.
      */}
      <div className="mt-4 border-t border-[var(--linea-tenue)] pt-3">
        <h3 className={`${mono} text-[11px] tracking-[.11em] text-[var(--tenue)] uppercase`}>
          Cómo va armado
        </h3>
        <ul className="mt-2 space-y-1">
          {faltantes.map((f) => (
            <li key={f.que} className="flex flex-wrap gap-x-2 text-[12.5px] leading-snug">
              <span className={`${mono} shrink-0 text-[var(--tenue)]`}>{f.que}</span>
              <span className={`${mono} text-[var(--acero)] tabular-nums`}>{f.cuanto}</span>
              {/*
                Sólo lo que de verdad le falta al pasajero lleva la marca. Un
                «apagado — falta» junto al tiempo estimado empujaba a encenderlo,
                y encenderlo antes de calibrar la velocidad es justo lo que ese
                interruptor existe para impedir. Lo decidido se enseña sin marca:
                está así porque alguien lo dejó así.
              */}
              {f.estado === "falta" ? <span className="text-[var(--tenue)]">— falta</span> : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] leading-snug text-[var(--tenue)]">
          Nada de esto impide publicar. Se enuncia para que se vea, no para decidir por ti. La
          frecuencia sin declarar y el tiempo estimado apagado <strong>no van marcados</strong>:
          son respuestas, no huecos.
        </p>
      </div>
    </Seccion>
  );
}

function Interruptor({
  accion,
  campoOculto,
  titulo,
  encendido,
  desde,
  zona,
  alPrenderlo,
  alApagarlo,
  textoBoton,
}: {
  accion: string;
  campoOculto: { nombre: string; valor: string };
  titulo: string;
  encendido: boolean;
  desde: Date | null;
  zona: string;
  alPrenderlo: string;
  alApagarlo: string;
  textoBoton: string;
}) {
  return (
    <div className="rounded border border-[var(--linea)] bg-[var(--panel2)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[14px] font-medium text-[var(--texto)]">{titulo}</h3>
        {/*
          Encendido/apagado es estado OPERATIVO, no un resultado: va en acero y
          tenue. Un verde aquí lo leería como «bien», y publicar un circuito
          incompleto no es ni bien ni mal — es una decisión de quien opera.
        */}
        <span className={`${mono} text-[11px] tracking-[.08em] uppercase ${encendido ? "text-[var(--acero)]" : "text-[var(--tenue)]"}`}>
          {encendido ? "Encendido" : "Apagado"}
        </span>
      </div>

      {desde ? (
        <p className={`${mono} mt-0.5 text-[11.5px] text-[var(--tenue)] tabular-nums`}>
          desde {localDateTimeShort(desde, zona)}
        </p>
      ) : null}

      {/*
        Cada interruptor dice qué pasa al prenderlo Y qué pasa al apagarlo. La
        segunda mitad es la que evita el error caro: apagar el tiempo estimado
        NO esconde el circuito, y quien no lo sepa no lo apaga aunque deba.
      */}
      <dl className="mt-2 space-y-1">
        <div className="text-[12px] leading-snug">
          <dt className={`${mono} inline text-[var(--tenue)]`}>Prendido: </dt>
          <dd className="inline text-[var(--texto)]">{alPrenderlo}</dd>
        </div>
        <div className="text-[12px] leading-snug">
          <dt className={`${mono} inline text-[var(--tenue)]`}>Apagado: </dt>
          <dd className="inline text-[var(--texto)]">{alApagarlo}</dd>
        </div>
      </dl>

      <form action={accion} method="post" className="mt-3">
        <input type="hidden" name={campoOculto.nombre} value={campoOculto.valor} />
        <button type="submit" className={boton}>
          {textoBoton}
        </button>
      </form>
    </div>
  );
}

/**
 * El contador anónimo, leído. **Lo único de esta pantalla que no se configura.**
 *
 * Enseña UN número —aparatos distinguibles— con lo que ese número no es pegado
 * al lado. El crudo se guarda y no sale: es la señal de raspado, no una cifra de
 * uso, y presentarlo aquí sería exactamente el error que el contador vino a
 * evitar.
 *
 * Y un día sin registro se dibuja como hueco, nunca como cero: antes de que el
 * contador existiera para esta ruta, un «0» afirmaría que nadie abrió la app
 * cuando lo cierto es que nadie estaba contando.
 */
function Aperturas({ serie }: { serie: DiaDeAperturas[] }) {
  const hoy = aperturasDeHoy(serie);

  return (
    <div className="mt-4 border-t border-[var(--linea-tenue)] pt-3">
      <h3 className={`${mono} text-[11px] tracking-[.11em] text-[var(--tenue)] uppercase`}>
        Aperturas de la app
      </h3>

      {!hayRegistro(serie) ? (
        /*
          Se dice UNA vez, en vez de dibujar siete renglones de huecos que ocupan
          espacio para no decir nada. Es el estado del día que esto se despliega.
        */
        <p className="mt-2 text-[12.5px] leading-snug text-[var(--tenue)]">
          Todavía no se ha registrado ninguna apertura de este circuito.
        </p>
      ) : (
        <>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[30px] leading-none font-extrabold tracking-[-.02em] text-[var(--acero)] tabular-nums">
              {hoy === null ? "—" : hoy}
            </span>
            <span className={`${mono} text-[12.5px] text-[var(--tenue)]`}>hoy</span>
          </p>

          <ul className="mt-3 space-y-1">
            {serie.slice(1).map((d) => (
              <li key={d.fecha} className="flex flex-wrap gap-x-2 text-[12.5px] leading-snug">
                <span className={`${mono} shrink-0 text-[var(--tenue)] tabular-nums`}>
                  {d.fecha}
                </span>
                {d.aparatos === null ? (
                  /* Hueco declarado: ese día no se estaba contando. */
                  <span className="text-[var(--tenue)]">sin registro</span>
                ) : (
                  <span className={`${mono} text-[var(--acero)] tabular-nums`}>{d.aparatos}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/*
        El rótulo va pegado a la cifra y no al pie en chico. Las dos advertencias
        son de la misma clase —el número no vale como personas ni como uso
        limpio— y separarlas dejaría a la cifra sola con la mitad de su lectura.
      */}
      <p className="mt-2 text-[12px] leading-snug text-[var(--tenue)]">{LO_QUE_CUENTA}</p>
    </div>
  );
}

/* ── Dos · ¿qué declara el concesionario? ───────────────────────────────── */

function LoQueDeclara({
  circuitoId,
  horaInicio,
  horaFin,
  zona,
  frecuenciaMin,
  arrancaEl,
  hoyLocal,
}: {
  circuitoId: string;
  horaInicio: string;
  horaFin: string;
  zona: string;
  frecuenciaMin: number | null;
  arrancaEl: string | null;
  hoyLocal: string;
}) {
  return (
    <Seccion
      id="declara"
      numero="2"
      titulo="Lo que el concesionario declara"
      pregunta="Lo único de esta pantalla que la app le atribuye a él y dice en voz alta. No sale de una medición nuestra."
    >
      <form action={`/api/jstaff/circuitos/${circuitoId}`} method="post" className="space-y-4">
        <input type="hidden" name="seccion" value="declara" />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="horaInicio">
              Abre a las
            </label>
            <input
              id="horaInicio"
              name="horaInicio"
              type="time"
              defaultValue={horaInicio}
              className={campo}
            />
          </div>
          <div>
            <label className={etiqueta} htmlFor="horaFin">
              Cierra a las
            </label>
            <input
              id="horaFin"
              name="horaFin"
              type="time"
              defaultValue={horaFin}
              className={campo}
            />
          </div>
        </div>
        <p className="text-[12px] leading-snug text-[var(--tenue)]">
          Fuera de este horario la app dice a qué hora abre y no promete nada más. Es lo único que
          se afirma sin evidencia, porque se lee de aquí y no se deduce de un silencio. Un horario
          que cruza la medianoche —de 22:00 a 06:00— funciona: se entiende como servicio nocturno.
        </p>

        <div>
          <label className={etiqueta} htmlFor="zonaHoraria">
            Zona horaria del circuito
          </label>
          <input
            id="zonaHoraria"
            name="zonaHoraria"
            defaultValue={zona}
            className={campo}
            spellCheck={false}
          />
          <p className="mt-1 text-[12px] leading-snug text-[var(--tenue)]">
            Con qué reloj se leen las dos horas de arriba. Nombre de la base IANA, como{" "}
            <span className={mono}>America/Ciudad_Juarez</span>. Si el sistema no la reconoce, no se
            guarda: una zona inventada dejaría al circuito sin contestarle al pasajero.
          </p>
        </div>

        <div className="border-t border-[var(--linea-tenue)] pt-4">
          <label className={etiqueta} htmlFor="frecuenciaMin">
            Cada cuántos minutos pasa una unidad
          </label>
          <input
            id="frecuenciaMin"
            name="frecuenciaMin"
            type="number"
            min={1}
            step={1}
            defaultValue={frecuenciaMin === null ? "" : frecuenciaMin}
            placeholder="vacío = no la declaró"
            className={campo}
            aria-describedby="frecuencia-efecto"
          />
          {/*
            La frase de abajo dice qué produce el valor que está guardado AHORA,
            no una regla general. Vaciar el campo y guardar BORRA la frecuencia,
            y es una acción legítima: si el concesionario deja de declararla, la
            app tiene que dejar de prometerla.
          */}
          <p
            id="frecuencia-efecto"
            className="mt-2 rounded border border-[var(--linea)] bg-[var(--panel2)] p-2.5 text-[12.5px] leading-snug text-[var(--texto)]"
          >
            {loQueDiraLaApp(frecuenciaMin)}
          </p>
          <p className="mt-1.5 text-[12px] leading-snug text-[var(--tenue)]">
            Dejarlo vacío es una respuesta, no un hueco. Vaciar el campo y guardar borra la
            frecuencia que hubiera.
          </p>
        </div>

        <div className="border-t border-[var(--linea-tenue)] pt-4">
          <label className={etiqueta} htmlFor="arrancaEl">
            Día en que arranca el servicio
          </label>
          <input
            id="arrancaEl"
            name="arrancaEl"
            type="date"
            defaultValue={arrancaEl ?? ""}
            className={campo}
            aria-describedby="arranque-efecto"
          />
          {/*
            La frase dice qué produce el valor guardado AHORA, igual que la de
            la frecuencia. Aquí importa más: un campo de fecha vacío se lee
            fácil como «arranca hoy», y es al revés — vacío significa que el
            circuito ya opera.
          */}
          <p
            id="arranque-efecto"
            className="mt-2 rounded border border-[var(--linea)] bg-[var(--panel2)] p-2.5 text-[12.5px] leading-snug text-[var(--texto)]"
          >
            {loQueDiraDelArranque(arrancaEl, hoyLocal, zona)}
          </p>
          <p className="mt-1.5 text-[12px] leading-snug text-[var(--tenue)]">
            Se lee con el reloj de la zona de arriba: el servicio arranca a las 00:00 de ese día,
            y de ahí en adelante manda el horario. Vaciar el campo y guardar borra la fecha, y el
            circuito pasa a operar desde ya.
          </p>
        </div>

        <button type="submit" className={boton}>
          Guardar lo declarado
        </button>
      </form>
    </Seccion>
  );
}

/* ── Tres · ¿cómo se mide? ──────────────────────────────────────────────── */

function ComoSeMide({
  circuitoId,
  perillas,
}: {
  circuitoId: string;
  perillas: PerillaDeMedicion[];
}) {
  return (
    <Seccion
      id="medicion"
      numero="3"
      titulo="Cómo se mide"
      pregunta="Los umbrales del instrumento. No son declaración de nadie: son hasta dónde el sistema puede afirmar algo."
    >
      {/*
        La ley de esta sección, arriba y no al pie en chico. En concesionado no
        hay hecho sellado del que colgar un umbral congelado: el motor mide y
        reporta. Mover cualquiera de estos números cambia lo que la app dice de
        aquí en adelante y no toca una sola posición ya guardada.
      */}
      <p className="mb-4 border-l-2 border-[var(--linea-fuerte)] pl-3 text-[12.5px] leading-snug text-[var(--tenue)]">
        Cambiar cualquiera de estos números{" "}
        <span className="text-[var(--texto)]">no reescribe nada de lo que ya pasó</span>. Los
        cambios valen hacia adelante: la app y la pantalla de Operar empiezan a medir así desde el
        siguiente corte.
      </p>

      <form action={`/api/jstaff/circuitos/${circuitoId}`} method="post" className="space-y-5">
        <input type="hidden" name="seccion" value="medicion" />

        {perillas.map((p) => (
          <div key={p.campo}>
            <label className={etiqueta} htmlFor={p.campo}>
              {p.rotulo}{" "}
              <span className={`${mono} text-[var(--tenue)]`}>({p.unidad})</span>
            </label>
            <input
              id={p.campo}
              name={p.campo}
              type="number"
              min={p.paso}
              step={p.paso}
              defaultValue={p.valor}
              className={campo}
              aria-describedby={`${p.campo}-lectura`}
            />
            <p
              id={`${p.campo}-lectura`}
              className="mt-1.5 text-[12.5px] leading-snug text-[var(--texto)]"
            >
              {p.lectura}
            </p>
            {/*
              La procedencia sólo se enseña cuando el valor guardado COINCIDE
              con el de origen. Enseñarla siempre diría de dónde salió un número
              que ya nadie usa, y en un ajuste hecho a mano sería falso.

              Y dice «igual al valor de origen», nunca «sin ajustar»: un 180
              heredado y un 180 tecleado son indistinguibles en la base. Es el
              mismo hueco que tenía la frecuencia, y sólo lo cierra un registro
              de cambios — que todavía no existe.
            */}
            {p.igualAlOrigen ? (
              <p className="mt-1 text-[12px] leading-snug text-[var(--tenue)]">
                <span className={mono}>Igual al valor de origen ({p.origen}).</span>{" "}
                {p.procedencia}
              </p>
            ) : (
              <p className="mt-1 text-[12px] leading-snug text-[var(--tenue)]">
                <span className={mono}>Ajustado.</span> El valor de origen es {p.origen}.
              </p>
            )}
          </div>
        ))}

        <button type="submit" className={boton}>
          Guardar la medición
        </button>
      </form>
    </Seccion>
  );
}

/* ── Cuatro · ¿por dónde va? ────────────────────────────────────────────── */

function ElRecorrido({
  circuitoId,
  pegadoParadasMetros,
  trazados,
  paradas,
}: {
  circuitoId: string;
  pegadoParadasMetros: number;
  trazados: Awaited<ReturnType<ReturnType<typeof getRepos>["circuits"]["getPaths"]>>;
  paradas: Awaited<ReturnType<ReturnType<typeof getRepos>["circuits"]["listStopsVigentes"]>>;
}) {
  return (
    <Seccion
      id="recorrido"
      numero="4"
      titulo="El recorrido"
      pregunta="El trazado de cada sentido y las paradas con su nombre. La llegada se calcula sobre el trazado, no sobre las paradas: un circuito funciona sin ninguna."
    >
      <CircuitoEditor
        circuitoId={circuitoId}
        toleranciaMetros={pegadoParadasMetros}
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
    </Seccion>
  );
}

/* ── Cinco · ¿quién lo corre? ───────────────────────────────────────────── */

function LasUnidades({
  circuitoId,
  zona,
  asignaciones,
  asignables,
}: {
  circuitoId: string;
  zona: string;
  asignaciones: Awaited<ReturnType<ReturnType<typeof getRepos>["circuits"]["listAssignments"]>>;
  asignables: Awaited<
    ReturnType<ReturnType<typeof getRepos>["circuits"]["listUnidadesAsignables"]>
  >;
}) {
  return (
    <Seccion
      id="unidades"
      numero="5"
      titulo="Las unidades asignadas"
      pregunta="Qué camiones corren este circuito, desde cuándo, y de qué transportista. Fuera de asignación, una unidad no existe para el pasajero."
    >
      <CircuitoUnidades
        circuitoId={circuitoId}
        zonaHoraria={zona}
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
    </Seccion>
  );
}
