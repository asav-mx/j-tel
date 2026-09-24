import {
  palabrasDeLaFlota,
  veredictoDeLaFlota,
  type UnidadEsperada,
} from "@jtel/domain/vigilante";

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
  /**
   * Las unidades de las que el producto espera oír algo (#470).
   *
   * Opcional para no romper a quien ya llamaba a `evaluarSalud`, pero **cuando
   * falta, el chequeo se declara `no_medido`** en vez de darse por bueno. Un
   * vigilante que calla lo que no midió es el que dejó pasar 35 días.
   */
  flota?: readonly UnidadEsperada[];
};

/**
 * El veredicto GLOBAL sigue siendo binario, y eso no se toca: el vigilante
 * externo necesita saber si grita o no, y lee el código de estado.
 */
export type EstadoSalud = "sano" | "enfermo";

/**
 * El estado de UN chequeo, que sí tiene un tercer valor.
 *
 * `no_medido` no es un matiz de "enfermo": es otra cosa. Enfermo es "lo miré y
 * está mal"; no medido es "no lo pude mirar". Sin este valor, las dos se
 * cuentan igual y quien lee un aviso no tiene cómo distinguir una violación de
 * una ceguera — lo único que las separaría son las palabras de la prosa, y la
 * prosa no es estado.
 *
 * Es el mismo tercer valor que el Marco ya le dio a los veredictos con
 * `pendiente por evidencia`, por la misma razón: para que la falta de evidencia
 * jamás se confunda con una falta.
 */
export type EstadoChequeo = EstadoSalud | "no_medido";

export type Chequeo = {
  id: "flota" | "archivador" | "marcas" | "alertas" | "verificacion";
  estado: EstadoChequeo;
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

  /*
   * **El chequeo de la flota reemplaza al de GPS** (#470, 23-sep-2026).
   *
   * El viejo tomaba el PEOR carrier —«uno atorado es un problema aunque los
   * demás vayan bien»— y con eso una flota estacionada declaraba enferma a la
   * plataforma: tres días de gritos y veinte comentarios en un issue por unos
   * camiones apagados en el patio. Y su frase decía «dato de GPS más nuevo
   * hace 68.7 h» cuando el dato más nuevo tenía 0.3 h: medía el peor carrier
   * y decía «el más nuevo». Número correcto, oración falsa.
   *
   * La pregunta correcta no es «¿hay dato?» sino **«¿calla alguien que
   * debería estar hablando?»**. La respuesta vive en `veredictoDeLaFlota`, que
   * es puro y se prueba sin base.
   */
  if (muestra.flota === undefined) {
    chequeos.push({
      id: "flota",
      estado: "no_medido",
      lectura: "no se pudo leer qué unidades deberían estar hablando",
      minutos: null,
      umbralMinutos: umbrales.gpsMaxMinutos,
    });
  } else {
    const v = veredictoDeLaFlota(muestra.flota, muestra.ahora, umbrales.gpsMaxMinutos);
    chequeos.push({
      id: "flota",
      estado: v.que === "calla" ? "enfermo" : "sano",
      lectura: `${palabrasDeLaFlota(v)} · umbral ${umbrales.gpsMaxMinutos} min`,
      /* La peor de las que callan; con la flota dormida no hay número que dar. */
      minutos:
        v.que === "calla"
          ? un(Math.max(...v.callan.map((u) => u.minutosSinHablar ?? Number.MAX_SAFE_INTEGER)))
          : null,
      umbralMinutos: umbrales.gpsMaxMinutos,
    });
  }

  if (muestra.marcas.length > 0) {
    /*
     * **El archivador es UN proceso, así que se mira la escritura más
     * reciente, no la más vieja.** Antes era `Math.max` de las antigüedades —el
     * peor carrier— y eso confundía dos preguntas: «¿el archivador está vivo?»
     * y «¿este carrier tiene dato?». Un carrier cuya flota duerme no le da al
     * archivador nada que escribir, y su marca se queda quieta aunque el
     * proceso esté corriendo cada diez minutos para los demás.
     *
     * La pregunta que este chequeo hace es la primera. La segunda ya la
     * contesta el chequeo de la flota, que es donde pertenece.
     */
    const archivador = Math.min(
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
    // La ausencia se declara, y se declara COMO ausencia. Un chequeo que no
    // corrió no es un chequeo sano —eso ya se sabía— pero tampoco es uno que
    // haya salido mal: es uno que no se pudo hacer, y así se dice.
    chequeos.push({
      id: "verificacion",
      estado: "no_medido",
      lectura: "no se pudo contar los servicios vencidos sin veredicto",
      minutos: null,
      umbralMinutos: HORAS_FALLO_MUDO * 60,
    });
  }

  return {
    /*
     * Sano solo si TODOS los chequeos salieron sanos — y "no medido" no lo es.
     * Que el estado global no distinga entre roto y ciego es deliberado: el
     * vigilante externo necesita una respuesta binaria para decidir si grita, y
     * ante la duda grita. El matiz viaja en el chequeo, para quien sí lo pinta.
     */
    estado: chequeos.some((c) => c.estado !== "sano") ? "enfermo" : "sano",
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
  // consuela si nadie está dictando veredictos con ella. Y no poder mirarlo
  // manda igual: un diagnóstico que calla lo que no midió es el que dejó pasar
  // 35 días de silencio.
  const ver = r.chequeos.find((c) => c.id === "verificacion");
  if (ver && ver.estado !== "sano") return ver.lectura;

  const flota = r.chequeos.find((c) => c.id === "flota");
  const arch = r.chequeos.find((c) => c.id === "archivador");
  if (!flota) return "no se pudo mirar la flota";
  /*
   * El diagnóstico **repite la lectura de la flota** en vez de resumirla. Ésa
   * ya nombra la unidad, su circuito y desde cuándo calla; cualquier resumen
   * que escribiera aquí sería una segunda frase que puede separarse de la
   * primera — y la que se separó fue «dato de GPS más nuevo hace 68.7 h» con
   * dato de hace 18 minutos (#470).
   */
  if (flota.estado !== "sano") return flota.lectura;
  if (arch && arch.estado !== "sano")
    return "las unidades en turno hablan, pero el archivador no escribe: lo que entra no se está guardando";
  return "las unidades en turno están al día";
}
