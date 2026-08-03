/**
 * Evaluación de salud de la plataforma — función pura.
 *
 * La lee un vigilante que corre FUERA de Vercel y fuera de esta base. Ese es
 * todo el punto: el 2026-07-28 una rotación de contraseña dejó los crones sin
 * acceso durante 13 horas y nadie se enteró, porque el heartbeat que vigila es
 * también un cron de Vercel y cayó con lo demás. Un vigilante no puede
 * compartir runtime, base ni credenciales con lo vigilado.
 *
 * Aquí solo vive el juicio. Reunir los datos es trabajo de la ruta, y así el
 * juicio se prueba sin base de datos.
 */

export type UmbralesSalud = {
  /** Antigüedad máxima del dato de GPS antes de considerarlo enfermo. */
  gpsMaxMinutos: number;
  /**
   * Silencio máximo del archivador antes de considerarlo enfermo.
   *
   * El cron corre cada 10 min, así que 30 tolera dos corridas perdidas sin
   * gritar. Es deliberado: una alerta que salta por un hipo de red enseña a
   * ignorar el canal.
   */
  archivadorMaxMinutos: number;
};

export const UMBRALES_SALUD: UmbralesSalud = {
  gpsMaxMinutos: 20,
  archivadorMaxMinutos: 30,
};

/**
 * Horas que puede llevar un servicio vencido SIN NINGÚN hecho antes de que esto
 * sea una falla de plataforma.
 *
 * El camino sano escribe el primer hecho en menos de 5 minutos (785 de 926
 * medidos el 2026-08-03), y la caída más larga del cron que no fue de
 * credenciales duró 101 minutos. 2 h la despeja con margen y sigue siendo ~120×
 * el camino normal.
 *
 * NO confundir con el umbral de pendientes estancados (48 h): un pendiente por
 * evidencia SÍ tiene hecho. Aquí se cuenta lo que no tiene ninguno, que es
 * siempre una verificación que reventó.
 */
export const HORAS_FALLO_MUDO = 2;

export type MarcaDeAgua = {
  /** Instante del dato de GPS más nuevo ya archivado. */
  lastRecordedAt: Date;
  /** Última vez que el archivador escribió algo. */
  updatedAt: Date;
};

export type MuestraSalud = {
  ahora: Date;
  /** Marcas de agua de los carriers REALES; las cuentas demo no se vigilan. */
  marcas: MarcaDeAgua[];
  /** Carriers reales que existen, tengan marca o no. */
  carriersEsperados: number;
  alertasCriticasAbiertas: number;
  /** La crítica abierta más antigua, para poder decir desde cuándo. */
  alertaCriticaMasAntigua: Date | null;
  /**
   * Servicios vencidos hace más de `HORAS_FALLO_MUDO` SIN ningún hecho.
   *
   * Opcional para no romper a quien ya llamaba a `evaluarSalud`, pero cuando
   * falta el chequeo se declara ausente en vez de darse por bueno: un
   * vigilante que calla lo que no midió es exactamente el que dejó pasar 35
   * días de silencio.
   */
  verificacion?: { fallosMudos: number; masAntiguoHoras: number | null };
};

export type EstadoSalud = "sano" | "enfermo";

export type Chequeo = {
  id: "gps" | "archivador" | "marcas" | "alertas" | "verificacion";
  estado: EstadoSalud;
  /** Frase lista para leer: la medición SIEMPRE junto a su umbral. */
  lectura: string;
  minutos: number | null;
  umbralMinutos: number | null;
};

export type ResultadoSalud = {
  estado: EstadoSalud;
  chequeos: Chequeo[];
};

const minutosDesde = (ahora: Date, antes: Date) =>
  (ahora.getTime() - antes.getTime()) / 60_000;

/** Redondeo a un decimal: exactitud, no "~". */
const un = (n: number) => Number(n.toFixed(1));

function texto(minutos: number): string {
  if (minutos < 90) return `hace ${un(minutos)} min`;
  return `hace ${un(minutos / 60)} h`;
}

/**
 * Sano solo si TODOS los chequeos están sanos. Sin estados intermedios: el
 * vigilante externo necesita una respuesta binaria para decidir si grita.
 */
export function evaluarSalud(
  muestra: MuestraSalud,
  umbrales: UmbralesSalud = UMBRALES_SALUD,
): ResultadoSalud {
  const chequeos: Chequeo[] = [];

  // Sin marcas de agua no hay nada que comparar, y eso ya es una anomalía:
  // significa que el archivador nunca escribió para algún carrier real.
  if (muestra.marcas.length < muestra.carriersEsperados) {
    chequeos.push({
      id: "marcas",
      estado: "enfermo",
      lectura: `${muestra.marcas.length} de ${muestra.carriersEsperados} carriers con marca de agua · faltan ${muestra.carriersEsperados - muestra.marcas.length}`,
      minutos: null,
      umbralMinutos: null,
    });
  } else {
    chequeos.push({
      id: "marcas",
      estado: "sano",
      lectura: `${muestra.marcas.length} de ${muestra.carriersEsperados} carriers con marca de agua`,
      minutos: null,
      umbralMinutos: null,
    });
  }

  if (muestra.marcas.length > 0) {
    // Se reporta el PEOR carrier: uno atorado es un problema aunque los demás
    // vayan bien, y un promedio lo escondería.
    const gps = Math.max(
      ...muestra.marcas.map((m) => minutosDesde(muestra.ahora, m.lastRecordedAt)),
    );
    chequeos.push({
      id: "gps",
      estado: gps > umbrales.gpsMaxMinutos ? "enfermo" : "sano",
      lectura: `dato de GPS más nuevo ${texto(gps)} · umbral ${umbrales.gpsMaxMinutos} min`,
      minutos: un(gps),
      umbralMinutos: umbrales.gpsMaxMinutos,
    });

    const archivador = Math.max(
      ...muestra.marcas.map((m) => minutosDesde(muestra.ahora, m.updatedAt)),
    );
    chequeos.push({
      id: "archivador",
      estado: archivador > umbrales.archivadorMaxMinutos ? "enfermo" : "sano",
      lectura: `archivador escribió ${texto(archivador)} · umbral ${umbrales.archivadorMaxMinutos} min`,
      minutos: un(archivador),
      umbralMinutos: umbrales.archivadorMaxMinutos,
    });
  }

  const n = muestra.alertasCriticasAbiertas;
  const desde =
    n > 0 && muestra.alertaCriticaMasAntigua
      ? ` · la más antigua ${texto(minutosDesde(muestra.ahora, muestra.alertaCriticaMasAntigua))}`
      : "";
  chequeos.push({
    id: "alertas",
    estado: n > 0 ? "enfermo" : "sano",
    lectura: n === 0 ? "sin alertas críticas abiertas" : `${n} alerta${n === 1 ? "" : "s"} crítica${n === 1 ? "" : "s"} abierta${n === 1 ? "" : "s"}${desde}`,
    minutos: null,
    umbralMinutos: null,
  });

  /*
   * EL CHEQUEO QUE FALTABA.
   *
   * Hasta hoy esta ruta vigilaba marcas de agua, GPS, archivador y alertas —
   * todo sobre la INGESTA— y ni una sola señal sobre si el árbitro llegó a
   * dictar. Por eso pudo responder "sano" durante 35 días mientras ocho
   * servicios de un cliente vivo no tenían veredicto: la telemetría entraba
   * puntual, y eso era lo único que se miraba.
   *
   * Un servicio sin señal SÍ escribe su hecho (`pendiente_evidencia`). Cero
   * hechos significa que la verificación reventó, y eso no tiene tolerancia:
   * basta uno para declarar enfermo.
   */
  if (muestra.verificacion) {
    const { fallosMudos, masAntiguoHoras } = muestra.verificacion;
    const desde =
      fallosMudos > 0 && masAntiguoHoras != null
        ? ` · el más viejo vencido hace ${un(masAntiguoHoras)} h`
        : "";
    chequeos.push({
      id: "verificacion",
      estado: fallosMudos > 0 ? "enfermo" : "sano",
      lectura:
        fallosMudos === 0
          ? `sin servicios vencidos sin veredicto · umbral ${HORAS_FALLO_MUDO} h`
          : `${fallosMudos} servicio${fallosMudos === 1 ? "" : "s"} vencido${fallosMudos === 1 ? "" : "s"} hace más de ${HORAS_FALLO_MUDO} h SIN veredicto${desde}`,
      minutos: null,
      umbralMinutos: HORAS_FALLO_MUDO * 60,
    });
  } else {
    // La ausencia se declara. Un chequeo que no corrió no es un chequeo sano.
    chequeos.push({
      id: "verificacion",
      estado: "enfermo",
      lectura: "no se pudo contar los servicios vencidos sin veredicto",
      minutos: null,
      umbralMinutos: HORAS_FALLO_MUDO * 60,
    });
  }

  return {
    estado: chequeos.some((c) => c.estado === "enfermo") ? "enfermo" : "sano",
    chequeos,
  };
}

/**
 * Las dos señales se separan a propósito, y su combinación es el diagnóstico.
 *
 * GPS viejo + archivador escribiendo = se está poniendo al día tras una caída.
 * GPS viejo + archivador callado    = sigue caído.
 * GPS fresco                        = sano, sin importar lo demás.
 *
 * Confundirlas fue lo que hizo dudar del diagnóstico el 2026-07-28.
 */
export function diagnostico(r: ResultadoSalud): string {
  // El motor manda sobre la ingesta: que la telemetría entre puntual no
  // consuela si nadie está dictando veredictos con ella.
  const ver = r.chequeos.find((c) => c.id === "verificacion");
  if (ver?.estado === "enfermo") return ver.lectura;

  const gps = r.chequeos.find((c) => c.id === "gps");
  const arch = r.chequeos.find((c) => c.id === "archivador");
  if (!gps || !arch) return "sin marcas de agua que evaluar";
  if (gps.estado === "sano") return "ingesta al día";
  if (arch.estado === "sano") return "dato atrasado, pero el archivador está escribiendo: poniéndose al día";
  return "dato atrasado y el archivador callado: la ingesta está detenida";
}
