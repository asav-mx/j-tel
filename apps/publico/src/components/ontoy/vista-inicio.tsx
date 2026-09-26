"use client";

import type { RutaDeLaCiudad, Sentido } from "@/lib/ontoy/forma";
import type { ParadaGuardada } from "@/lib/ontoy/paradas-guardadas";
import type { Ubicacion } from "@/lib/ubicacion";
import { Ontoy, type PoseDeOntoy } from "@/components/ontoy/ontoy-muneco";
import { ciudadCerrada, vuelvenEnPalabras } from "@/lib/ontoy/noche-de-la-ciudad";
import { RenglonDeParada, TarjetaDelProximoCamion } from "@/components/ontoy/atajo-de-parada";
import type { Vivo } from "@/lib/ontoy/forma";
import { useParadasDeLaCiudad } from "@/lib/ontoy/usar-paradas-de-la-ciudad";
import type { EstadoDeRuta } from "@/lib/ontoy/estado-de-ruta";
import { RutasDeInicio } from "@/components/ontoy/rutas-de-inicio";
import { fechaDelAviso, type AvisoEnLaCampana } from "@/lib/ontoy/avisos";
import { GlifoAviso, GlifoLuna, GlifoSol } from "@/components/ontoy/glifos";
import { esImprecisa, margenEnPalabras } from "@/lib/ontoy/distancia";

/**
 * **Inicio** — la app abre contestando (8.8, 22-sep).
 *
 * Dos cosas, en este orden:
 *
 * 1. **Tu parada guardada** con su próximo camión y su promesa (8.8b). Es lo
 *    que el pasajero de todos los días viene a buscar, y por eso va primero.
 * 2. **Las rutas**, siempre: tres a la vista y el resto tras un botón. Con
 *    ubicación van ordenadas por cercanía y cada una dice **por dónde se
 *    toma**; sin ubicación, alfabéticas. Ahí vive el único camino a la lista
 *    completa de la ciudad — «Ir a» quedó sólo como buscador.
 *
 * ## Por qué ya no hay una sección de «Paradas cerca de ti»
 *
 * La había, y decía lo mismo que las rutas de abajo con los mismos números: la
 * misma ruta, la misma distancia, un bloque encima del otro. Se fundieron
 * (ASAV, 22-sep, tarde): ahora **el renglón de la ruta nombra su parada** y
 * tocarlo abre esa parada. Una lista en vez de dos.
 *
 * Con ella se fueron sus estados bloqueantes. Sin ubicación esa sección no
 * tenía nada que enseñar, así que un permiso negado se llevaba la pantalla
 * entera; ahora la lista de rutas está completa de todos modos y la falta de
 * ubicación es una nota, no un muro.
 *
 * ## La ubicación
 *
 * **No se pide al abrir** (decisión de ASAV, 22-sep): se pide con el botón «Ver
 * rutas cerca de mí», y si el pasajero ya la había dado se usa sin volver a
 * preguntar. Si dice que no, la app sirve completa (8.7).
 *
 * La lista de paradas de la ciudad (`/api/circuitos/paradas-de-la-ciudad`) se
 * baja sólo cuando hace falta —con ubicación concedida—, **una vez**, y el
 * cruce ocurre en el teléfono (8.3b). La petición no lleva nada del pasajero.
 */
export function VistaInicio({
  rutas,
  estados,
  guardadas,
  guardadasListas,
  puedeGuardar,
  ubicacion,
  alAbrirRuta,
  alQuitarGuardada,
  alVerTusParadas,
  enVivo,
  avisos,
  avisosNuevos,
  alVerAvisos,
  deNoche: pielDeNoche,
  alAlternarPiel,
  rutasAbiertas = false,
}: {
  rutas: RutaDeLaCiudad[];
  estados: EstadoDeRuta[];
  guardadas: ParadaGuardada[];
  /** Si ya se leyó el teléfono: antes, «ninguna guardada» todavía no es cierto. */
  guardadasListas: boolean;
  puedeGuardar: boolean;
  ubicacion: Ubicacion;
  alAbrirRuta: (circuitoId: string, parada?: string, sentido?: Sentido) => void;
  alQuitarGuardada: (g: ParadaGuardada) => void;
  /** Abre «Tus paradas», que cuelga de aquí y no es un quinto lugar de la barra. */
  alVerTusParadas: () => void;
  /**
   * Los camiones de TODAS tus rutas, de la consulta única de la raíz (PR 4b):
   * Inicio ya no pregunta por su cuenta.
   */
  enVivo: { vivos: Map<string, Vivo>; error: boolean; respondio: boolean; recibidoEn: number | null; reintentar: () => void };
  /** Los avisos de la concesión de tus rutas: la puerta que antes era la campana. */
  avisos: AvisoEnLaCampana[];
  /** Si hay alguno que no has visto: prende el punto. */
  avisosNuevos: boolean;
  alVerAvisos: () => void;
  /** La piel, no la ciudad: si la app se está viendo de noche. */
  deNoche: boolean;
  alAlternarPiel: () => void;
  /** La lista de rutas nace abierta: se llegó desde «Ver todas las rutas» de «Ir a». */
  rutasAbiertas?: boolean;
}) {
  const lista = useParadasDeLaCiudad(ubicacion.estado === "concedida");

  if (!guardadasListas) return <div className="ontoy-vista" />;

  /*
   * **La primera vez** es no haberle preguntado nunca la ubicación Y no tener
   * ninguna parada guardada. Las dos, no una: quien dijo que no a la ubicación
   * pero guardó su parada ya contestó — y volver a recibirlo con la bienvenida
   * sería no haberlo escuchado.
   *
   * Se va **para siempre** en cuanto responda cualquiera de las dos (estándar,
   * §H: «se va para siempre en cuanto respondes»).
   */
  const primeraVez = ubicacion.estado === "sin-pedir" && guardadas.length === 0;
  const deNoche = ciudadCerrada(estados);
  /*
   * **`sinRed` sólo puede ser cierto si hay paradas guardadas**, y conviene
   * saberlo antes de «arreglarlo».
   *
   * La consulta de lo vivo se arma con las rutas de tus guardadas más la
   * abierta (`rutasDeLaConsulta`). Sin ninguna de las dos **no hay petición**,
   * así que no hay nada que se pueda caer y `error` se queda en `false`.
   *
   * Eso es correcto y no un hueco: sin guardadas, Inicio no está enseñando
   * ningún dato vivo, así que no hay nada que se haya quedado viejo. Lo que se
   * ve abajo —las rutas y su promesa publicada— llegó con la página y no
   * depende de la red (8.2).
   *
   * Lo escribo porque el modo de falla es tentador: alguien va a ver que el
   * estado «no sale nunca» en un teléfono recién abierto y va a querer
   * encenderlo por otra vía. Encenderlo sin dato vivo sería decir «te enseño lo
   * último que supe» sobre algo que nunca supimos.
   */
  const sinRed = enVivo.error;

  /*
   * **Te ubico por aquí, más o menos** (lámina 5/09): hay posición, pero con un
   * margen que no alcanza para decir metros (`esImprecisa`, #613). Sólo sin
   * guardadas: con ellas manda «Tu próximo camión», y la cercanía de las rutas
   * de abajo ya dice su margen en la cabecera.
   */
  const margenImpreciso =
    ubicacion.estado === "concedida" && ubicacion.yo && esImprecisa(ubicacion.yo.margenM) ? ubicacion.yo.margenM : null;

  const [primera, ...demas] = guardadas;
  /*
   * **«Va. Búscala tú»** (lámina 5/08; estándar §H: «Si dices que no: “Va.
   * Búscala tú”»). El permiso negado, sin guardadas y con la ciudad abierta:
   * reemplaza a la invitación, que decía «Guarda tu parada» como si nada
   * hubiera pasado. Con guardadas manda «Tu próximo camión»; de noche, la noche.
   */
  const sinUbicacion = ubicacion.estado === "negada" && !primera && !deNoche;
  /*
   * **El Ontoy de Inicio, y es uno** (regla 3; ASAV, 25-sep). Siempre hay uno
   * y siempre dice algo, así que el asomado de arriba se esconde aquí solo:
   *
   * | Cuándo | Qué tarjeta | Qué dice Ontoy |
   * |---|---|---|
   * | primera vez, con la ciudad abierta | la bienvenida | «¿Ontás?» — y pide la ubicación, la única vez |
   * | con guardadas | «Tu próximo camión» | la llegada de la primera, del dato |
   * | sin guardadas, de noche — **aunque sea la primera vez** | la noche de la ciudad | «Ya no hay corridas» + a qué hora vuelve la primera |
   * | sin guardadas, permiso negado | «Va. Búscala tú» | que todo funciona igual, y cómo cambiar de idea |
   * | sin guardadas, de día | la invitación | cómo se guarda una parada |
   *
   * **De madrugada la noche le gana a la bienvenida** (auditoría del 25-sep):
   * a las 00:20 «¿Ontás? Dime dónde estás y te digo qué pasa cerca» promete
   * algo que no hay —no pasa nada cerca, ni lejos—. La bienvenida no se pierde:
   * nada se contestó, así que sale en cuanto la ciudad abre.
   *
   * Sin red no tiene tarjeta propia: sólo puede pasar con guardadas (ver
   * `sinRed`), y entonces la dice la tarjeta del próximo camión.
   */
  const bienvenida = primeraVez && !deNoche;
  const tarjeta = bienvenida ? (
    <Bienvenida alPedirUbicacion={ubicacion.pedir} puedeGuardar={puedeGuardar} />
  ) : primera ? (
    <TarjetaDelProximoCamion
      guardada={primera}
      ruta={rutas.find((r) => r.circuito_id === primera.ruta) ?? null}
      yo={ubicacion.yo}
      vivo={enVivo.vivos.get(primera.ruta) ?? (enVivo.respondio ? null : undefined)}
      errorVivo={enVivo.error}
      recibidoEn={enVivo.recibidoEn}
      alAbrir={() => alAbrirRuta(primera.ruta, primera.parada)}
      alQuitar={() => alQuitarGuardada(primera)}
    />
  ) : deNoche ? (
    <NocheDeLaCiudad vuelven={vuelvenEnPalabras(deNoche)} />
  ) : margenImpreciso !== null ? (
    <UbicacionImprecisa margenM={margenImpreciso} alReintentar={ubicacion.reintentar} />
  ) : sinUbicacion ? (
    <SinUbicacion />
  ) : puedeGuardar ? (
    <TarjetaDeOntoy
      pose="al-frente"
      dicho="Guarda tu parada"
      apoyo="Abre una ruta y toca la estrella de tu parada: aquí verás a cuántas paradas viene."
    />
  ) : null;

  return (
    <div className="ontoy-vista">
      <Encabezado
        primeraVez={bienvenida}
        conGuardadas={guardadas.length > 0}
        sinRed={sinRed}
        deNoche={deNoche !== null}
        imprecisa={!primera && !deNoche && margenImpreciso !== null}
        sinUbicacion={sinUbicacion}
      />

      {tarjeta}

      {/* Justo debajo de la tarjeta grande, como en el diseño: la puerta a los avisos. */}
      {avisos.length > 0 && <PuertaDeAvisos avisos={avisos} nuevos={avisosNuevos} alAbrir={alVerAvisos} />}

      {/*
        * **«Tus paradas»: las demás**, en renglones compactos. La primera ya la
        * dice la tarjeta de arriba; repetirla sería decir lo mismo dos veces.
        */}
      {demas.length > 0 && (
        <section className="ontoy-seccion">
          {/*
            * La puerta a «Tus paradas» (ordenar y quitar). Va aquí y no en la
            * barra: la barra tiene cuatro lugares y eso es ley (8.8).
            */}
          <div className="ontoy-inicio-seccion-cabeza">
            <h2 className="ontoy-inicio-seccion-titulo">Tus paradas</h2>
            <button type="button" className="ontoy-seccion-mas" onClick={alVerTusParadas}>
              Ordenar
            </button>
          </div>
          <div className="ontoy-renglones">
            {demas.map((g) => (
              <RenglonDeParada
                key={g.parada}
                guardada={g}
                ruta={rutas.find((r) => r.circuito_id === g.ruta) ?? null}
                yo={ubicacion.yo}
                vivo={enVivo.vivos.get(g.ruta) ?? (enVivo.respondio ? null : undefined)}
                errorVivo={enVivo.error}
                recibidoEn={enVivo.recibidoEn}
                alAbrir={() => alAbrirRuta(g.ruta, g.parada)}
              />
            ))}
          </div>
        </section>
      )}

      {/*
        * **Reintentar**, sin señal y debajo de tus paradas, como la lámina 7/05.
        * Contorno y no principal: la acción de la pantalla sigue siendo leer lo
        * que se sabía; esto sólo pregunta ya, sin esperar la vuelta del sondeo.
        * Sólo sale con la consulta caída, que sólo existe con guardadas (ver
        * `sinRed`, arriba).
        */}
      {sinRed && (
        <div className="ontoy-inicio-reintentar">
          <button type="button" className="ontoy-boton-contorno" onClick={enVivo.reintentar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.35-5.65" />
              <path d="M20 4v5h-5" />
            </svg>
            Reintentar
          </button>
        </div>
      )}

      <RutasDeInicio
        rutas={rutas}
        estados={estados}
        paradas={lista.datos?.paradas ?? []}
        ubicacion={ubicacion}
        listaConError={lista.error}
        alReintentarLista={lista.reintentar}
        alAbrirRuta={alAbrirRuta}
        abiertas={rutasAbiertas}
      />

      {/* Al pie: los datos (lo que es ley vive allá, no en la pantalla) y la piel. */}
      <p className="ontoy-pie">
        <a href="/privacidad">Qué datos usa la app y para qué</a>
      </p>
      <RenglonDePiel deNoche={pielDeNoche} alAlternar={alAlternarPiel} />
    </div>
  );
}

/**
 * **La noche de la ciudad**, como la lámina `1-inicio/05` (ASAV, 25-sep).
 *
 * **No es carbón, y es a propósito.** La tarjeta del próximo camión es carbón
 * en las dos pieles porque habla de UN camión, como la placa (#602). Ésta no
 * habla de ninguno: es la pantalla diciendo que la ciudad duerme, y por eso es
 * **superficie de la interfaz** —los roles `--panel`, `--linea`, `--texto`,
 * que sí siguen la piel—. Medido en la lámina de noche: `#26365e` con su
 * anillo, igual que las demás superficies.
 *
 * Ontoy dormido al centro, grande (hasta 160 en una pantalla de noche, §G), y
 * las dos frases como título: qué pasa y cuándo vuelve **la primera**.
 */
function NocheDeLaCiudad({ vuelven }: { vuelven: string }) {
  return (
    <section className="ontoy-noche-ciudad">
      <Ontoy pose="dormido" tamano={140} />
      <p className="ontoy-noche-ciudad-frase">
        Ya no hay corridas.
        <br />
        {vuelven}
      </p>
    </section>
  );
}

/**
 * **Una tarjeta de Ontoy** cuando Inicio no tiene una parada que contar y la
 * ciudad está abierta: cómo se guarda la primera. Misma forma que la del
 * próximo camión —carbón, Ontoy a la izquierda, la frase grande— para que
 * Inicio abra siempre igual. (La noche de la ciudad tiene la suya, arriba.)
 */
function TarjetaDeOntoy({ pose, dicho, apoyo }: { pose: PoseDeOntoy; dicho: string; apoyo: string }) {
  return (
    <section className="ontoy-proximo">
      <div className="ontoy-proximo-dicho">
        <Ontoy pose={pose} tamano={72} />
        <div>
          <p className="ontoy-proximo-frase">{dicho}</p>
          <p className="ontoy-proximo-apoyo">{apoyo}</p>
        </div>
      </div>
    </section>
  );
}

/**
 * **La puerta a los avisos** — lo que antes era la campana de la cabecera
 * (ASAV, 25-sep; el diseño la dibuja en `6-prototipo/06`).
 *
 * Enseña el aviso más reciente, fechado y atribuido como en su lista, y cuántos
 * más hay. **Sólo sale si hay avisos**: una tarjeta que dice «no hay avisos» en
 * Inicio es ruido todos los días para decir nada.
 *
 * El punto es el de la campana y dice lo mismo: **hay avisos de la concesión que
 * no has visto** (decisión de ASAV, 22-sep). Es forma —un círculo lleno en
 * tinta—, nunca rojo.
 */
function PuertaDeAvisos({
  avisos,
  nuevos,
  alAbrir,
}: {
  avisos: AvisoEnLaCampana[];
  nuevos: boolean;
  alAbrir: () => void;
}) {
  const [primero] = avisos;
  const mas = avisos.length - 1;
  return (
    <section className="ontoy-seccion">
      <button
        type="button"
        className="ontoy-puerta-avisos"
        onClick={alAbrir}
        aria-label={`Avisos de tus rutas${nuevos ? ", hay nuevos" : ""}: ${primero.titulo}${mas > 0 ? ` y ${mas} más` : ""}`}
      >
        <GlifoAviso />
        <span className="ontoy-puerta-avisos-texto">
          <span className="ontoy-puerta-avisos-titulo">{primero.titulo}</span>
          <span className="ontoy-puerta-avisos-cuando cifra">
            {fechaDelAviso(primero.desde, primero.zona, new Date())} · según la concesión
            {mas > 0 && ` · y ${mas} más`}
          </span>
        </span>
        {nuevos && <span className="ontoy-puerta-avisos-punto" aria-hidden="true" />}
        <svg className="ontoy-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </section>
  );
}

/**
 * **El interruptor de piel**, al pie de Inicio (ASAV, 25-sep, opción a).
 *
 * La app sigue al teléfono por omisión (`useTema`); esto es para quien quiera
 * otra cosa. Vivía en la cabecera, que ya no existe. El glifo es **a donde
 * lleva**, no donde estás: la luna de día, el sol de noche — igual que el botón
 * de antes.
 */
function RenglonDePiel({ deNoche, alAlternar }: { deNoche: boolean; alAlternar: () => void }) {
  return (
    <button type="button" className="ontoy-renglon-piel" onClick={alAlternar}>
      {deNoche ? <GlifoSol /> : <GlifoLuna />}
      <span>{deNoche ? "Ver de día" : "Ver de noche"}</span>
    </button>
  );
}

/**
 * **El encabezado de Inicio** — el título y su línea de contexto.
 *
 * El estándar lo pide en toda pantalla: un título en tipo oración y, debajo,
 * una línea de 13 px que dice **de dónde viene lo que se está viendo**. No es
 * un subtítulo decorativo: es el renglón que sostiene la regla de que cada dato
 * lleva su procedencia.
 *
 * Los cuatro títulos son cuatro afirmaciones distintas, y por eso no se funden
 * en uno con una variable adentro:
 *
 * | Cuándo | Título | Contexto |
 * |---|---|---|
 * | primera vez | ¿Qué camión pasa? | Todavía no sé dónde estás |
 * | sin red | ¿Qué camión pasa? | Sin señal ahorita |
 * | de noche | ¿Qué camión pasa? | La ciudad está cerrada |
 * | con guardadas | Tu próximo camión | — la edad la pone cada tarjeta |
 *
 * **La edad del dato NO va aquí cuando hay guardadas**, aunque el diseño la
 * ponga («Posiciones de hace 10 s»): cada parada guardada trae la suya, de su
 * propia ruta, y pueden no coincidir. Una sola edad arriba de dos tarjetas con
 * dos edades distintas es el §D — el dato correcto de una presentado como el de
 * las dos. Se queda en cada tarjeta, que es donde se puede comprobar.
 */
function Encabezado({
  primeraVez,
  conGuardadas,
  sinRed,
  deNoche,
  imprecisa,
  sinUbicacion,
}: {
  primeraVez: boolean;
  conGuardadas: boolean;
  sinRed: boolean;
  deNoche: boolean;
  /** Está la tarjeta de la 5/09: la posición llegó con un margen grande. */
  imprecisa: boolean;
  /** Está la tarjeta de la 5/08: el pasajero dijo que no a la ubicación. */
  sinUbicacion: boolean;
}) {
  const contexto = primeraVez
    ? "Todavía no sé dónde estás"
    : sinRed
      ? "Sin señal ahorita"
      : deNoche
        ? "La ciudad está cerrada"
        : imprecisa
          ? "Por aquí, más o menos"
          : sinUbicacion
            ? "Sin tu ubicación"
            : null;

  return (
    <header className="ontoy-inicio-cabeza">
      <h1 className="ontoy-inicio-titulo">
        {conGuardadas && !primeraVez ? "Tu próximo camión" : "¿Qué camión pasa?"}
      </h1>
      {contexto && <p className="ontoy-inicio-contexto">{contexto}</p>}
    </header>
  );
}

/**
 * **«Te ubico por aquí, más o menos»** (lámina `5-paradas-qr-ubicacion/09`).
 *
 * El teléfono dio posición, pero con un margen que no alcanza para decir metros
 * (más de 100 m: `esImprecisa`). La app sigue ordenando por cercanía —es la
 * mejor apuesta— y aquí dice por qué no da distancias.
 *
 * **Un cambio de texto contra la lámina, a propósito.** La lámina dice «Las
 * distancias pueden variar» porque debajo enseña «a unos 300 m». Desde el #613
 * con este margen no se enseñan metros (ASAV, 25-sep), así que la frase dice
 * lo que sí pasa: que no te damos metros, y por qué.
 *
 * Va en la tarjeta de la bienvenida —hueso, con anillo— y no en carbón: no
 * habla de ningún camión. Y con el pasajero en vez de Ontoy: lo que está en
 * duda es dónde estás tú. **Sin cono**: no hay rumbo que apuntar (ver
 * `pasajeroConLinterna`).
 */
function UbicacionImprecisa({ margenM, alReintentar }: { margenM: number; alReintentar: () => void }) {
  return (
    <section className="ontoy-bienvenida ontoy-imprecisa">
      <div className="ontoy-bienvenida-dicho">
        <span className="ontoy-imprecisa-yo" aria-hidden="true">
          <svg viewBox="0 0 60 60" width="44" height="44">
            <circle cx="30" cy="34" r="14" fill="var(--blanco)" />
            <circle cx="30" cy="34" r="11.5" fill="var(--noche)" />
            <circle cx="25.5" cy="31" r="3.6" fill="var(--blanco)" />
            <circle cx="34.5" cy="31" r="3.6" fill="var(--blanco)" />
            <circle cx="25.8" cy="29.4" r="2" fill="var(--carbon)" />
            <circle cx="34.8" cy="29.4" r="2" fill="var(--carbon)" />
            <circle cx="12" cy="40" r="4" fill="var(--noche)" />
            <circle cx="48" cy="40" r="4" fill="var(--noche)" />
          </svg>
        </span>
        <div>
          <p className="ontoy-bienvenida-titulo">Te ubico por aquí, más o menos.</p>
          <p className="ontoy-bienvenida-apoyo">
            Tu teléfono da un margen de {margenEnPalabras(margenM)}. Por eso no te digo a cuántos metros
            está cada parada.
          </p>
        </div>
      </div>
      <button type="button" className="ontoy-boton ontoy-boton-segundo" onClick={alReintentar}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.3-5.6" />
          <path d="M20 4v5h-5" />
        </svg>
        Intentar de nuevo
      </button>
    </section>
  );
}

/**
 * **«Va. Búscala tú»** (lámina `5-paradas-qr-ubicacion/08`), con el permiso
 * de ubicación negado.
 *
 * Dice lo que pasa sin reclamar nada: sin ubicación la app **no pierde ninguna
 * función**, sólo deja de ordenar por cercanía (8.7). Y el camino de vuelta
 * está en el teléfono, no aquí: una vez negado, el navegador ya no deja
 * volver a preguntar, así que un botón «Usar mi ubicación» prometería algo
 * que no puede hacer.
 *
 * Misma tarjeta que la bienvenida (hueso, con anillo) y un solo botón
 * principal, que baja a la lista de rutas.
 */
function SinUbicacion() {
  return (
    <section className="ontoy-bienvenida">
      <div className="ontoy-bienvenida-dicho">
        <Ontoy pose="al-frente" tamano={72} />
        <div>
          {/* «Búscala tú» no se parte: a 320 px dejaba «tú.» solo en su renglón. */}
          <p className="ontoy-bienvenida-titulo">Va. Búscala{"\u00a0"}tú.</p>
          <p className="ontoy-bienvenida-apoyo">
            Sin tu ubicación no ordeno por cercanía, y todo lo demás funciona igual.
          </p>
        </div>
      </div>
      <a className="ontoy-boton ontoy-boton-principal" href="#ontoy-rutas">
        Buscar mi parada
      </a>
      <p className="ontoy-bienvenida-nota">
        Si cambias de idea, dale permiso de ubicación en los ajustes de tu teléfono.
      </p>
    </section>
  );
}

/**
 * **La bienvenida**, y es lo único que la app pregunta al abrir.
 *
 * El estándar (§H) es explícito: **no hay pantallas de bienvenida**. La calle es
 * el onboarding. Lo que hay es **una sola tarjeta** arriba de Inicio, que se va
 * para siempre en cuanto el pasajero responda — y debajo de ella la app entera,
 * usable sin contestar nada.
 *
 * ## Las dos salidas, y por qué son dos
 *
 * «Usar mi ubicación» pide el permiso —**sólo tras un toque**, nunca al abrir
 * (8.7)—. «Buscar mi parada» no pide nada: baja a las rutas, que están ahí
 * mismo. Quien no quiera dar su ubicación **no pierde ninguna función**: la
 * ubicación sólo ordena la lista por cercanía, y eso lo dice la nota.
 *
 * No hay un «ahora no» ni una equis: las dos opciones ya son la respuesta, y un
 * tercer botón para no contestar deja la tarjeta puesta para siempre.
 */
function Bienvenida({
  alPedirUbicacion,
  puedeGuardar,
}: {
  alPedirUbicacion: () => void;
  /** Sin dónde guardar, la segunda salida promete algo que no se va a poder. */
  puedeGuardar: boolean;
}) {
  return (
    <section className="ontoy-bienvenida">
      <div className="ontoy-bienvenida-dicho">
        <Ontoy pose="al-frente" tamano={96} />
        <div>
          <p className="ontoy-bienvenida-titulo">¿Ontás?</p>
          <p className="ontoy-bienvenida-apoyo">Dime dónde estás y te digo qué pasa cerca.</p>
        </div>
      </div>
      <button type="button" className="ontoy-boton ontoy-boton-principal" onClick={alPedirUbicacion}>
        Usar mi ubicación
      </button>
      {puedeGuardar && (
        <a className="ontoy-boton ontoy-boton-segundo" href="#ontoy-rutas">
          Buscar mi parada
        </a>
      )}
      <p className="ontoy-bienvenida-nota">
        Tu ubicación solo sirve para ordenar las rutas por cercanía. Se queda en tu teléfono.
      </p>
    </section>
  );
}
