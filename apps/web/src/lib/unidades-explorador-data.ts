/**
 * Unidades — el nivel intermedio de la flota.
 *
 * El mapa muestra dónde está todo; el expediente muestra una. **Comparar
 * unidades entre sí —que es lo que un jefe de flota hace todo el día— no tenía
 * dónde ocurrir.** Esta pantalla es ese lugar.
 *
 * Arriba no van filtros: van preguntas. Cada lente cambia qué columnas
 * importan y cómo se ordena, **sin filtrar unidades** — la flota completa
 * siempre está, cambia lo que se pregunta de ella.
 *
 * Las medidas se enuncian, no se juzgan: "0 de 24 días con servicio", nunca
 * "unidad desaprovechada". El número dice lo que pasó; la conclusión es del
 * que mira.
 */

import { getRepos } from "@/lib/db";
import { JTTEL_TZ, civilDatesInRange, localDateIso, localDateTimeShort } from "@jtel/domain";

export const LENTES = [
  { clave: "trabajan", pregunta: "¿Cuáles trabajan?", disponible: true },
  { clave: "cuestan", pregunta: "¿Cuáles me cuestan?", disponible: false },
  { clave: "gastan", pregunta: "¿Cuáles gastan más?", disponible: true },
  { clave: "fallan", pregunta: "¿Cuáles fallan?", disponible: true },
] as const;

export type ClaveLente = (typeof LENTES)[number]["clave"];

export type FilaUnidad = {
  id: string;
  label: string;
  placa: string | null;
  activa: boolean;
  /** Días del periodo con al menos un servicio acreditado. */
  diasConServicio: number;
  servicios: number;
  ultimoDato: Date | null;
  ultimoDatoTexto: string | null;
  litros: number;
  costoDiesel: number;
  enTaller: boolean;
};

export type UnidadesData = {
  lente: ClaveLente;
  titular: string;
  /** Días civiles del periodo. Solo para encabezar el rango de fechas. */
  diasPeriodo: number;
  /**
   * Días del periodo en que hubo servicios contratados. Es contra ESTO que se
   * lee "N de M días con servicio" — no contra el calendario. Ver
   * `diasConServicioContratado`.
   */
  diasOperacion: number;
  /**
   * Lo que J-Telemetry no puede ver. La flota es del transportista; los
   * servicios son de los clientes bajo contrato. Sin esta línea, la tabla
   * afirma que media flota está parada.
   */
  alcance: string;
  desde: string;
  hasta: string;
  filas: FilaUnidad[];
  /** Cuando la lente activa no tiene con qué llenarse, se dice por qué. */
  vacio: string | null;
  /** La razón escrita de la lente que espera a Ola 2. */
  razonReservada: string;
};

const DIAS_PERIODO = 30;

/**
 * El titular de la lente "¿cuáles trabajan?".
 *
 * Afirma **cuántas cubrieron**, nunca cuántas no. Decía "45 de 82 unidades no
 * cubrieron ningún servicio": los dos números correctos y la frase falsa,
 * porque el denominador es la flota del transportista y el numerador es la
 * demanda de los clientes contratados — dos universos distintos en una sola
 * fracción (§D del Marco, eje del ALCANCE).
 *
 * El complemento no se enuncia porque J-Telemetry no lo puede sostener: no
 * sabe qué hicieron esas unidades, solo que no fue un servicio contratado.
 */
export function titularTrabajan(cubrieron: number, total: number): string {
  return `${cubrieron} de ${total} unidades cubrieron servicios contratados.`;
}

/**
 * La lente ordena; nunca filtra. La flota completa está en las tres.
 *
 * "¿Cuáles trabajan?" ordena **descendente**: la tabla abre respondiendo lo que
 * la lente pregunta. Estuvo ascendente, poniendo los ceros arriba porque se
 * asumió que un cero pedía atención; la medición tumbó la premisa —el cero es
 * el estado normal de una unidad que sirve a otro cliente— y con ella el orden.
 */
export function ordenarFilas(lente: ClaveLente, filas: FilaUnidad[]): FilaUnidad[] {
  const porNombre = (a: FilaUnidad, b: FilaUnidad) => a.label.localeCompare(b.label, "es");
  if (lente === "trabajan") {
    return [...filas].sort((a, b) => b.diasConServicio - a.diasConServicio || porNombre(a, b));
  }
  if (lente === "gastan") {
    return [...filas].sort((a, b) => b.litros - a.litros || porNombre(a, b));
  }
  // Las más calladas primero; las que nunca reportaron, hasta arriba.
  return [...filas].sort(
    (a, b) =>
      (a.ultimoDato?.getTime() ?? -1) - (b.ultimoDato?.getTime() ?? -1) || porNombre(a, b),
  );
}

export async function loadUnidades(
  carrier: { id: string; slug: string },
  opts: { lente?: string; ahora?: Date } = {},
): Promise<UnidadesData> {
  const repos = getRepos();
  const ahora = opts.ahora ?? new Date();
  const desde = new Date(ahora.getTime() - (DIAS_PERIODO - 1) * 86_400_000);

  const lente: ClaveLente = (LENTES.find((l) => l.clave === opts.lente && l.disponible)?.clave ??
    "trabajan") as ClaveLente;

  // Los siete días: el periodo del explorador es de calendario, no de
  // operación. Si se recortara a los días laborables, "0 de N con servicio"
  // cambiaría de significado según la semana y dejaría de ser comparable.
  const dias = civilDatesInRange(
    localDateIso(desde, JTTEL_TZ),
    localDateIso(ahora, JTTEL_TZ),
    [0, 1, 2, 3, 4, 5, 6],
  );

  // Km y huecos NO se muestran, y la razón es medida, no de gusto.
  //
  // `resumenDiarioPorUnidad` es un resumidor DIARIO —su documentación lo mide
  // en 52 filas y menos de 200 ms **por día**— y esta tabla necesita un mes.
  // Pedírselo de treinta ventanas o de una sola da lo mismo: **6.2 s** en las
  // dos formas, contra ~1.0 s sin él. Medido tres veces, la última con el
  // servidor recién arrancado para descartar que fuera ruido de recompilación.
  //
  // La ficha pedía medir el costo de estas columnas antes de dibujarlas.
  // Medido: no se sostienen a treinta días, y una columna que tarda seis
  // segundos no se muestra. Vuelven cuando exista un agregado por periodo —
  // que el propio `resumen-telemetria` bendice hacer en SQL para conteos,
  // kilómetros y huecos, por ser reglas de tiempo y distancia.
  //
  // Lo que sí se sostiene: cuándo reportó por última vez cada unidad.
  const [unidades, ultimoPorUnidad, servicios, combustible, taller, operacion] = await Promise.all([
    repos.fleet.getUnitsForCarrier(carrier.id),
    repos.telemetry.getLastPointPerUnit(carrier.id),
    repos.occurrences.serviciosPorUnidad(carrier.id, desde, ahora),
    repos.fleet.getFuelForCarrier(carrier.id, desde),
    repos.fleet.getMaintenanceForCarrier(carrier.id),
    repos.occurrences.diasConServicioContratado(carrier.id, desde, ahora),
  ]);

  const diesel = new Map<string, { litros: number; costo: number }>();
  for (const f of combustible) {
    if (f.recordedAt < desde) continue;
    const acc = diesel.get(f.unitId) ?? { litros: 0, costo: 0 };
    acc.litros += f.liters ?? 0;
    acc.costo += f.cost ?? 0;
    diesel.set(f.unitId, acc);
  }

  const enTaller = new Set(
    taller.filter((m) => m.status !== "completado").map((m) => m.unitId),
  );

  const filas: FilaUnidad[] = unidades.map((u) => {
    const ultimo = ultimoPorUnidad.get(u.id) ?? null;
    const s = servicios.get(u.id);
    const d = diesel.get(u.id);
    return {
      id: u.id,
      label: u.label,
      placa: u.plateNumber ?? null,
      activa: u.active,
      diasConServicio: s?.dias ?? 0,
      servicios: s?.servicios ?? 0,
      ultimoDato: ultimo,
      ultimoDatoTexto: ultimo ? localDateTimeShort(ultimo, JTTEL_TZ) : null,
      litros: d?.litros ?? 0,
      costoDiesel: d?.costo ?? 0,
      enTaller: enTaller.has(u.id),
    };
  });

  const ordenadas = ordenarFilas(lente, filas);

  const sinSalir = ordenadas.filter((f) => f.diasConServicio === 0).length;
  const conDiesel = ordenadas.filter((f) => f.litros > 0).length;
  const limiteMudo = ahora.getTime() - 2 * 86_400_000;
  const mudas = ordenadas.filter((f) => !f.ultimoDato || f.ultimoDato.getTime() < limiteMudo).length;

  // Por qué el titular no nombra a las que no cubrieron: ver `titularTrabajan`.
  //
  // Medido el 2026-08-02, para que quede el dato y no el argumento: de las 45
  // sin servicio acreditado, el ledger del propio árbitro las evaluó como
  // candidatas cientos de veces cada una, y solo 27 de 543 servicios sin unidad
  // tuvieron a alguna de ellas llegando al destino esperado. No están paradas:
  // hacen trabajo que J-Telemetry no ve, porque solo ve lo contratado.
  const titular =
    lente === "trabajan"
      ? titularTrabajan(filas.length - sinSalir, filas.length)
      : lente === "gastan"
        ? conDiesel === 0
          ? "Sin capturas de diésel en el periodo."
          : `${conDiesel} de ${filas.length} unidades tienen capturas de diésel.`
        : mudas === 0
          ? `Las ${filas.length} unidades reportaron en las últimas 48 horas.`
          : `${mudas} de ${filas.length} unidades llevan más de 48 horas sin reportar.`;

  // Si la lente no tiene con qué llenarse, se dice — no se dibuja una tabla de
  // columnas vacías, que es peor que una tabla más corta.
  const vacio =
    lente === "gastan" && conDiesel === 0
      ? "No hay capturas de diésel en el periodo, así que no hay nada que comparar. Las columnas de esta lente se llenan conforme se capturen cargas."
      : null;

  return {
    lente,
    titular,
    diasPeriodo: dias.length,
    diasOperacion: operacion.dias,
    alcance:
      "J-Telemetry solo ve los servicios bajo contrato. Una unidad sin servicios aquí puede estar " +
      "trabajando en algo que este sistema no mide — el cero dice lo que J-Telemetry vio, no lo que la unidad hizo.",
    desde: localDateIso(desde, JTTEL_TZ),
    hasta: localDateIso(ahora, JTTEL_TZ),
    filas: ordenadas,
    vacio,
    razonReservada:
      "Se enciende cuando la verificación alcance su umbral de confianza. Cuántos servicios no cumplidos carga una unidad es una cifra de juicio, y se mueve cuando se afina el árbitro.",
  };
}
