import { NextResponse } from "next/server";
import {
  antiguedadSegundos,
  enHorarioDeServicio,
  esFresco,
  estadoDelCircuito,
  fechaLocalDelCircuito,
  idPublicoDelDia,
  sentidoDeLaUnidad,
  vaSobreElCircuito,
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
 * 1. **El filtro es del servidor.** Publicación, horario y asignación se
 *    resuelven aquí; el teléfono no elige qué se le puede enseñar.
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
      id_publico: string;
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
       * El rango se enseña sólo si ya se calibró la velocidad de ESTE circuito
       * contra la calle. Apagado, EN VIVO sigue enseñando el camión moviéndose
       * —verdad observada— y se calla el minuto estimado, que aún no lo es.
       */
      rango_activo: circuito.arrivalRangeEnabledAt !== null,
      unidades,
    });

  /*
   * Fuera de horario no se consulta nada. No es solo ahorro: un camión que
   * regresa al patio a las 23:30 sigue reportando posición, y publicarlo lo
   * volvería un servicio que nadie está dando.
   */
  if (!enHorario) return responder("fuera_de_horario");

  const secreto = process.env.JTEL_SECRET_KEY;
  if (!secreto) {
    // Sin llave el identificador no sería opaco. Antes que publicar unidades
    // con identidad recalculable, no se publica ninguna.
    return NextResponse.json({ error: "El servicio no está disponible" }, { status: 503 });
  }

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
  const medidas = posiciones.map((p) => ({
    p,
    antiguedadSeg: antiguedadSegundos(p.recordedAt, ahora),
    enCorredor: vaSobreElCircuito(
      { lat: p.latitude, lon: p.longitude },
      trazadosPorSentido,
      circuito.corridorToleranceMeters,
    ),
  }));

  const estado = estadoDelCircuito({
    enHorario,
    observaciones: medidas.map((m) => ({ enCorredor: m.enCorredor, antiguedadSeg: m.antiguedadSeg })),
    frescuraSegundos: circuito.staleAfterSeconds,
    confianzaSegundos: circuito.serviceConfidenceMinutes * 60,
  });

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
  const fechaLocal = fechaLocalDelCircuito(ahora, circuito.timeZone);

  const unidades: Array<{
    id_publico: string;
    lat: number;
    lon: number;
    rumbo: number | null;
    sentido: "ida" | "vuelta" | null;
    antiguedad_seg: number;
    fresco: boolean;
  }> = [];

  for (const { p, antiguedadSeg: antiguedad, enCorredor } of medidas) {
    // Los mismos cortes que decidieron el estado, sobre la misma medición.
    if (!enCorredor) continue;
    if (antiguedad >= circuito.serviceConfidenceMinutes * 60) continue;

    unidades.push({
      id_publico: idPublicoDelDia(p.unitId, fechaLocal, secreto),
      lat: p.latitude,
      lon: p.longitude,
      rumbo: p.heading,
      sentido: sentidoDeLaUnidad(
        { lat: p.latitude, lon: p.longitude },
        p.heading,
        trazadosPorSentido,
        circuito.corridorToleranceMeters,
      ),
      antiguedad_seg: antiguedad,
      /*
       * Ya NO es siempre true. Es lo que decide si la app la pinta encendida y
       * la usa para el rango, o apagada y sólo como «por aquí se le vio». Va
       * resuelto en el servidor porque el umbral es del circuito y el teléfono
       * no lo conoce.
       */
      fresco: esFresco(antiguedad, circuito.staleAfterSeconds),
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
