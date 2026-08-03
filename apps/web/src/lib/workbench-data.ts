/**
 * Workbench — el instrumento de análisis y de defensa del transportista.
 *
 * Responde dos preguntas y no una: **¿qué pasó, y cómo lo pruebo?**
 *
 * La ley que lo separa de Monitoreo es por tiempo, no por objeto: Monitoreo
 * mira el ahora, el Workbench mira hacia atrás. Cualquier pregunta sobre el
 * pasado —una unidad el martes, dos comparadas, un servicio disputado— vive
 * aquí, sobre el mismo lienzo.
 *
 * Y lo que lo hace distinto de un rastreador: encima del recorrido real van el
 * trazado contratado, la ventana del servicio verificado, los huecos de
 * evidencia y el resultado que se selló. Esa segunda familia de capas es la que
 * nadie más tiene.
 *
 * ── Las dos leyes que gobiernan este archivo ────────────────────────────────
 *
 * 1. **Simplificar es para explorar. La ventana de un servicio va completa,
 *    siempre.** Ver `simplificar-traza.ts` y `Ficha-Workbench` §3.3. Al abrir un
 *    servicio la tolerancia es cero por construcción, no por configuración.
 *
 * 2. **La traza NO se corta en la geocerca.** Es la única pantalla del producto
 *    donde no aplica el corte de la ley 4, porque aquí no se le está enseñando
 *    la operación del transportista a un cliente: es su propia flota, en su
 *    propia pantalla. La pantalla lo declara al pie en vez de dejarlo implícito.
 *
 * ── Lo que NO calcula, con su razón medida ──────────────────────────────────
 *
 * No hay tiempo detenido ni conteo de paradas. Los rastreadores reportan las
 * veinticuatro horas y a las 3 de la mañana 2 924 de 2 930 puntos están en cero:
 * un "tiempo detenido" sobre un rango cualquiera mide sobre todo el
 * estacionamiento nocturno. Acotarlo a la operación contratada tampoco alcanza —
 * de 53 unidades con traza en 7 días solo 29 tienen ventana acreditada. Las
 * paradas sí se dibujan, con su lugar y su duración, que es lo que las hace
 * legibles. Ver `Ficha-Workbench` §3.4.
 */

import { getRepos } from "@/lib/db";
import {
  JTTEL_TZ,
  SIN_SENAL_MINUTOS,
  instanteZonificado,
  localDateIso,
  localTimeHHMM,
} from "@jtel/domain";
import { simplificarTraza, toleranciaParaTraza, type Punto } from "@/lib/simplificar-traza";
import {
  huecosDeSenal,
  kilometros,
  paradas,
  partirEnHuecos,
  PARADA_MINUTOS_POR_DEFECTO,
  type Hueco,
  type Parada,
  type PuntoTraza,
} from "@/lib/workbench-medidas";

export type LatLng = Punto;

/**
 * Cuántas unidades caben en una composición, y por qué este número.
 *
 * Medido el 2026-08-02 contra producción: 3 unidades × 30 días son 124 396
 * puntos y 2 444 ms. El costo crece con los puntos, no con las unidades, así
 * que el tope es una defensa contra la composición que nadie quiso pedir —
 * ochenta y dos unidades por un mes— y **se declara en pantalla** en vez de
 * recortar en silencio.
 */
export const MAX_UNIDADES = 6;

/** Tope del rango, en días. Mismo argumento: el costo vive en los puntos. */
export const MAX_DIAS = 31;

/**
 * Una parada o un hueco, ya listos para dibujarse.
 *
 * La etiqueta se arma en el servidor y no en el lienzo, y no es un detalle de
 * arquitectura: **toda hora de este producto va en el reloj de la operación y
 * con su fecha completa.** Un `toISOString()` en el cliente escribiría UTC, y un
 * turno nocturno leído en UTC cambia de día. Aquí eso no es un desfase cosmético
 * — es un dato que no sostiene un caso.
 */
export type MarcaDibujada = {
  lat: number;
  lng: number;
  minutos: number;
  etiqueta: string;
};

export type HuecoDibujado = MarcaDibujada & { latFin: number; lngFin: number };

export type UnidadTraza = {
  unitId: string;
  label: string;
  plateNumber: string | null;
  /** Índice en la paleta de identidad. Identifica; no mide ni juzga. */
  colorIndex: number;
  /**
   * La traza a dibujar, **partida en tramos observados**.
   *
   * No es una polilínea sino varias: la línea se corta en cada hueco de señal
   * en vez de atravesarlo. Una recta que cruza un hueco de dos horas dibuja un
   * camino que nadie demostró, con el mismo brillo que la evidencia real.
   *
   * Simplificada solo si la composición lo pidió, y cada tramo por separado.
   */
  tramos: LatLng[][];
  /**
   * Lo medido DENTRO de la ventana del servicio abierto. `null` sin servicio.
   *
   * Existe para que el panel de medidas no conteste con el día entero una
   * pregunta que se hizo sobre una ventana de dos horas.
   */
  kmVentana: number | null;
  puntosVentana: number | null;
  huecosVentana: Hueco[] | null;
  /**
   * El tramo que cae DENTRO de la ventana de evidencia del servicio abierto.
   *
   * Es la capa que ningún rastreador puede dibujar: separa lo que el árbitro
   * miró de todo lo demás que la unidad hizo ese día. `null` fuera del modo
   * servicio — sin servicio abierto no hay ventana que separar, y pintar una
   * inventada sería peor que no tener la capa.
   */
  tramosVentana: LatLng[][] | null;
  puntosTotales: number;
  puntosDibujados: number;
  km: number;
  saltosDescartados: number;
  huecos: HuecoDibujado[];
  paradas: MarcaDibujada[];
  /** Primer y último dato del rango, ya escritos con fecha y hora locales. */
  primerDato: string | null;
  ultimoDato: string | null;
};

export type ResultadoServicio = "cumplido" | "no_cumplido" | "pendiente" | "sin_sellar";

export type ServicioEnRango = {
  ocurrenciaId: string;
  fecha: string;
  ruta: string;
  turno: string;
  cliente: string;
  resultado: ResultadoServicio;
  /**
   * La unidad que el árbitro acreditó, si acreditó alguna.
   *
   * **Un `no_cumplido` nunca tiene unidad acreditada**: el motor solo persiste
   * la unidad observada cuando el veredicto salió cumplido. Que sea `null` no
   * significa que ninguna unidad haya ido — significa que el árbitro no
   * acreditó ninguna, que es justo lo que el transportista viene a disputar.
   */
  unidadAcreditada: { id: string; label: string } | null;
  cierre: string;
  /** Ventana de evidencia congelada del viaje. Es la que el lienzo dibuja. */
  ventana: { desde: Date; hasta: Date } | null;
};

export type WorkbenchData = {
  modo: "vacio" | "rango" | "servicio";
  titular: string;
  /** Las medidas gruesas del encabezado: días, servicios, kilómetros. */
  subtitulo: string;
  alcance: string;
  rango: { desde: string; hasta: string; dias: number };
  simplificacion: {
    activa: boolean;
    toleranciaMetros: number;
    puntosTotales: number;
    puntosDibujados: number;
    /** La declaración visible. Nunca un asterisco al pie. */
    declaracion: string;
  };
  unidades: UnidadTraza[];
  /** El campo "Quién": todas las activas, con cuántos puntos reportaron. */
  candidatas: { id: string; label: string; plateNumber: string | null; puntos: number }[];
  contratado: { routeId: string; nombre: string; puntos: LatLng[] }[];
  geocercas: { id: string; nombre: string; poligono: LatLng[] }[];
  servicios: ServicioEnRango[];
  /** Solo en modo servicio: la ventana verificada que se está mirando. */
  servicioAbierto: ServicioEnRango | null;
  medidas: { etiqueta: string; valor: string; lectura: string }[];
  paradaUmbralMinutos: number;
  /** Topes aplicados a esta composición. Ninguno en silencio. */
  limites: string[];
  ausentes: { titulo: string; razon: string }[];
};

/**
 * Lo que el Workbench todavía no hace, cada cosa con su razón escrita.
 *
 * Se muestran en pantalla. Un instrumento que calla lo que no puede hacer
 * obliga a quien lo usa a descubrirlo el día que lo necesita.
 */
export const AUSENTES: { titulo: string; razon: string }[] = [
  {
    titulo: "Tiempo detenido",
    razon:
      "Los rastreadores reportan las veinticuatro horas: a las 3 de la mañana, 2 924 de 2 930 puntos están en velocidad cero. Un tiempo detenido sobre un rango cualquiera mediría sobre todo el estacionamiento nocturno. Vuelve cuando se pueda separar «detenido en operación» de «estacionado fuera de turno».",
  },
  {
    titulo: "Conteo de paradas",
    razon:
      "Las paradas se dibujan con su lugar y su duración, que es lo que las hace interpretables: una de ocho horas en el patio se lee como lo que es. Colapsarlas a «12 paradas» pierde justo el lugar y la hora, y deja un número que parece medida.",
  },
  {
    titulo: "Exportar con evidencia",
    razon:
      "Decisión legal pendiente, no de diseño: qué hace verificable a un documento que sirve en una disputa, si lleva firma, y qué pasa si las dos partes exportan versiones distintas del mismo servicio. Un botón sin destino es peor que ningún botón.",
  },
  {
    titulo: "Reproducción del recorrido",
    razon:
      "Ver la traza avanzar en el tiempo con play. Es cara de construir bien y la traza quieta con sus paradas contesta casi todo. Anotada para después, no descartada.",
  },
  {
    titulo: "Consultas propias",
    razon:
      "Que el transportista arme sus propias preguntas sobre el lienzo. La barra de composición está hecha para que eso sea agregar un campo, no rehacer la pantalla; hoy son dos campos.",
  },
  {
    titulo: "Herramientas de medición sobre el mapa",
    razon: "Medir a mano la distancia entre dos puntos del lienzo. No entra en la v1.",
  },
];

/**
 * Un instante, con FECHA COMPLETA y en el reloj de la operación.
 *
 * En contexto de evidencia la hora nunca va sola: un turno nocturno cruza la
 * medianoche, y "05:40" sin fecha no sostiene un caso.
 */
function instante(d: Date): string {
  return `${localDateIso(d, JTTEL_TZ)} ${localTimeHHMM(d, JTTEL_TZ)}`;
}

/** Una duración se escribe como duración, jamás con formato de hora. */
function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function fechaValida(raw: string | undefined): string | null {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * Instante de inicio y fin de un rango de fechas civiles.
 *
 * `instanteZonificado` y no `new Date("...T00:00:00")`: la segunda forma resuelve
 * en el reloj del proceso, que en el servidor es UTC. Un turno de las 05:00 en
 * Juárez caería del día anterior, y la pantalla enseñaría la traza equivocada
 * sin que nada se vea roto.
 */
function ventanaDeRango(desdeIso: string, hastaIso: string): { desde: Date; hasta: Date } {
  return {
    desde: instanteZonificado(desdeIso, 0, JTTEL_TZ),
    hasta: new Date(instanteZonificado(hastaIso, 1440, JTTEL_TZ).getTime() - 1),
  };
}

function diasEntre(desdeIso: string, hastaIso: string): number {
  const a = Date.parse(`${desdeIso}T00:00:00Z`);
  const b = Date.parse(`${hastaIso}T00:00:00Z`);
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function sumar(dias: number, iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

export type ParametrosWorkbench = {
  unidades: string[];
  desde?: string;
  hasta?: string;
  servicio?: string;
  paradaMinutos?: number;
};

/** Lee la composición de la URL. Todo lo inválido cae al valor por omisión. */
export function leerParametros(
  sp: Record<string, string | string[] | undefined> | undefined,
  hoyIso: string,
): ParametrosWorkbench {
  const lista = (v: string | string[] | undefined): string[] =>
    Array.isArray(v) ? v : typeof v === "string" && v.length > 0 ? [v] : [];
  const uno = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

  const desde = fechaValida(uno(sp?.desde)) ?? hoyIso;
  const hastaBruto = fechaValida(uno(sp?.hasta)) ?? desde;
  const hasta = hastaBruto < desde ? desde : hastaBruto;
  const paradaBruta = Number(uno(sp?.parada));

  return {
    unidades: lista(sp?.unidad).slice(0, MAX_UNIDADES),
    desde,
    hasta,
    servicio: uno(sp?.servicio),
    paradaMinutos:
      Number.isFinite(paradaBruta) && paradaBruta >= 1 && paradaBruta <= 240
        ? Math.round(paradaBruta)
        : PARADA_MINUTOS_POR_DEFECTO,
  };
}

export async function loadWorkbench(
  carrier: { id: string; name: string },
  sp: Record<string, string | string[] | undefined> | undefined,
  opts: { ahora?: Date } = {},
): Promise<WorkbenchData> {
  const repos = getRepos();
  const ahora = opts.ahora ?? new Date();
  const hoyIso = localDateIso(ahora, JTTEL_TZ);
  const p = leerParametros(sp, hoyIso);
  const limites: string[] = [];

  let desdeIso = p.desde!;
  let hastaIso = p.hasta!;
  let unidadesPedidas = p.unidades;
  let modo: WorkbenchData["modo"] = unidadesPedidas.length > 0 ? "rango" : "vacio";

  // ── Puerta 1: se entró desde un servicio ─────────────────────────────────
  //
  // El servicio manda sobre el campo "Cuándo": pone la fecha, y más abajo la
  // ventana congelada del viaje. Sobre "Quién" manda solo si el árbitro
  // acreditó una unidad. Si NO acreditó ninguna —que es el caso de todo
  // `no_cumplido`, por diseño del motor— el campo se queda vacío a propósito:
  // el transportista elige a quién enseñar. Rellenarlo sería inventar
  // justamente la evidencia que él viene a aportar.
  if (p.servicio) {
    const fecha = await repos.occurrences.serviceDateForCarrier(p.servicio, carrier.id);
    if (fecha) {
      desdeIso = fecha;
      hastaIso = fecha;
      modo = "servicio";
    }
  }

  if (diasEntre(desdeIso, hastaIso) > MAX_DIAS) {
    hastaIso = sumar(MAX_DIAS - 1, desdeIso);
    limites.push(
      `El rango se acotó a ${MAX_DIAS} días desde ${desdeIso}: más allá de eso la composición pasa de cien mil puntos y la pantalla deja de abrir.`,
    );
  }
  if (p.unidades.length >= MAX_UNIDADES) {
    limites.push(
      `El lienzo acepta ${MAX_UNIDADES} unidades a la vez. Medido: 3 unidades por 30 días son 124 396 puntos y 2.4 s.`,
    );
  }

  const dias = diasEntre(desdeIso, hastaIso);
  const rango = ventanaDeRango(desdeIso, hastaIso);

  const [flota, conteoPuntos, { ocurrencias, contratosDePruebaExcluidos }] = await Promise.all([
    repos.fleet.getUnitsForCarrier(carrier.id),
    repos.telemetry.countPointsPerUnit(carrier.id, rango.desde, rango.hasta),
    repos.occurrences.findForCarrier(carrier.id, rango.desde, rango.hasta),
  ]);

  const activas = flota.filter((u) => u.active);
  const candidatas = activas
    .map((u) => ({
      id: u.id,
      label: u.label,
      plateNumber: u.plateNumber,
      puntos: conteoPuntos.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.puntos - a.puntos || a.label.localeCompare(b.label, "es"));

  const servicios = ocurrencias.map(mapearServicio);
  const servicioAbierto =
    modo === "servicio" ? (servicios.find((s) => s.ocurrenciaId === p.servicio) ?? null) : null;

  if (servicioAbierto?.unidadAcreditada && unidadesPedidas.length === 0) {
    unidadesPedidas = [servicioAbierto.unidadAcreditada.id];
  }

  const validas = new Set(activas.map((u) => u.id));
  const unidadIds = unidadesPedidas.filter((id) => validas.has(id));
  if (unidadIds.length > 0) modo = modo === "vacio" ? "rango" : modo;

  // ── La traza ─────────────────────────────────────────────────────────────
  const crudos =
    unidadIds.length > 0
      ? await repos.telemetry.getForUnitsWindow(carrier.id, unidadIds, rango.desde, rango.hasta)
      : [];

  const porUnidad = new Map<string, PuntoTraza[]>();
  for (const punto of crudos) {
    if (!punto.unitId) continue;
    const lista = porUnidad.get(punto.unitId);
    const p: PuntoTraza = {
      lat: punto.latitude,
      lng: punto.longitude,
      at: punto.recordedAt,
      speed: punto.speed,
    };
    if (lista) lista.push(p);
    else porUnidad.set(punto.unitId, [p]);
  }

  const puntosTotales = crudos.length;

  // La ley, aplicada: la ventana de un servicio va COMPLETA. La tolerancia no
  // es una preferencia que alguien pueda subir sin querer — en modo servicio
  // vale cero por construcción.
  const tolerancia = modo === "servicio" ? 0 : toleranciaParaTraza(puntosTotales);

  const unidades: UnidadTraza[] = unidadIds.map((id, i) => {
    const suyos = porUnidad.get(id) ?? [];
    const u = activas.find((a) => a.id === id)!;
    const tramos = partirEnHuecos(suyos, SIN_SENAL_MINUTOS).map((t) =>
      simplificarTraza(
        t.map((s) => ({ lat: s.lat, lng: s.lng })),
        tolerancia,
      ),
    );
    const dibujados = tramos.reduce((n, t) => n + t.length, 0);
    const { km, saltosDescartados } = kilometros(suyos);
    const ventana = servicioAbierto?.ventana ?? null;
    // Los puntos de la ventana se sacan UNA vez y sirven para las tres cosas:
    // dibujar el tramo, medir sus kilómetros y contar sus huecos. Medir la
    // ventana con los números del día entero sería el eje del ALCANCE de §D —
    // el número correcto contestando otra pregunta.
    const enVentana = ventana
      ? suyos.filter((s) => s.at >= ventana.desde && s.at <= ventana.hasta)
      : null;
    const tramosVentana = enVentana
      ? partirEnHuecos(enVentana, SIN_SENAL_MINUTOS).map((t) =>
          simplificarTraza(
            t.map((s) => ({ lat: s.lat, lng: s.lng })),
            tolerancia,
          ),
        )
      : null;
    return {
      kmVentana: enVentana ? kilometros(enVentana).km : null,
      puntosVentana: enVentana?.length ?? null,
      huecosVentana: enVentana ? huecosDeSenal(enVentana, SIN_SENAL_MINUTOS) : null,
      unitId: id,
      label: u.label,
      plateNumber: u.plateNumber,
      // De dos en dos, no de uno en uno. La paleta está ordenada para catorce
      // rutas encimadas, así que sus vecinos inmediatos son parientes: con dos
      // unidades, los índices 0 y 1 dan dos azules claros que se confunden a
      // simple vista. Saltando uno, seis unidades usan toda la banda.
      colorIndex: i * 2,
      tramos,
      tramosVentana,
      puntosTotales: suyos.length,
      puntosDibujados: dibujados,
      km,
      saltosDescartados,
      huecos: huecosDeSenal(suyos, SIN_SENAL_MINUTOS).map((h) => ({
        lat: h.lat,
        lng: h.lng,
        latFin: h.latFin,
        lngFin: h.lngFin,
        minutos: h.minutos,
        etiqueta: `${u.label} · sin señal ${duracion(h.minutos)} · de ${instante(h.desde)} a ${instante(h.hasta)}`,
      })),
      paradas: paradas(suyos, {
        minMinutos: p.paradaMinutos!,
        umbralHuecoMinutos: SIN_SENAL_MINUTOS,
      }).map((x) => ({
        lat: x.lat,
        lng: x.lng,
        minutos: x.minutos,
        etiqueta: `${u.label} · quieta ${duracion(x.minutos)} · de ${instante(x.desde)} a ${instante(x.hasta)}`,
      })),
      primerDato: suyos[0] ? instante(suyos[0].at) : null,
      ultimoDato: suyos.at(-1) ? instante(suyos.at(-1)!.at) : null,
    };
  });

  const puntosDibujados = unidades.reduce((s, u) => s + u.puntosDibujados, 0);

  // ── El territorio: trazado contratado y geocercas ────────────────────────
  //
  // Una vez por ruta, no una por servicio: treinta días del mismo turno
  // dibujarían la misma línea treinta veces encimada.
  const rutasVistas = new Map<string, { nombre: string; at: Date }>();
  const geocercas = new Map<string, { id: string; nombre: string; poligono: LatLng[] }>();
  for (const o of ocurrencias) {
    // Con un servicio abierto se dibuja SU trazado y nada más. Un día de esta
    // operación son 48 servicios sobre decenas de rutas: dibujarlas todas
    // encima de la traza que se está defendiendo no es un mapa, es una maraña,
    // y el problema no se arregla dibujando mejor sino no dibujando lo que
    // nadie preguntó.
    if (servicioAbierto && o.id !== servicioAbierto.ocurrenciaId) continue;
    const routeId = o.profile?.routeShift?.routeId;
    if (routeId && !rutasVistas.has(routeId)) {
      rutasVistas.set(routeId, {
        nombre: o.profile?.routeShift?.route?.name ?? "Trazado contratado",
        at: o.expectedDeadline,
      });
    }
    const g = o.profile?.geofence;
    if (g && Array.isArray(g.polygon) && g.polygon.length >= 3 && !geocercas.has(g.id)) {
      geocercas.set(g.id, { id: g.id, nombre: g.name, poligono: g.polygon as LatLng[] });
    }
  }

  const contratado: WorkbenchData["contratado"] = [];
  for (const [routeId, r] of rutasVistas) {
    const version = await repos.routes.getKmlVersionForDate(routeId, r.at);
    const puntos = (version?.waypoints ?? []) as LatLng[];
    if (puntos.length >= 2) contratado.push({ routeId, nombre: r.nombre, puntos });
  }

  // ── Las medidas ──────────────────────────────────────────────────────────
  const kmTotal = unidades.reduce((s, u) => s + u.km, 0);
  const saltos = unidades.reduce((s, u) => s + u.saltosDescartados, 0);
  const totalHuecos = unidades.reduce((s, u) => s + u.huecos.length, 0);
  const minutosSinSenal = unidades.reduce(
    (s, u) => s + u.huecos.reduce((h, x) => h + x.minutos, 0),
    0,
  );

  // ── El panel mide lo que se está mirando ─────────────────────────────────
  //
  // Con un servicio abierto, la pregunta es sobre SU ventana. Contestarla con
  // los kilómetros del día entero sería el eje del ALCANCE de §D: el número
  // correcto respondiendo otra cosa. Un servicio de dos horas con "107.1 km"
  // al lado se lee como los kilómetros de ese servicio, y no lo son.
  const enVentana = modo === "servicio" && unidades.some((u) => u.kmVentana !== null);
  const kmVentana = unidades.reduce((s, u) => s + (u.kmVentana ?? 0), 0);
  const huecosVentana = unidades.reduce((s, u) => s + (u.huecosVentana?.length ?? 0), 0);
  const minutosVentana = unidades.reduce(
    (s, u) => s + (u.huecosVentana ?? []).reduce((h, x) => h + x.minutos, 0),
    0,
  );
  const puntosEnVentana = unidades.reduce((s, u) => s + (u.puntosVentana ?? 0), 0);

  const medidas: WorkbenchData["medidas"] = [
    {
      etiqueta: enVentana ? "Recorrido en la ventana" : "Recorrido total",
      valor: `${(enVentana ? kmVentana : kmTotal).toFixed(1)} km`,
      lectura: [
        "aproximado",
        saltos > 0
          ? `${saltos} ${saltos === 1 ? "tramo descartado" : "tramos descartados"} por salto del equipo`
          : "sin saltos descartados",
        enVentana ? `el día completo: ${kmTotal.toFixed(1)} km` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      etiqueta: enVentana ? "Huecos en la ventana" : "Huecos de señal",
      valor: String(enVentana ? huecosVentana : totalHuecos),
      lectura: [
        (enVentana ? huecosVentana : totalHuecos) > 0
          ? `${enVentana ? minutosVentana : minutosSinSenal} min sin ver`
          : "ninguno",
        `umbral ${SIN_SENAL_MINUTOS} min`,
        enVentana ? `el día completo: ${totalHuecos}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      etiqueta: "Servicios del rango",
      valor: String(servicios.length),
      // Cero servicios no es "cero sin sellar": es que nadie contrató nada
      // esos días. Son dos vacíos distintos y decirlo igual los confunde.
      lectura:
        servicios.length === 0
          ? "ningún servicio contratado en estas fechas"
          : `${servicios.filter((s) => s.resultado === "sin_sellar").length} todavía sin sellar`,
    },
    {
      etiqueta: enVentana ? "Puntos en la ventana" : "Puntos observados",
      valor: (enVentana ? puntosEnVentana : puntosTotales).toLocaleString("es-MX"),
      lectura: enVentana
        ? `cadencia real: un punto por minuto · el día completo: ${puntosTotales.toLocaleString("es-MX")}`
        : "cadencia real: un punto por minuto",
    },
  ];

  // El ALCANCE es lo que el rango no incluye, no un resumen de lo que sí.
  // Repetir días y servicios aquí, que ya van en el subtítulo, deja un
  // encabezado que se lee dos veces y no dice nada la segunda.
  const alcance =
    contratosDePruebaExcluidos > 0
      ? `${contratosDePruebaExcluidos} ${contratosDePruebaExcluidos === 1 ? "contrato de prueba excluido" : "contratos de prueba excluidos"}`
      : "";

  const etiquetas = unidades.map((u) => u.label);
  const titular =
    modo === "servicio" && servicioAbierto
      ? `${servicioAbierto.ruta}, ${servicioAbierto.fecha}.`
      : etiquetas.length === 0
        ? "Elige una unidad y un rango."
        : etiquetas.length === 1
          ? `${etiquetas[0]}, ${textoRango(desdeIso, hastaIso)}.`
          : `${etiquetas.length} unidades, ${textoRango(desdeIso, hastaIso)}.`;

  const cuentaServicios =
    servicios.length === 0
      ? "sin servicios contratados en el rango"
      : `${servicios.length} ${servicios.length === 1 ? "servicio" : "servicios"}`;

  const subtitulo =
    unidades.length === 0
      ? `${cuentaServicios} · sin traza cargada`
      : `${dias} ${dias === 1 ? "día" : "días"} · ${cuentaServicios} · ${kmTotal.toFixed(1)} km`;

  return {
    modo,
    titular,
    subtitulo,
    alcance,
    rango: { desde: desdeIso, hasta: hastaIso, dias },
    simplificacion: {
      activa: tolerancia > 0,
      toleranciaMetros: tolerancia,
      puntosTotales,
      puntosDibujados,
      declaracion:
        tolerancia > 0
          ? `Traza simplificada para explorar · abre un servicio para verla completa`
          : modo === "servicio"
            ? `Ventana de un servicio: traza completa, punto por punto`
            : `Traza completa, punto por punto`,
    },
    unidades,
    candidatas,
    contratado,
    geocercas: [...geocercas.values()],
    servicios,
    servicioAbierto,
    medidas,
    paradaUmbralMinutos: p.paradaMinutos!,
    limites,
    ausentes: AUSENTES,
  };
}

function textoRango(desde: string, hasta: string): string {
  return desde === hasta ? desde : `${desde} — ${hasta}`;
}

type OcurrenciaConRelaciones = Awaited<
  ReturnType<ReturnType<typeof getRepos>["occurrences"]["findForCarrier"]>
>["ocurrencias"][number];

function mapearServicio(o: OcurrenciaConRelaciones): ServicioEnRango {
  const hecho = o.complianceFact;
  const resultado: ResultadoServicio = !hecho
    ? "sin_sellar"
    : hecho.status === "cumplido"
      ? "cumplido"
      : hecho.status === "no_cumplido"
        ? "no_cumplido"
        : // `pendiente_evidencia` en el motor; «pendiente por evidencia» en
          // pantalla. Sin evidencia NO es incumplimiento (ley 7).
          "pendiente";

  return {
    ocurrenciaId: o.id,
    fecha: o.serviceDate,
    ruta: o.profile?.routeShift?.route?.name ?? o.profile?.name ?? "—",
    turno: o.profile?.routeShift?.shift?.name ?? "—",
    cliente: o.contract?.client?.name ?? "—",
    resultado,
    // Solo se nombra la unidad cuando el árbitro la acreditó. Un `no_cumplido`
    // no tiene ninguna, y ponerle una sería inventar evidencia.
    unidadAcreditada: hecho?.observedUnit
      ? { id: hecho.observedUnit.id, label: hecho.observedUnit.label }
      : null,
    cierre: `${localDateIso(o.expectedDeadline, JTTEL_TZ)} ${localTimeHHMM(o.expectedDeadline, JTTEL_TZ)}`,
    ventana: o.trip
      ? { desde: o.trip.evidenceWindowStart, hasta: o.trip.evidenceWindowEnd }
      : null,
  };
}
