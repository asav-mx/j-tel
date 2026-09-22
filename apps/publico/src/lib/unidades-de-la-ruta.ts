import {
  enHorarioDeServicio,
  estadoDelCircuito,
  medirUnidad,
  sentidoDeLaUnidad,
  yaArrancoElServicio,
  type EstadoDelCircuito,
  type TrazadoDeSentido,
} from "@jtel/domain/publico";
import { velocidadCalibrada } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { circuitoParaLaApp } from "@/lib/vista-previa";
import { promesaDelCircuito } from "@/lib/promesa";

/** Segundos que la respuesta vive en el CDN. El cuerpo dice lo mismo que el encabezado. */
export const TTL_SEGUNDOS = 15;

/**
 * Dónde vienen los camiones de UNA ruta — el cuerpo que contestan
 * `/api/circuitos/[slug]/unidades` y, ruta por ruta, `/api/circuitos/en-vivo`.
 *
 * Vive aquí para que las dos consultas digan **exactamente** lo mismo: las
 * reglas (publicación, arranque, horario, dato viejo, fuera del corredor) y lo
 * que NO sale están documentadas en `app/api/circuitos/[slug]/unidades/route.ts`.
 *
 * `null` es «esta ruta no existe para la app» — no publicada o inventada — y
 * cada consulta lo contesta a su modo sin distinguir las dos.
 */
export async function unidadesDeLaRuta(slug: string, ahora: Date) {
  const visible = await circuitoParaLaApp(slug);
  if (!visible) return null;
  const { circuito } = visible;

  // La promesa de ESTE momento, de las franjas (la única fuente, 21 sep 2026).
  const [promesa, vigentes] = await Promise.all([
    promesaDelCircuito(circuito.id, ahora, circuito.timeZone),
    getRepos().circuits.listAvisosVigentes(circuito.id, ahora),
  ]);
  /*
   * Los avisos de la concesión que valen AHORA (8.13b; 0052). Viajan aquí y no
   * en la forma: la forma vive una hora en caché, y un aviso retirado tiene que
   * dejar de verse en la siguiente consulta, no dentro de una hora. Van en
   * todos los estados —cerrada, por arrancar—: «cambia el horario» importa
   * justo ahí. Sólo lo que el pasajero lee: ni quién lo capturó ni motivos.
   */
  const avisos = vigentes.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    detalle: a.detalle,
    desde: a.vigenteDesde.toISOString(),
    hasta: a.vigenteHasta?.toISOString() ?? null,
  }));

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
    ({
      circuito_id: circuito.publicSlug,
      generado_en: ahora.toISOString(),
      ttl_seg: TTL_SEGUNDOS,
      estado,
      /*
       * La promesa de AHORA, por sentido, de las franjas vigentes — la única
       * fuente de la promesa (decisión de Asav, 21 sep 2026). Sin promesa
       * capturada, o sin franja a esta hora, lo dice así: nunca se inventa una
       * cadencia, y un tramo sin franja no se rellena con la vecina.
       */
      promesa,
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
      rango_activo: velocidadCalibrada(circuito),
      avisos,
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
       *  2. **Límite de peticiones por IP**, en el firewall de Vercel (ver
       *     `docs/Procedimiento-Firewall-Publico.md`): 120 por minuto, 429 al
       *     pasarse. Cuenta ANTES del CDN y es global entre instancias; un
       *     contador aquí dentro sólo vería las respuestas que el caché no
       *     sirvió. No hay cuentas en la app, así que «por teléfono» es, en
       *     la práctica, por IP.
       *
       *  **Lo que el límite frena y lo que no** (aceptado por ASAV, 21-sep):
       *  frena el **barrido masivo** —muchas rutas o muchos slugs desde una
       *  IP, o pedir mil veces saltándose el caché—. **No frena a quien sigue
       *  UNA ruta**: la app pide cada 15 s, el CDN guarda 15 s, y un guion
       *  que haga lo mismo no se distingue de un pasajero. Eso es aceptable
       *  porque lo que obtiene es **público** (Pieza 9.14): que un camión de
       *  servicio público pasó por un punto a cierta hora, con el económico
       *  que trae pintado en el costado.
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
