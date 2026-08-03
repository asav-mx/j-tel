/**
 * Expediente de la ruta — la segunda identidad con expediente propio.
 *
 * Responde: **¿qué se acordó recorrer, y cómo se ha comportado en el tiempo?**
 *
 * Cara **cliente** (planta y campus). Nada de la unidad ni del chofer entra
 * aquí: una ruta la cubren distintas unidades, y eso vive del lado carrier.
 *
 * ── Las dos ausencias declaradas ────────────────────────────────────────────
 *
 * 1. **La duración esperada.** Medido el 2026-08-02: las 48 combinaciones
 *    ruta×turno tienen **una sola medición cada una**. Un percentil sobre una
 *    muestra no es un percentil. Y la razón de fondo no es estadística: si la
 *    pantalla dice "duración esperada 1:08" y ese número salió de un solo
 *    recorrido, el transportista puede acabar discutiendo contra una
 *    expectativa que nadie acordó y que el sistema inventó de una observación.
 *    Eso es peor que no tener el renglón.
 *
 *    El motor ya se niega a resumir con tan poco (`routeDurationMinSamples`).
 *    Lo que faltaba era que la pantalla dijera **por qué** no está.
 *
 * 2. **El bloque de métricas** (§2.4 de la ficha). Los datos existen en
 *    `complianceFacts`, y aun así no entra: mostrar 87.5% de cumplimiento antes
 *    de que el árbitro acierte de forma sostenida es publicar un número que no
 *    aguanta una discusión. Espacio reservado con la leyenda de la compuerta,
 *    no sección escondida.
 *
 * ── Y una etiqueta que importa ──────────────────────────────────────────────
 *
 * `routes.createdAt` es **cuándo se dio de alta en el sistema**, no cuándo
 * empezó a operar la ruta. Va etiquetado como "en el sistema desde" y jamás
 * como inicio de operación: presentar el alta como fecha de arranque le
 * atribuiría al contrato una antigüedad que nadie firmó.
 */

import { getRepos } from "@/lib/db";
import { JTTEL_TZ, localDateIso, localTimeHHMM } from "@jtel/domain";
import { routeLengthKm } from "@jtel/verification";

export const DIAS_DEL_PERIODO = 30;
const ULTIMOS_SERVICIOS = 12;

export type LatLng = { lat: number; lng: number };

export type TurnoDeRuta = {
  routeShiftId: string;
  turno: string;
  /** Muestras de recorrido medidas. Hoy, una por combinación. */
  muestras: number;
};

export type DiaDeRuta = {
  fecha: string;
  cumplidos: number;
  noCumplidos: number;
  pendientes: number;
  sinSellar: number;
  total: number;
};

export type ServicioDeRuta = {
  ocurrenciaId: string;
  fecha: string;
  turno: string;
  cierre: string;
  llegada: string | null;
  /** El motivo MEDIDO, con su umbral al lado. Nunca una etiqueta suelta. */
  motivo: string | null;
  resultado: "cumplido" | "no_cumplido" | "pendiente" | "sin_sellar";
};

export type ExpedienteRuta = {
  ruta: { id: string; nombre: string; enElSistemaDesde: string };
  /** Navegación entre hermanas dentro de la lista de origen. */
  hermanas: {
    anterior: { id: string; nombre: string } | null;
    siguiente: { id: string; nombre: string } | null;
    indice: number;
    total: number;
  };
  identidad: { etiqueta: string; valor: string; lectura: string | null }[];
  turnos: TurnoDeRuta[];
  trazado: { puntos: LatLng[]; corredorMetros: number | null };
  geocercas: { id: string; nombre: string; poligono: LatLng[] }[];
  dias: DiaDeRuta[];
  servicios: ServicioDeRuta[];
  /** Ausencias con su razón. Se muestran; el hueco callado no. */
  ausentes: { titulo: string; razon: string }[];
  /** La leyenda de la compuerta para el bloque de métricas. */
  compuerta: string;
};

export const COMPUERTA =
  "Disponible cuando la verificación alcance su umbral de confianza. Los datos existen; publicar un porcentaje de cumplimiento antes de que el árbitro acierte de forma sostenida es publicar un número que no aguanta una discusión.";

function fecha(d: Date): string {
  return localDateIso(d, JTTEL_TZ);
}

export async function loadExpedienteRuta(
  cliente: { id: string; name: string },
  routeId: string,
): Promise<ExpedienteRuta | null> {
  const repos = getRepos();
  const ahora = new Date();

  const rutas = await repos.routes.getRoutesForClient(cliente.id);
  const ruta = rutas.find((r) => r.id === routeId);
  // La pertenencia se resuelve contra las rutas del cliente: un identificador
  // de otra cuenta no aparece, y la pantalla no se entera de que existe.
  if (!ruta) return null;

  const desde = new Date(ahora.getTime() - DIAS_DEL_PERIODO * 86_400_000);
  const desdeFecha = fecha(desde);
  // El techo del periodo. Sin él, "los últimos 30 días" y "últimos servicios"
  // traen el futuro que el generador ya creó.
  const hoy = fecha(ahora);

  const todosLosRutaTurno = await repos.routes.getRouteShiftsForClient(cliente.id);
  const suyos = todosLosRutaTurno.filter((rs) => rs.routeId === routeId);

  const [version, muestras, dias, ultimos, perfiles] = await Promise.all([
    repos.routes.getKmlVersionForDate(routeId, ahora),
    repos.routes.medicionesDeRecorridoPorRutaTurno(suyos.map((rs) => rs.id)),
    repos.occurrences.diasDeRuta(routeId, desdeFecha, hoy),
    repos.occurrences.ultimosServiciosDeRuta(routeId, ULTIMOS_SERVICIOS, hoy),
    repos.profiles.findForClient(cliente.id),
  ]);

  const muestrasPor = new Map(muestras.map((m) => [m.routeShiftId, Number(m.muestras)]));

  const turnos: TurnoDeRuta[] = suyos
    .map((rs) => ({
      routeShiftId: rs.id,
      turno: rs.shift?.name ?? "—",
      muestras: muestrasPor.get(rs.id) ?? 0,
    }))
    .sort((a, b) => a.turno.localeCompare(b.turno, "es"));

  // Los perfiles de esta ruta traen la geocerca de destino y la política del
  // contrato: el corredor y la tolerancia salen de ahí, nunca de una constante.
  const deLaRuta = perfiles.filter((p) => suyos.some((rs) => rs.id === p.routeShiftId));
  const geocercas = new Map<string, { id: string; nombre: string; poligono: LatLng[] }>();
  for (const p of deLaRuta) {
    const g = p.geofence;
    if (g && Array.isArray(g.polygon) && g.polygon.length >= 3 && !geocercas.has(g.id)) {
      geocercas.set(g.id, { id: g.id, nombre: g.name, poligono: g.polygon as LatLng[] });
    }
  }

  const politica = (deLaRuta[0]?.contract?.policy ?? {}) as {
    kmlCorridorMeters?: number;
    verificationGraceMinutes?: number;
    corridorMinPct?: number;
  };

  const puntos = (version?.waypoints ?? []) as LatLng[];
  // El largo NO se guarda: se calcula de los waypoints con la misma función que
  // usa el motor. Dos largos distintos para la misma ruta en dos pantallas
  // destruyen la credibilidad de las dos.
  const km = puntos.length > 1 ? routeLengthKm(puntos) : null;

  const ordenadas = [...rutas].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const i = ordenadas.findIndex((r) => r.id === routeId);
  const hermana = (x: (typeof ordenadas)[number] | undefined) =>
    x ? { id: x.id, nombre: x.name } : null;

  const identidad: ExpedienteRuta["identidad"] = [
    {
      etiqueta: "Turnos que cubre",
      valor: String(turnos.length),
      lectura: turnos.length > 0 ? turnos.map((t) => t.turno).join(" · ") : null,
    },
    {
      etiqueta: "Recorrido contratado",
      valor: km != null ? `${km.toFixed(1)} km` : "sin trazado",
      lectura: km != null ? `${puntos.length} puntos del trazado vigente` : null,
    },
    {
      etiqueta: "Corredor",
      valor:
        politica.kmlCorridorMeters != null ? `${politica.kmlCorridorMeters} m` : "sin definir",
      lectura: "ancho a cada lado del trazado, del contrato",
    },
    {
      etiqueta: "Tolerancia",
      valor:
        politica.verificationGraceMinutes != null
          ? `${politica.verificationGraceMinutes} min`
          : "sin definir",
      lectura: "después del cierre, del contrato",
    },
    {
      // `createdAt` es el alta en el sistema. Jamás "activa desde".
      etiqueta: "En el sistema desde",
      valor: fecha(ruta.createdAt),
      lectura: "fecha de alta, no de inicio de operación",
    },
  ];

  // ── La tira de días ──────────────────────────────────────────────────────
  const porFecha = new Map<string, DiaDeRuta>();
  for (const d of dias) {
    const dia =
      porFecha.get(d.fecha) ??
      { fecha: d.fecha, cumplidos: 0, noCumplidos: 0, pendientes: 0, sinSellar: 0, total: 0 };
    const n = Number(d.total);
    if (d.status === "cumplido") dia.cumplidos += n;
    else if (d.status === "no_cumplido") dia.noCumplidos += n;
    else if (d.status === "pendiente_evidencia") dia.pendientes += n;
    // Sin hecho: el día todavía no se juzgó. No es un cumplido ni una falta.
    else dia.sinSellar += n;
    dia.total += n;
    porFecha.set(d.fecha, dia);
  }

  const servicios: ServicioDeRuta[] = ultimos.map((s) => {
    const resultado =
      s.status === "cumplido"
        ? ("cumplido" as const)
        : s.status === "no_cumplido"
          ? ("no_cumplido" as const)
          : s.status === "pendiente_evidencia"
            ? ("pendiente" as const)
            : ("sin_sellar" as const);

    // El motivo va con su medición y su umbral. "Tarde" a secas obliga a
    // preguntar por cuánto, y quien lee un expediente no debe calcular.
    const motivo =
      s.llegada && s.timing
        ? `${s.timing === "tarde" ? "tarde" : s.timing === "temprano" ? "temprano" : "a tiempo"} · ${Math.abs(Math.round((s.llegada.getTime() - s.deadline.getTime()) / 60_000))} min ${s.llegada > s.deadline ? "después" : "antes"} del cierre${s.excusable ? " · excusable" : ""}`
        : s.cobertura != null && politica.corridorMinPct != null
          ? `cobertura ${(s.cobertura * 100).toFixed(1)}% · umbral ${(politica.corridorMinPct * 100).toFixed(1)}%`
          : null;

    return {
      ocurrenciaId: s.ocurrenciaId,
      fecha: s.fecha,
      turno: s.turno,
      cierre: `${fecha(s.deadline)} ${localTimeHHMM(s.deadline, JTTEL_TZ)}`,
      llegada: s.llegada ? `${fecha(s.llegada)} ${localTimeHHMM(s.llegada, JTTEL_TZ)}` : null,
      motivo,
      resultado,
    };
  });

  const conUnaMuestra = turnos.filter((t) => t.muestras > 0 && t.muestras < 2).length;

  return {
    ruta: { id: ruta.id, nombre: ruta.name, enElSistemaDesde: fecha(ruta.createdAt) },
    hermanas: {
      anterior: hermana(ordenadas[i - 1]),
      siguiente: hermana(ordenadas[i + 1]),
      indice: i + 1,
      total: ordenadas.length,
    },
    identidad,
    turnos,
    trazado: { puntos, corredorMetros: politica.kmlCorridorMeters ?? null },
    geocercas: [...geocercas.values()],
    dias: [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    servicios,
    ausentes: [
      {
        titulo: "Duración esperada",
        razon:
          conUnaMuestra > 0
            ? `Se necesita historia para resumirla, y hoy cada turno de esta ruta tiene una sola medición de recorrido. Un percentil sobre una muestra no es un percentil: si la pantalla dijera «1:08», sería una expectativa que nadie acordó y que el sistema sacó de un solo día. Vuelve cuando haya recorridos suficientes.`
            : "Se necesita historia de recorridos medidos para resumirla, y esta ruta todavía no la tiene.",
      },
      {
        titulo: "Cumplimiento, margen y cobertura del periodo",
        razon: COMPUERTA,
      },
      {
        titulo: "Unidades y choferes",
        razon:
          "Una ruta la cubren distintas unidades, y eso es operación interna del transportista: no entra en la cara del cliente.",
      },
    ],
    compuerta: COMPUERTA,
  };
}
