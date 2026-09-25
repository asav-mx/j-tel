"use client";

import type { RutaDeLaCiudad, Sentido } from "@/lib/ontoy/forma";
import type { ParadaGuardada } from "@/lib/ontoy/paradas-guardadas";
import type { Ubicacion } from "@/lib/ubicacion";
import { Ontoy } from "@/components/ontoy/ontoy-muneco";
import { ciudadCerrada, vuelvenEnPalabras } from "@/lib/ontoy/noche-de-la-ciudad";
import { AtajoDeParada } from "@/components/ontoy/atajo-de-parada";
import type { Vivo } from "@/lib/ontoy/forma";
import { useParadasDeLaCiudad } from "@/lib/ontoy/usar-paradas-de-la-ciudad";
import type { EstadoDeRuta } from "@/lib/ontoy/estado-de-ruta";
import { RutasDeInicio } from "@/components/ontoy/rutas-de-inicio";

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
  enVivo,
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
  /**
   * Los camiones de TODAS tus rutas, de la consulta única de la raíz (PR 4b):
   * Inicio ya no pregunta por su cuenta.
   */
  enVivo: { vivos: Map<string, Vivo>; error: boolean; respondio: boolean };
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

  return (
    <div className="ontoy-vista">
      <Encabezado
        primeraVez={primeraVez}
        conGuardadas={guardadas.length > 0}
        sinRed={sinRed}
        deNoche={deNoche !== null}
      />

      {primeraVez && <Bienvenida alPedirUbicacion={ubicacion.pedir} puedeGuardar={puedeGuardar} />}

      {/*
        * **Sin red va arriba de todo lo demás, y no reemplaza nada.**
        *
        * Lo de abajo sigue dibujándose: las rutas son lo último que supimos y
        * siguen valiendo —la promesa publicada no depende de la red (8.2)—. Lo
        * que esta línea agrega es de cuándo es lo que se está viendo. Taparlo
        * todo con una pantalla de error le quitaría al pasajero la mitad de la
        * app por una consulta caída.
        */}
      {sinRed && !primeraVez && (
        <section className="ontoy-seccion ontoy-inicio-estado">
          <Ontoy pose="sin-red" tamano={64} />
          <p className="ontoy-inicio-estado-dicho">
            Sin señal. Te enseño lo último que supe.
          </p>
        </section>
      )}

      {/*
        * **De noche también se suma, no reemplaza.** Las rutas siguen abajo con
        * su horario, que es lo que alguien viene a mirar a esa hora.
        */}
      {deNoche && !primeraVez && !sinRed && (
        <section className="ontoy-seccion ontoy-inicio-estado">
          <Ontoy pose="dormido" tamano={64} />
          <p className="ontoy-inicio-estado-dicho">
            Ya no hay corridas. {vuelvenEnPalabras(deNoche)}
          </p>
        </section>
      )}

      {guardadas.length > 0 ? (
        <section className="ontoy-seccion">
          {guardadas.map((g) => (
            <AtajoDeParada
              key={g.parada}
              guardada={g}
              ruta={rutas.find((r) => r.circuito_id === g.ruta) ?? null}
              yo={ubicacion.yo}
              vivo={enVivo.vivos.get(g.ruta) ?? (enVivo.respondio ? null : undefined)}
              errorVivo={enVivo.error}
              alAbrir={() => alAbrirRuta(g.ruta, g.parada)}
              alQuitar={() => alQuitarGuardada(g)}
            />
          ))}
        </section>
      ) : (
        /*
         * Sin guardadas, la puerta de entrada dicha una vez. No es un estado
         * vacío: debajo están las rutas, que es con lo que se llega a guardar
         * la primera.
         */
        /*
         * Sin guardadas y **ya no es la primera vez** —ya contestó lo de la
         * ubicación—: la puerta dicha una vez, sin Ontoy. El de la pantalla ya
         * se gastó arriba si había algo que decir, y son uno por pantalla.
         */
        !primeraVez &&
        puedeGuardar && (
          <p className="ontoy-vacio ontoy-inicio-invitacion">
            Guarda una parada y aquí verás su próximo camión. Abre una ruta y toca la suya.
          </p>
        )
      )}

      <RutasDeInicio
        rutas={rutas}
        estados={estados}
        paradas={lista.datos?.paradas ?? []}
        ubicacion={ubicacion}
        listaConError={lista.error}
        alReintentarLista={lista.reintentar}
        alAbrirRuta={alAbrirRuta}
      />

      <p className="ontoy-pie">
        Tus paradas guardadas se quedan en tu teléfono. No hace falta cuenta.{" "}
        <a href="/privacidad">Qué datos usa la app y para qué</a>.
      </p>
    </div>
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
}: {
  primeraVez: boolean;
  conGuardadas: boolean;
  sinRed: boolean;
  deNoche: boolean;
}) {
  const contexto = primeraVez
    ? "Todavía no sé dónde estás"
    : sinRed
      ? "Sin señal ahorita"
      : deNoche
        ? "La ciudad está cerrada"
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
