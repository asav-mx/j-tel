import { NextResponse } from "next/server";
import {
  enHorarioDeServicio,
  estadoDelCircuito,
  medirUnidad,
  sentidoDeLaUnidad,
  yaArrancoElServicio,
  type EstadoDelCircuito,
  type TrazadoDeSentido,
} from "@jtel/domain/publico";
import { getRepos } from "@/lib/db";
import { circuitoParaLaApp } from "@/lib/vista-previa";

/**
 * Dónde vienen los camiones de un circuito. **Sin autenticación, solo lectura.**
 *
 * Siempre por circuito en la ruta y nunca una lista global: una lista global se
 * raspa entera con una llamada, y entonces el endpoint deja de ser «dónde viene
 * mi camión» para volverse la operación completa del concesionario servida en
 * bandeja.
 *
 * ## Lo que NO sale de aquí, y es la mitad del diseño
 *
 * Ni identificadores internos, ni IMEI, ni placas, ni número económico, ni
 * chofer, ni transportista, ni concesión, ni contrato, ni velocidad reportada,
 * ni una sola fila de histórico. El pasajero necesita saber dónde viene su
 * camión; nada de lo anterior le sirve para eso, y todo lo anterior le sirve a
 * alguien más para otra cosa.
 *
 * `circuito_id` es el **slug público**, no el UUID: el UUID es un identificador
 * interno y devolverlo sería filtrarlo por la puerta de enfrente.
 *
 * ## Las tres reglas de operación
 *
 * 1. **El filtro es del servidor.** Publicación, fecha de arranque, horario y
 *    asignación se resuelven aquí; el teléfono no elige qué se le puede
 *    enseñar.
 * 2. **Caché obligatorio**, atado a la cadencia del recolector: 15 s. Una
 *    parada con cincuenta teléfonos pega al CDN, no a la base. El límite de
 *    tasa lo pone el firewall de Vercel — ver `docs/Procedimiento-Firewall-Publico.md`.
 * 3. **Si el dato está viejo, no hay posición.** No se manda la última conocida:
 *    un camión de hace veinte minutos dibujado en un mapa en vivo se lee como
 *    «va llegando». La app cae a la frecuencia declarada, que es honesta.
 * 4. **Si la unidad no va sobre el circuito, tampoco.** Misma ley que la
 *    anterior, aplicada al espacio: estar ASIGNADO no es estar EN RUTA, y una
 *    unidad asignada que anda en el taller o cubriendo otra cosa sigue
 *    reportando. Dibujarla sería afirmar que viene en camino.
 */

/** Segundos que la respuesta vive en el CDN. El cuerpo dice lo mismo que el encabezado. */
const TTL_SEGUNDOS = 15;

/*
 * ⚠ Este endpoint NO lleva `stale-while-revalidate`, y es una decisión.
 *
 * SWR también lo respeta el NAVEGADOR, no solo el CDN: con una ventana de 30 s,
 * un teléfono sirve posiciones de hasta 30 s más viejas mientras revalida por
 * detrás. Sumado al TTL son 45 s encima de la antigüedad que el fix ya traía, y
 * el umbral de dato viejo del circuito son 180: se comería un cuarto del
 * presupuesto entero, sin que nadie lo viera.
 *
 * Se vio en la prueba de punta a punta: el endpoint contestaba `en_servicio:
 * false` y la pantalla seguía diciendo lo de hacía un rato. El endpoint de la
 * FORMA sí lo lleva, porque ahí un trazado de hace un minuto no le miente a
 * nadie.
 */

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  /*
   * Un circuito NO PUBLICADO contesta exactamente lo mismo que un slug
   * inventado. Distinguirlos —un 403, un mensaje distinto, hasta un tiempo de
   * respuesta distinto— filtraría que ese slug existe, y los slugs se escogen
   * para imprimirse: adivinar el siguiente es trivial.
   *
   * El filtro no está aquí: está dentro de `getPublishedCircuitBySlug`, para
   * que no haya una línea que alguien pueda borrar y abrir la fuga sin que se
   * rompa nada. `circuitoParaLaApp` respeta esa forma — es la única puerta, y
   * su única excepción (la vista previa) no existe en producción.
   */
  const visible = await circuitoParaLaApp(slug);
  if (!visible) {
    return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });
  }
  const { circuito } = visible;

  const ahora = new Date();

  /*
   * La fecha de arranque se resuelve ANTES que el horario, porque manda sobre
   * el reloj: preguntarle a la hora si está abierto un servicio que todavía no
   * arranca es preguntar por la puerta de algo que aún no existe.
   */
  const yaArranco = yaArrancoElServicio(ahora, circuito.serviceLaunchDate, circuito.timeZone);

  const enHorario = enHorarioDeServicio(
    ahora,
    circuito.serviceStartLocal,
    circuito.serviceEndLocal,
    circuito.timeZone,
  );

  /**
   * La respuesta lleva UN campo de estado, no varios booleanos.
   *
   * Antes iba `en_servicio` y la app deducía el resto contando unidades. Dos
   * campos que pueden contradecirse son cómo un dato correcto se vuelve una
   * afirmación falsa: aquí la escalera decide una vez, en el dominio, y la
   * pantalla lee la decisión.
   */
  const responder = (
    estado: EstadoDelCircuito,
    unidades: Array<{
      economico: string;
      lat: number;
      lon: number;
      rumbo: number | null;
      sentido: "ida" | "vuelta" | null;
      antiguedad_seg: number;
      fresco: boolean;
    }> = [],
  ) =>
    conCache({
      circuito_id: circuito.publicSlug,
      generado_en: ahora.toISOString(),
      ttl_seg: TTL_SEGUNDOS,
      estado,
      /*
       * `null` cuando el concesionario no la declaró, y entonces la app dice
       * que hay servicio SIN tiempo estimado. Nunca se inventa una cadencia:
       * afirmar «cada 20 minutos» porque una columna traía default es
       * exactamente completar un hueco para que la pantalla se vea entera.
       */
      frecuencia_declarada_min: circuito.declaredFrequencyMinutes,
      /* A qué hora abre, para que FUERA DE HORARIO pueda decirlo. */
      abre_a: circuito.serviceStartLocal.slice(0, 5),
      /*
       * Qué día arranca, para que POR ARRANCAR pueda decirlo. `null` en todo
       * circuito que ya opera — que es lo mismo que la columna guarda, sin
       * traducir: un «hoy» inventado aquí sería la app declarando por el
       * concesionario.
       */
      arranca_el: circuito.serviceLaunchDate,
      /*
       * El rango se enseña sólo si ya se calibró la velocidad de ESTE circuito
       * contra la calle. Apagado, EN VIVO sigue enseñando el camión moviéndose
       * —verdad observada— y se calla el minuto estimado, que aún no lo es.
       */
      rango_activo: circuito.arrivalRangeEnabledAt !== null,
      unidades,
    });

  /*
   * Sin arrancar no se consulta nada, y aquí el ahorro es lo de menos.
   *
   * Un camión probando el recorrido la semana antes del arranque reporta
   * posición como cualquier otro. Publicarlo convertiría un ensayo en un
   * servicio, y a alguien parado en la banqueta le diría que ya puede
   * subirse. La fecha declarada manda sobre lo que el GPS alcance a ver.
   *
   * La app sigue enseñando el recorrido y las paradas: ésos bajan del endpoint
   * de la FORMA, que no depende de esto. Lo que no sale son las unidades.
   */
  if (!yaArranco) return responder("por_arrancar");

  /*
   * Fuera de horario no se consulta nada. No es solo ahorro: un camión que
   * regresa al patio a las 23:30 sigue reportando posición, y publicarlo lo
   * volvería un servicio que nadie está dando.
   */
  if (!enHorario) return responder("fuera_de_horario");

  /*
   * ✎ **Aquí había un 503 sin `JTEL_SECRET_KEY`, y se retiró el 21-sep-2026.**
   *
   * Existía porque la llave hacía opaco el identificador de la unidad: sin
   * ella, «antes que publicar unidades con identidad recalculable, no se
   * publica ninguna». Ese identificador ya no existe —ahora va el número
   * económico, que está pintado en el camión (8.5)— así que la llave dejó de
   * proteger nada de ESTE endpoint.
   *
   * Y dejarlo habría sido peor que inútil: apagaría la app del pasajero entera
   * por una llave que ya no le hace falta.
   *
   * ⚠ **Lo que sí arrastra:** el contador de aperturas sí necesita la llave, y
   * su comentario se apoyaba en este 503 para argumentar que un cero suyo nunca
   * se podría leer como «nadie abrió». Ese apoyo desapareció con este bloque, y
   * el de allá se corrigió el mismo día.
   */

  const [posiciones, trazados] = await Promise.all([
    getRepos().circuits.listLivePositionsForCircuit(circuito.id),
    getRepos().circuits.getPaths(circuito.id),
  ]);

  const trazadosPorSentido: TrazadoDeSentido[] = trazados.map((t) => ({
    sentido: t.sentido,
    coordinates: t.coordinates as Array<[number, number]>,
  }));

  /*
   * Se mide UNA vez por unidad y de ahí salen las dos cosas: el estado del
   * circuito y qué unidades se publican. Medirlo dos veces con dos criterios
   * es cómo la pantalla acaba diciendo algo que la respuesta no dice.
   *
   * `listLivePositionsForCircuit` ya trae sólo unidades con asignación
   * vigente, pero la asignación NO entra en la decisión: lo único que se mira
   * de aquí en adelante es dónde y cuándo se vio cada una.
   */
  const umbrales = {
    ahora,
    trazados: trazadosPorSentido,
    corredorMetros: circuito.corridorToleranceMeters,
    frescuraSegundos: circuito.staleAfterSeconds,
    confianzaSegundos: circuito.serviceConfidenceMinutes * 60,
  };

  const medidas = posiciones.map((p) => ({
    p,
    m: medirUnidad({ lat: p.latitude, lon: p.longitude, recordedAt: p.recordedAt }, umbrales),
  }));

  const estado = estadoDelCircuito({ yaArranco, enHorario, unidades: medidas.map((x) => x.m) });

  /*
   * Van las unidades del CORREDOR que caen dentro de la ventana de confianza,
   * frescas o no, cada una diciendo cuál es.
   *
   * Antes sólo salían las frescas, con el argumento de que la última posición
   * conocida «se lee como va llegando». El argumento estaba mal planteado: lo
   * que se lee como «va llegando» es un punto pintado **como si fuera de
   * ahorita**, no el hecho de que exista. Un camión que perdió señal no se fue
   * a ningún lado —sigue su recorrido—, y borrarlo del mapa manda al pasajero
   * caminando a otra ruta más lejos por algo que no ocurrió.
   *
   * La línea no está en si el camión se ve, sino en si se ve como si fuera de
   * ahorita: por eso viaja `fresco`, la app lo pinta apagado, y el RANGO —que
   * sí sería un número inventado— no se calcula desde una posición vieja.
   *
   * Pasada la ventana de confianza el punto sí desaparece: a esas alturas ya no
   * se puede sostener que la unidad siga en la ruta.
   */
  const unidades: Array<{
    economico: string;
    lat: number;
    lon: number;
    rumbo: number | null;
    sentido: "ida" | "vuelta" | null;
    antiguedad_seg: number;
    fresco: boolean;
  }> = [];

  for (const { p, m } of medidas) {
    // Los mismos cortes que decidieron el estado, sobre la misma medición.
    if (!m.enCorredor) continue;
    if (!m.dentroDeConfianza) continue;

    unidades.push({
      /*
       * **El número económico, y antes aquí iba un identificador opaco.**
       * Cambiado el 21 de septiembre de 2026 por decisión de ASAV, y el
       * registro queda porque la reversión importa más que el campo.
       *
       * Iba `idPublicoDelDia(unitId, fechaLocal, llave)`: un HMAC que rotaba
       * cada día para que nadie armara el historial de un camión —ni de su
       * chofer— raspando este endpoint día tras día. La intención era buena; el
       * instrumento, equivocado.
       *
       * **La Pieza 8.5 pide el económico por su nombre:** «el pasajero ve la
       * unidad en vivo, su número económico incluido — “viene la 2120” es parte
       * de la confianza». Y el número **está pintado en el costado del camión**:
       * cualquiera parado en la esquina lo lee. Esconderlo no protegía nada que
       * la calle no enseñe; lo que hacía era volver la frase ilegible («viene la
       * 065f4e83bec3»), que es exactamente lo contrario de la confianza que la
       * 8.5 busca.
       *
       * **La protección contra el raspado no se abandona, cambia de lugar**
       * (ASAV, 21-sep). Dos piezas, y la primera ya está aquí:
       *
       *  1. **Sólo posición actual, nunca historia.** Este endpoint no sirve
       *     recorridos: lo que devuelve es dónde está cada unidad AHORA, y eso
       *     no se acumula solo.
       *  2. **Límite de peticiones por teléfono**, que todavía NO existe y es
       *     la mitad que falta. Un raspador puede pedir cada segundo y armar
       *     el historial que el id opaco impedía. Va en su propio frente
       *     —necesita un contador compartido entre instancias, no uno en
       *     memoria— y está dicho aquí para que no se pierda.
       */
      economico: p.unitLabel,
      lat: p.latitude,
      lon: p.longitude,
      rumbo: p.heading,
      sentido: sentidoDeLaUnidad(
        { lat: p.latitude, lon: p.longitude },
        p.heading,
        trazadosPorSentido,
        circuito.corridorToleranceMeters,
      ),
      antiguedad_seg: m.antiguedadSeg,
      /*
       * Ya NO es siempre true. Es lo que decide si la app la pinta encendida y
       * la usa para el rango, o apagada y sólo como «por aquí se le vio». Va
       * resuelto en el servidor porque el umbral es del circuito y el teléfono
       * no lo conoce.
       */
      fresco: m.fresco,
    });
  }

  return responder(estado, unidades);
}

function conCache(cuerpo: unknown) {
  return NextResponse.json(cuerpo, {
    headers: {
      /*
       * `max-age=0` NO es redundante, y costó encontrarlo.
       *
       * `s-maxage` gobierna al CDN; sin un `max-age` explícito, el NAVEGADOR
       * aplica caché heurístico sobre una respuesta marcada `public` y sirve
       * una copia vieja sin preguntar. En la prueba de punta a punta eso se vio
       * exactamente así: se envejecieron todas las unidades en la base, el
       * endpoint ya contestaba `unidades: []`, y la app seguía diciendo
       * «Llegando» con un camión dibujado donde ya no estaba.
       *
       * Con esto el teléfono revalida siempre y el CDN conserva sus 15 s, que
       * es donde el caché sí debe vivir: compartido entre los cincuenta
       * teléfonos de una parada, no dentro de uno solo.
       */
      "cache-control": `public, max-age=0, s-maxage=${TTL_SEGUNDOS}`,
    },
  });
}
