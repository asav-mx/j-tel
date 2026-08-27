import { NextResponse } from "next/server";
import {
  antiguedadSegundos,
  enHorarioDeServicio,
  esFresco,
  fechaLocalDelCircuito,
  idPublicoDelDia,
  sentidoDeLaUnidad,
  type TrazadoDeSentido,
} from "@jtel/domain/publico";
import { getRepos } from "@/lib/db";

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
   * rompa nada.
   */
  const circuito = await getRepos().circuits.getPublishedCircuitBySlug(slug);
  if (!circuito) {
    return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });
  }

  const ahora = new Date();
  const enServicio = enHorarioDeServicio(
    ahora,
    circuito.serviceStartLocal,
    circuito.serviceEndLocal,
    circuito.timeZone,
  );

  const cuerpo = {
    circuito_id: circuito.publicSlug,
    generado_en: ahora.toISOString(),
    ttl_seg: TTL_SEGUNDOS,
    frecuencia_declarada_min: circuito.declaredFrequencyMinutes,
    en_servicio: enServicio,
    unidades: [] as Array<{
      id_publico: string;
      lat: number;
      lon: number;
      rumbo: number | null;
      sentido: "ida" | "vuelta" | null;
      antiguedad_seg: number;
      fresco: true;
    }>,
  };

  /*
   * Fuera de horario no se consulta nada. No es solo ahorro: un camión que
   * regresa al patio a las 23:30 sigue reportando posición, y publicarlo lo
   * volvería un servicio que nadie está dando.
   */
  if (!enServicio) {
    return conCache(cuerpo);
  }

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

  const fechaLocal = fechaLocalDelCircuito(ahora, circuito.timeZone);

  for (const p of posiciones) {
    const antiguedad = antiguedadSegundos(p.recordedAt, ahora);
    // El umbral es del circuito, no una constante: otro corredor puede pedir otro.
    if (!esFresco(antiguedad, circuito.staleAfterSeconds)) continue;

    cuerpo.unidades.push({
      id_publico: idPublicoDelDia(p.unitId, fechaLocal, secreto),
      lat: p.latitude,
      lon: p.longitude,
      rumbo: p.heading,
      sentido: sentidoDeLaUnidad({ lat: p.latitude, lon: p.longitude }, p.heading, trazadosPorSentido),
      antiguedad_seg: antiguedad,
      // Siempre true: las que no lo están no llegan hasta aquí. Va en el cuerpo
      // para que la app no tenga que deducirlo de la antigüedad y del umbral,
      // que además no conoce.
      fresco: true,
    });
  }

  return conCache(cuerpo);
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
