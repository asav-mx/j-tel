import {
  estaQuemado,
  quemar,
  verificarBoleto,
  MEMORIA_VACIA,
  type MemoriaDeQuemados,
  type Presentacion,
  type Rechazo,
} from "./boleto.js";

/**
 * Las reglas del lector del camión — Ontoy 3.0 · PR P3
 * (`docs/Ficha-Construccion-Ontoy-3-Pagos.md`).
 *
 * Todo aquí es puro: el aparato decide **sin red, sin base de datos y sin
 * preguntarle a nadie**. La pantalla vive en `apps/publico/src/app/validador`;
 * lo que se puede afirmar vive aquí, para que se pueda probar sin una cámara.
 *
 * ## Las dos vías, y por qué no valen lo mismo
 *
 * **El QR prueba.** Trae la firma de J-Tel sobre el boleto y la firma del
 * portador sobre la ventana de tiempo: el lector comprueba las dos con la llave
 * pública que carga de antes.
 *
 * **El código dictado no prueba nada.** El pasajero dice ocho dígitos en voz
 * alta y el chofer los teclea: ahí no hay firma que comprobar, ni ventana que
 * caduque, ni nada que distinga a quien compró su viaje de quien vio el folio
 * en la pantalla de otro. Lo único que el lector puede hacer es **registrar un
 * reclamo** —alguien dijo traer el folio X— y dejarlo marcado para que se
 * distinga al conciliar.
 *
 * Por eso la vía dictada va acotada por tres lados (Asav, 23-sep-2026, opción
 * B): sólo **cuando la cámara no pudo**, con **su propio tope** por lector y
 * por día, y **marcada** en el registro. No se cierra del todo porque castigar
 * a un pasajero por una cámara sucia no es suyo el error.
 *
 * ## El tope sin señal es una decisión con número
 *
 * Entre sincronizaciones ningún lector sabe del otro, así que
 * {@link TOPE_SIN_SENAL} es, exactamente, **cuántos boletos podrían pasar en
 * dos camiones distintos antes de que alguien lo note**. Bajarlo cierra esa
 * ventana y deja gente abajo en un tramo largo sin señal; subirlo hace lo
 * contrario. Asav eligió 20 para el laboratorio el 23-sep-2026.
 */

/** Cuántas validaciones sin señal acepta un lector en un día. */
export const TOPE_SIN_SENAL = 20;

/**
 * Cuántos códigos dictados acepta un lector en un día.
 *
 * Asav fijó que la vía dictada lleva tope; **el número lo puse yo** en lo que
 * la operación de verdad dice cuántas cámaras fallan al día. Es una salida de
 * excepción: si se gasta seguido, el problema es la cámara, no el tope.
 */
export const TOPE_CODIGO_DICTADO = 5;

/**
 * Cuánto tiene que llevar el lector intentando con la cámara antes de ofrecer
 * la vía dictada.
 *
 * «Sólo cuando la cámara no pudo» necesita un momento en que eso sea cierto, y
 * éste es el número que lo define: quince segundos mirando un código sin poder
 * leerlo. Menos, y el chofer se acostumbra a teclear —que es abrir el hueco de
 * par en par—; más, y la fila se detiene por una cámara sucia. Si la cámara ni
 * siquiera encendió, la vía se abre de inmediato: ahí no hay nada que esperar.
 */
export const SEGUNDOS_ANTES_DE_DICTAR = 15;

export type ViaDelPaso = "qr" | "codigo_dictado";

/** Un paso aceptado, tal como queda en el aparato. No se borra. */
export interface RegistroDePaso {
  readonly folio: string;
  readonly cuando: number;
  readonly via: ViaDelPaso;
  /** Si el lector tenía señal cuando lo aceptó. */
  readonly conSenal: boolean;
}

/** Lo que un lector sabe de su propio día. */
export interface JornadaDelLector {
  readonly aparato: string;
  /** La fecha local del lector. Al cambiar, la jornada se reinicia. */
  readonly dia: string;
  readonly quemados: MemoriaDeQuemados;
  readonly pasos: readonly RegistroDePaso[];
}

export const jornadaNueva = (aparato: string, dia: string): JornadaDelLector => ({
  aparato,
  dia,
  quemados: MEMORIA_VACIA,
  pasos: [],
});

export const validadosHoy = (j: JornadaDelLector): number => j.pasos.length;

/** Los aceptados sin señal: los que todavía nadie fuera de este aparato conoce. */
export const sinSenalAceptados = (j: JornadaDelLector): number =>
  j.pasos.filter((p) => !p.conSenal).length;

export const codigosDictados = (j: JornadaDelLector): number =>
  j.pasos.filter((p) => p.via === "codigo_dictado").length;

/**
 * Lo que falta por contarle a J-Tel. Con señal se sube en el momento; sin ella
 * se acumula, y es justo lo que el tope limita.
 */
export const porSincronizar = (j: JornadaDelLector): number => sinSenalAceptados(j);

export type MotivoDelLector =
  | Rechazo
  | "no_se_pudo_leer"
  | "tope_sin_senal"
  | "tope_de_codigo_dictado"
  | "la_camara_si_podia";

export type ResultadoDelLector =
  | { readonly pasa: true; readonly folio: string; readonly via: ViaDelPaso; readonly conSenal: boolean }
  | { readonly pasa: false; readonly motivo: MotivoDelLector };

export interface Lectura {
  readonly resultado: ResultadoDelLector;
  readonly jornada: JornadaDelLector;
}

function aceptar(
  jornada: JornadaDelLector,
  folio: string,
  via: ViaDelPaso,
  conSenal: boolean,
  ahora: number,
): Lectura {
  return {
    resultado: { pasa: true, folio, via, conSenal },
    jornada: {
      ...jornada,
      quemados: quemar(jornada.quemados, folio, ahora),
      pasos: [...jornada.pasos, { folio, cuando: ahora, via, conSenal }],
    },
  };
}

const rechazar = (jornada: JornadaDelLector, motivo: MotivoDelLector): Lectura => ({
  resultado: { pasa: false, motivo },
  jornada,
});

/**
 * La vía buena: un QR leído y desempacado.
 *
 * El tope sin señal se mira **antes** de quemar nada: un lector que ya no puede
 * responder por lo que acepta no debe aceptar. Pero se mira **después** de la
 * criptografía, para que un boleto falso no se lleve la explicación del tope.
 */
export function validarPresentacion(
  presentacion: Presentacion,
  contexto: {
    jornada: JornadaDelLector;
    llavePublicaDeJTel: Uint8Array;
    ahora: number;
    haySenal: boolean;
  },
): Lectura {
  const { jornada, ahora, haySenal } = contexto;
  const veredicto = verificarBoleto(presentacion, {
    llavePublicaDeJTel: contexto.llavePublicaDeJTel,
    ahora,
    quemados: jornada.quemados,
  });
  if (!veredicto.pasa) return rechazar(jornada, veredicto.motivo);
  if (!haySenal && sinSenalAceptados(jornada) >= TOPE_SIN_SENAL) {
    return rechazar(jornada, "tope_sin_senal");
  }
  return aceptar(jornada, veredicto.folio, "qr", haySenal, ahora);
}

/**
 * La vía de excepción: ocho dígitos dictados.
 *
 * **Esto no verifica nada** —no hay firma que comprobar— y el código lo dice
 * para que nadie lo lea como si verificara. Lo único que se comprueba es que el
 * folio no esté quemado en este aparato, que la cámara de verdad haya fallado,
 * y que queden intentos del día.
 */
export function validarCodigoDictado(
  folio: string,
  contexto: {
    jornada: JornadaDelLector;
    ahora: number;
    haySenal: boolean;
    /** El lector sólo abre esta vía después de no poder leer con la cámara. */
    laCamaraFallo: boolean;
  },
): Lectura {
  const { jornada, ahora, haySenal, laCamaraFallo } = contexto;
  if (!laCamaraFallo) return rechazar(jornada, "la_camara_si_podia");
  if (codigosDictados(jornada) >= TOPE_CODIGO_DICTADO) {
    return rechazar(jornada, "tope_de_codigo_dictado");
  }
  if (estaQuemado(jornada.quemados, folio)) {
    return rechazar(jornada, "ya_quemado_en_este_aparato");
  }
  if (!haySenal && sinSenalAceptados(jornada) >= TOPE_SIN_SENAL) {
    return rechazar(jornada, "tope_sin_senal");
  }
  return aceptar(jornada, folio, "codigo_dictado", haySenal, ahora);
}

/** Qué le dice el aparato al chofer. Corto: hay una fila detrás. */
export const PALABRAS_DEL_MOTIVO: Record<MotivoDelLector, string> = {
  cuerpo_mal_formado: "Ese código no es de un boleto",
  firma_no_es_de_jtel: "Boleto falso: no lo hizo J-Tel",
  aun_no_vigente: "Todavía no empieza a valer",
  vencido: "Boleto vencido",
  codigo_fuera_de_ventana: "Código vencido: pide que lo vuelva a mostrar",
  prueba_no_es_del_portador: "Ese código no es de este teléfono",
  ya_quemado_en_este_aparato: "Ya se usó hoy",
  no_se_pudo_leer: "No se pudo leer",
  tope_sin_senal: "Sin señal y con el día lleno: cobra en efectivo",
  tope_de_codigo_dictado: "Ya no quedan códigos dictados hoy",
  la_camara_si_podia: "Primero intenta con la cámara",
};
