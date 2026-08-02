/**
 * Inicio del transportista — "lo que necesita atención hoy".
 *
 * La regla que gobierna qué entra: **no todo número es juicio.**
 *
 * Un hecho contable —cuántos pendientes hay abiertos, cuántas unidades llevan
 * días mudas, a qué hora selló la planta— es el mismo número mañana aunque el
 * motor mejore. Un porcentaje de cumplimiento no. Por eso lo primero va hoy y
 * lo segundo espera a Ola 3, con su espacio reservado y su razón escrita.
 *
 * Y lo que no existe no se dibuja: los renglones que dependen del módulo de
 * choferes no aparecen con un cero falso, aparecen declarados.
 */

import { getRepos } from "@/lib/db";
import { JTTEL_TZ, localDateIso, localDateTimeShort } from "@jtel/domain";

/** Un renglón de la bandeja. Sin acción no es un hallazgo, es una alerta. */
export type RenglonBandeja = {
  clave: string;
  /** Cuántos. Es la marca cuadrada de la izquierda. */
  cifra: number;
  /** Acero = estado operativo. Ámbar y rojo solo cuando hay veredicto detrás. */
  tono: "acero" | "ambar" | "rojo";
  /** La afirmación, como hecho. */
  afirmacion: string;
  /** El detalle medido, en mono, con fechas completas. */
  detalle: string;
  accion: { href: string; label: string } | null;
};

/** Lo que espera a otro módulo. Se declara, no se esconde. */
export type RenglonReservado = { titulo: string; razon: string };

export type InicioCarrierData = {
  nombre: string;
  slug: string;
  fechaHoy: string;
  titular: string;
  /** El dato ancla de la cara del transportista. */
  contexto: string;
  bandeja: RenglonBandeja[];
  reservados: RenglonReservado[];
  flota: { unidades: number; conRastreador: number; mudas: number; nuncaReportaron: number };
  clientes: Array<{
    contratoId: string;
    cliente: string;
    sitio: string;
    contrato: string;
    pendientes: number;
    href: string;
  }>;
  /** Cuánto tardó la consulta cara. Se mide porque crece sola. */
  msUnidadesMudas: number | null;
};

/** Días sin reportar a partir de los cuales una unidad cuenta como muda. */
const DIAS_MUDA = 2;

/** La ventana de la bandeja. Todo lo que acusa lleva su alcance escrito. */
const DIAS_VENTANA = 14;

/**
 * Cuándo la consulta por unidad deja de ser tolerable en el inicio.
 *
 * El repositorio la midió en 462 ms sobre 2.2 M de filas y crece ~51 000 al
 * día. El umbral deja margen sobre esa medición y avisa antes de que duela.
 */
const MS_ALERTA_CONSULTA = 800;

export async function loadInicioCarrier(
  carrier: { id: string; name: string; slug: string },
  opts: { ahora?: Date } = {},
): Promise<InicioCarrierData> {
  const repos = getRepos();
  const ahora = opts.ahora ?? new Date();
  const hoyIso = localDateIso(ahora, JTTEL_TZ);

  const [unidades, dispositivos, contratos] = await Promise.all([
    repos.fleet.getUnitsForCarrier(carrier.id),
    repos.fleet.getDevicesForCarrier(carrier.id),
    repos.contracts.findForCarrier(carrier.id),
  ]);
  const activos = contratos.filter((c) => c.status === "active");

  // La consulta por unidad barre las filas del carrier y crece sola —está
  // medida y documentada en el repositorio. Se mide aquí también para que la
  // pantalla que más se abre no la pague en silencio el día que deje de ser
  // tolerable.
  const t0 = Date.now();
  const ultimoPorUnidad = await repos.telemetry.getLastPointPerUnit(carrier.id);
  const msUnidadesMudas = Date.now() - t0;
  if (msUnidadesMudas > MS_ALERTA_CONSULTA) {
    // Avisa cuando deje de ser tolerable, en vez de degradarse en silencio en
    // la pantalla que más se abre. La salida documentada NO es recortar la
    // ventana —eso confundiría "nunca reportó" con "dejó de reportar"— sino el
    // índice (carrier_account_id, unit_id, recorded_at DESC).
    console.warn(
      `[inicio-carrier] getLastPointPerUnit tardó ${msUnidadesMudas} ms (umbral ${MS_ALERTA_CONSULTA} ms). ` +
        "Toca crear el índice (carrier_account_id, unit_id, recorded_at DESC).",
    );
  }

  const limite = ahora.getTime() - DIAS_MUDA * 86_400_000;
  const mudas: Array<{ id: string; label: string; ultimo: Date }> = [];
  let nuncaReportaron = 0;
  for (const u of unidades) {
    const ultimo = ultimoPorUnidad.get(u.id);
    // "Nunca reportó" y "dejó de reportar" son problemas distintos con dueños
    // distintos: uno es alta mal hecha, el otro es un rastreador caído.
    if (!ultimo) {
      nuncaReportaron += 1;
      continue;
    }
    if (ultimo.getTime() < limite) mudas.push({ id: u.id, label: u.label, ultimo });
  }
  mudas.sort((a, b) => a.ultimo.getTime() - b.ultimo.getTime());

  // Los no cumplidos van con ALCANCE TEMPORAL. Sin él es §D del Marco: un
  // conteo desde el principio de los tiempos alarma sin informar, porque no
  // dice de cuándo — y en la bandeja del auditado, además, acusa acumulando.
  const desde = new Date(ahora.getTime() - DIAS_VENTANA * 86_400_000);
  const conteos = await Promise.all(
    activos.map(async (c) => {
      const [ventana, abiertos] = await Promise.all([
        repos.occurrences.countByStatusForContract(c.id, desde, ahora),
        // Los pendientes sí se cuentan abiertos y sin recorte: un pendiente no
        // se cierra con el tiempo, sigue esperando evidencia. Su alcance es
        // "abierto", no una fecha.
        repos.occurrences.countByStatusForContract(c.id),
      ]);
      return { contrato: c, ventana, abiertos };
    }),
  );

  const noCumplidos = conteos.reduce((n, c) => n + c.ventana.no_cumplido, 0);
  const pendientes = conteos.reduce((n, c) => n + c.abiertos.pendiente_evidencia, 0);

  const bandeja: RenglonBandeja[] = [];

  if (mudas.length > 0) {
    const peor = mudas[0]!;
    bandeja.push({
      clave: "unidades-mudas",
      cifra: mudas.length,
      // Estado operativo: acero. Verde, ámbar y rojo son de los veredictos.
      tono: "acero",
      afirmacion:
        mudas.length === 1
          ? "Una unidad lleva días sin reportar."
          : `${mudas.length} unidades llevan días sin reportar.`,
      detalle: `La más antigua es ${peor.label}, último punto ${localDateTimeShort(peor.ultimo, JTTEL_TZ)}`,
      accion: { href: `/carrier/flota?account=${carrier.slug}`, label: "Ver unidades" },
    });
  }

  if (noCumplidos > 0) {
    bandeja.push({
      clave: "no-cumplidos",
      cifra: noCumplidos,
      tono: "rojo",
      afirmacion:
        noCumplidos === 1
          ? "Un servicio quedó no cumplido."
          : `${noCumplidos} servicios quedaron no cumplidos.`,
      detalle: `Sellados por la planta en los últimos ${DIAS_VENTANA} días · desde ${localDateIso(desde, JTTEL_TZ)}`,
      accion: { href: `/carrier/cumplimiento?account=${carrier.slug}`, label: "Ver servicios" },
    });
  }

  if (pendientes > 0) {
    bandeja.push({
      clave: "pendientes",
      cifra: pendientes,
      tono: "ambar",
      afirmacion:
        pendientes === 1
          ? "Un servicio no se pudo juzgar por falta de evidencia."
          : `${pendientes} servicios no se pudieron juzgar por falta de evidencia.`,
      // Ley 7 del Marco, dicha donde el auditado la lee.
      detalle: "Abiertos, sin recorte de fecha · sin evidencia no hay incumplimiento: están pendientes, no reprobados",
      accion: { href: `/carrier/cumplimiento?account=${carrier.slug}`, label: "Ver servicios" },
    });
  }

  // Lo prevenible antes de lo ya sellado: lo operativo (acero) arriba, el
  // veredicto sellado abajo. El orden lo fija el tono, no el azar.
  const orden = { acero: 0, ambar: 1, rojo: 2 } as const;
  bandeja.sort((a, b) => orden[a.tono] - orden[b.tono]);

  // "Cosas" son los renglones de la bandeja, NO la suma de sus cifras. Sumar
  // 9 unidades mudas con 518 servicios da un 604 que no significa nada: mezcla
  // universos distintos y alarma con un número que nadie puede accionar.
  const cosas = bandeja.length;
  const titular =
    cosas === 0
      ? "Hoy nada te necesita."
      : cosas === 1
        ? "Una cosa antes de que se vuelva problema."
        : `${cosas} cosas antes de que se vuelvan problema.`;

  return {
    nombre: carrier.name,
    slug: carrier.slug,
    fechaHoy: hoyIso,
    titular,
    contexto: `${unidades.length} unidades · ${activos.length} contrato${activos.length === 1 ? "" : "s"} activo${activos.length === 1 ? "" : "s"} · ${hoyIso}`,
    bandeja,
    reservados: [
      {
        titulo: "Unidades que se movieron sin chofer declarado",
        razon:
          "Espera el módulo de choferes. Hoy no existe la declaración de quién manejó, y contarla sin el dato sería inventarla.",
      },
      {
        titulo: "Credenciales por vencer",
        razon: "Espera el módulo de choferes: las licencias viven en su expediente.",
      },
      {
        titulo: "Cumplimiento",
        razon:
          "Disponible cuando la verificación alcance su umbral de confianza. Un porcentaje se mueve cuando se afina el árbitro; un conteo de pendientes no.",
      },
    ],
    flota: {
      unidades: unidades.length,
      conRastreador: dispositivos.length,
      mudas: mudas.length,
      nuncaReportaron,
    },
    clientes: conteos.map(({ contrato, abiertos }) => ({
      contratoId: contrato.id,
      cliente: contrato.client?.name ?? "Cliente",
      sitio: contrato.plant
        ? `${contrato.plant.name} (${contrato.plant.code})`
        : contrato.plantGroup
          ? contrato.plantGroup.name
          : "—",
      contrato: contrato.name,
      pendientes: abiertos.pendiente_evidencia,
      href: `/carrier/cumplimiento?contract=${contrato.id}&account=${carrier.slug}`,
    })),
    msUnidadesMudas,
  };
}
