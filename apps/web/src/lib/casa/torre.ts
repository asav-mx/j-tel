import { proyectarSobreTrazado, type Sentido } from "@jtel/domain";
import type { EstadoGlifo } from "@/components/casa/glifo";
import type {
  EsperaDeParada,
  PromesaDeUnidad,
  Referencia,
  UnidadEnLaTorre,
} from "@jtel/services";

/**
 * La aritmética del radar — **toda la del cuarto, y ninguna medición.**
 *
 * Lo que se mide ya vive en `torre-del-circuito.ts` (Paso 1). Aquí sólo se
 * convierte lo medido en posiciones, porcentajes y palabras. Vive fuera de los
 * componentes por la razón de siempre: una cifra escrita dentro de un `.tsx` no
 * se puede probar sin montar la pantalla, y ésta es una cifra que el operador
 * va a leer a las seis de la mañana con el radio en la otra mano.
 *
 * ## El radar es un esquema, y dice de qué habla
 *
 * Las paradas se reparten **parejo** a lo largo del carril, como el plano de un
 * metro: pegarlas a su distancia real amontona las del centro hasta que sus
 * nombres se encinan, y un rótulo ilegible no informa de nada.
 *
 * Eso obliga a una regla, y es la que hace honesto el dibujo: **nada se coloca
 * por metros sobre el carril; todo se coloca por el TRAMO donde está y qué
 * parte lleva de él.** Una unidad que va al 30 % entre Zaragoza e Independencia
 * se dibuja al 30 % entre esas dos marcas — sea cual sea la distancia real
 * entre ellas. Lo que el dibujo afirma («va entre estas dos, más o menos por
 * aquí») es exactamente lo que la medición sostiene.
 *
 * Es además la misma forma en la que la capa entrega el ritmo prometido
 * (`entre` + `fraccionDelTramo`, 9.2e), así que el carril de arriba y la vía de
 * abajo hablan el mismo idioma en vez de dos.
 */

/** Dónde cae una parada a lo largo del trazado de su sentido, en metros. */
export interface AbscisaDeParada {
  stopId: string;
  nombre: string;
  avanceMetros: number;
}

/**
 * Las paradas de un sentido, ordenadas por dónde caen sobre el trazado.
 *
 * **Se ordenan por el trazado y no por su `orden` capturado**: el orden es lo
 * que alguien tecleó y el trazado es lo que existe; cuando no coinciden, el
 * dibujo tiene que seguir a la geometría o pondría una unidad «entre» dos
 * paradas que en la calle no son vecinas. Una parada que no cae sobre el
 * trazado se queda fuera: no hay tramo donde ponerla.
 */
export function abscisasDeParadas(
  paradas: Array<{ stopId: string; nombre: string; lat: number; lon: number; sentido: Sentido | null }>,
  trazado: Array<[number, number]> | null,
  sentido: Sentido,
): AbscisaDeParada[] {
  if (!trazado || trazado.length < 2) return [];
  return paradas
    .filter((p) => p.sentido === null || p.sentido === sentido)
    .flatMap((p) => {
      const proy = proyectarSobreTrazado({ lat: p.lat, lon: p.lon }, trazado);
      return proy ? [{ stopId: p.stopId, nombre: p.nombre, avanceMetros: proy.avanceMetros }] : [];
    })
    .sort((a, b) => a.avanceMetros - b.avanceMetros);
}

export interface EnElTramo {
  /** El índice de la parada que queda atrás. */
  desdeIndice: number;
  /** Qué parte del tramo lleva, de 0 a 1. */
  fraccion: number;
}

/**
 * En qué tramo cae un avance, y qué parte lleva de él.
 *
 * Antes de la primera parada cae en el tramo cero con fracción cero; después de
 * la última, en el último con fracción uno. **No se sale del carril**: un
 * camión que el GPS ve 40 m antes de la primera parada está en la ruta, y
 * dibujarlo fuera del dibujo sería esconderlo.
 */
export function enElTramo(avanceMetros: number, abscisas: AbscisaDeParada[]): EnElTramo | null {
  if (abscisas.length < 2) return null;
  for (let i = 0; i < abscisas.length - 1; i++) {
    const a = abscisas[i]!.avanceMetros;
    const b = abscisas[i + 1]!.avanceMetros;
    if (avanceMetros < b || i === abscisas.length - 2) {
      const largo = b - a;
      const cruda = largo > 0 ? (avanceMetros - a) / largo : 0;
      return { desdeIndice: i, fraccion: Math.min(1, Math.max(0, cruda)) };
    }
  }
  return null;
}

/** Los márgenes del carril: las marcas de los extremos no se pegan al borde. */
const MARGEN_PCT = 3;

/** De un tramo y su fracción, el porcentaje a lo largo del carril. */
export function porcentajeEnElCarril(tramo: EnElTramo, cuantasParadas: number): number {
  if (cuantasParadas < 2) return MARGEN_PCT;
  const util = 100 - MARGEN_PCT * 2;
  const paso = util / (cuantasParadas - 1);
  return MARGEN_PCT + paso * (tramo.desdeIndice + tramo.fraccion);
}

/** El porcentaje de una parada por su índice. Las paradas van parejas. */
export function porcentajeDeParada(indice: number, cuantasParadas: number): number {
  return porcentajeEnElCarril({ desdeIndice: indice, fraccion: 0 }, cuantasParadas);
}

export interface EscalaDelInstrumento {
  /** Dónde empieza y acaba la banda del rango, en % del eje. */
  bandaDesdePct: number;
  bandaHastaPct: number;
  /**
   * La aguja **es el intervalo entero, no un punto**: el paso es un rango —los
   * dos pings que lo encierran— y clavar una raya en su centro fingiría una
   * hora que el instrumento no conoce. Con una medición fina la aguja sale de
   * un pelo; con un hueco largo del GPS sale ancha, y esa anchura es
   * información: se midió con menos filo.
   */
  agujaDesdePct: number;
  agujaHastaPct: number;
  /** El intervalo se salió del eje y la aguja quedó topada en la orilla. */
  topada: boolean;
}

/**
 * La escala del eje: **de 0 a dos veces la frecuencia prometida.**
 *
 * Con «cada 10 min» el eje va de 0 a 20 y la banda de 5–15 cae al 25–75 %,
 * centrada, que es como se lee un instrumento. La regla vale para cualquier
 * tolerancia: con ±20 % la banda se encoge al 40–60 % y el ojo ve solo que el
 * margen es más estrecho.
 *
 * **Toparse no miente** porque el número va siempre al lado con su rango
 * (9.3b): la aguja dice «se salió por allá» y el renglón dice cuánto. Estirar
 * el eje para que quepa un intervalo de 90 minutos aplastaría la banda hasta
 * volverla invisible justo el día que más importa mirarla.
 */
export function escalaDelInstrumento(
  referencia: Referencia,
  intervalo: { desdeMin: number; hastaMin: number } | null,
): EscalaDelInstrumento {
  const tope = referencia.frecuenciaMin * 2;
  const pct = (min: number) => Math.min(100, Math.max(0, (min / tope) * 100));
  const banda = { bandaDesdePct: pct(referencia.desdeMin), bandaHastaPct: pct(referencia.hastaMin) };
  if (!intervalo) return { ...banda, agujaDesdePct: 0, agujaHastaPct: 0, topada: false };
  return {
    ...banda,
    agujaDesdePct: pct(intervalo.desdeMin),
    agujaHastaPct: pct(intervalo.hastaMin),
    topada: intervalo.desdeMin > tope || intervalo.hastaMin < 0,
  };
}

/**
 * El intervalo en palabras. **Es un rango**, y sólo se escribe como un número
 * cuando sus dos extremos caen en el mismo minuto — no por redondear, sino
 * porque ahí los dos dicen lo mismo.
 */
export function textoDelIntervalo(intervalo: { desdeMin: number; hastaMin: number } | null): string {
  if (!intervalo) return "—";
  const a = Math.round(intervalo.desdeMin);
  const b = Math.round(intervalo.hastaMin);
  return a === b ? `${a} min` : `${a}–${b} min`;
}

/** La banda en palabras, para ponerla al lado de todo número (9.3b). */
export function textoDeReferencia(referencia: Referencia | null): string {
  if (!referencia) return "";
  return `rango ${Math.round(referencia.desdeMin)}–${Math.round(referencia.hastaMin)}`;
}

/**
 * La espera en palabras.
 *
 * Dentro del rango se dice en minutos y ya. **Pasada la orilla se le agregan
 * los segundos**, y no es adorno: ése es el único reloj de la torre que corre
 * frente a quien la mira, y verlo avanzar es la diferencia entre un dato y una
 * alarma que crece.
 */
export function textoDeEspera(espera: EsperaDeParada): string {
  if (espera.minutos === null) return "—";
  const total = Math.max(0, Math.floor(espera.minutos * 60));
  if (espera.estado !== "atrasada") return `${Math.floor(total / 60)} min`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
}

/** Las cuatro palabras de pantalla del 9.3b, y el guion de lo que no aplica. */
export function palabraDeLaPromesa(promesa: PromesaDeUnidad): string {
  switch (promesa.estado) {
    case "en_rango":
      return "EN RANGO";
    case "adelantada":
      return "ADELANTADA";
    case "atrasada":
      return "ATRASADA";
    case "sin_datos":
      return "SIN DATOS";
    case "no_aplica":
      return "—";
  }
}

/**
 * Qué pide hacer algo, y por lo tanto va en tinta mientras lo demás se apaga
 * (skill, ley 2 del color). **SIN DATOS no pide**: no se sabe, y un renglón
 * encendido por no saber manda al operador a perseguir un hueco de captura.
 */
export function laPromesaPide(promesa: PromesaDeUnidad): boolean {
  return promesa.estado === "adelantada" || promesa.estado === "atrasada";
}

/**
 * Por qué no hay estado, dicho donde se arregla.
 *
 * `sin_promesa` **no sale aquí**: no es un hueco de esta unidad sino del
 * circuito —falta capturar la tabla de la franja— y se dice una vez arriba, en
 * el aviso del circuito, no cuatro veces en cuatro piezas.
 */
export function porQueSinDatos(promesa: PromesaDeUnidad): string | null {
  switch (promesa.motivo) {
    case "sin_pasos":
      return "sin pasos que medir";
    case "a_caballo":
      return "a caballo del rango · no concluye";
    case "flujo_incompleto":
      return "este circuito lo corre más de un transportista";
    default:
      return null;
  }
}

/**
 * Qué dice el instrumento cuando no hay banda que dibujar.
 *
 * **Nació mintiendo, y lo enseñó la primera captura**: el texto por omisión era
 * «sin pasos que medir», así que un camión con quince pasos medidos, mirado
 * fuera de horario, salía diciendo que no tenía ninguno. Dato correcto arriba
 * —la palabra era «—»— y afirmación falsa abajo, que es la forma del Marco §D
 * que más cara cuesta porque se ve normal.
 *
 * `null` significa **no dibujar el instrumento**: lo que no aplica no se
 * muestra, ni siquiera vacío.
 */
export function textoDelInstrumentoVacio(promesa: PromesaDeUnidad): string | null {
  if (promesa.estado === "no_aplica") return null;
  switch (promesa.motivo) {
    case "sin_pasos":
      return "sin pasos que medir";
    case "sin_promesa":
      return "sin promesa capturada para esta franja";
    case "a_caballo":
      return "a caballo del rango · no concluye";
    case "flujo_incompleto":
      return "no se mide contra un flujo incompleto";
    default:
      return "sin banda contra qué medir";
  }
}

/**
 * La forma de una unidad en la torre. **Sale de la situación, no de la
 * promesa**: son los dos ejes, y el glifo es del primero — si la forma dijera
 * «atrasada», un camión detenido y uno atrasado compartirían silueta y el ojo
 * dejaría de distinguir lo que se mueve de lo que no.
 */
export function glifoDeLaUnidad(u: UnidadEnLaTorre): EstadoGlifo {
  // De esta unidad no se sabe nada: la silueta de lo que había, vacía.
  if (!u.ultimaPosicion) return "sin-transmitir";
  if (u.situacion === "sin_senal") return "sin-senal";
  /*
   * El umbral de 1 km/h y no de 0: un GPS quieto no reporta cero limpio, oscila.
   * Y `null` —el aparato no reporta velocidad— NO es cero: sin ese dato no se
   * afirma movimiento, se dibuja el círculo, que dice «presente, sin dirección».
   */
  return (u.velocidadKmh ?? 0) > 1 ? "en-movimiento" : "detenida";
}
