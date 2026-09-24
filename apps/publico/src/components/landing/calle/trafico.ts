/**
 * **La avenida del hero** — la simulación, sin una sola línea de dibujo.
 *
 * Debajo del hero cruza una calle: dos carriles, siete coches, Cami, una obra
 * que se cambia de lugar, Tino en su parada y tres pasajeros que se suben. Es
 * la ilustración de lo que Ontoy mira todo el día.
 *
 * ## Está separada del dibujo a propósito
 *
 * Porque es **lógica con reglas**, no adorno: quién puede cambiarse de carril,
 * cuándo frena un coche, cuándo se para Cami, y —lo único de aquí que afirma
 * algo— **qué dice la placa de Tino**. Separada se puede probar sin montar un
 * SVG, y lo que se prueba es justo lo que podría mentir.
 *
 * ## Lo que la placa dice, y por qué no dice minutos
 *
 * El prototipo la traía contando `1′ 2′ 3′ 4′`. **La versión 1 de Ontoy no da
 * minutos**: mientras la velocidad del corredor no esté calibrada, la app dice
 * a cuántas paradas viene la unidad (8.9b), y «llega en 2 min» está en la lista
 * de lo que no entra. Una portada que enseñara minutos prometería algo que la
 * app no hace.
 *
 * Así que la placa cuenta **paradas**, que es la misma cuenta regresiva: a 4, a
 * 3, a 2, a 1, ¡ya! Y lo dice **con su unidad escrita**: «a 3» a secas, en la
 * placa de una parada, se lee como minutos igual de fácil que como paradas, y
 * un número correcto leído con la unidad equivocada es una afirmación falsa.
 *
 * Es **ilustración**, no una lectura de nada: aquí no hay ninguna ruta real.
 */

/** El largo del circuito de la ilustración, en unidades del `viewBox`. */
export const LARGO = 1650;

/** Dónde está la parada de Tino. Cami frena ahí. */
export const PARADA_X = 918;

/**
 * Cuánto mide «una parada» de la cuenta regresiva.
 *
 * Es el largo del circuito entre cinco, que es cuántas paradas tendría una
 * vuelta si estuvieran repartidas. Sale de aquí y no de un número suelto para
 * que la cuenta y la calle no puedan desincronizarse.
 */
export const LARGO_DE_UNA_PARADA = LARGO / 5;

/** Cuánto se queda Cami en la parada, en segundos. */
const ESPERA_EN_PARADA_S = 3.2;

/** Pasados estos segundos sin que llegue, Tino se pone triste. */
const SE_TARDA_S = 26;

/** La obra se cambia de sitio cada tantos segundos. */
const CICLO_DE_LA_OBRA_S = 45;

/** Los cinco sitios por los que va pasando la obra. */
const SITIOS_DE_LA_OBRA = [700, 330, 1040, 560, 860];

export interface Vehiculo {
  /** Cami es el único que se para en la parada. */
  esCami: boolean;
  x: number;
  /** El carril donde está, con decimales mientras se cambia. */
  carril: number;
  /** El carril al que va. */
  carrilDestino: number;
  /** El carril que prefiere, y al que vuelve en cuanto puede. */
  carrilPreferido: number;
  /** Velocidad ahora, y la que querría llevar. */
  v: number;
  vDeseada: number;
  largo: number;
}

/** Lo que Tino sabe en este instante. Es lo único de aquí que afirma algo. */
export interface EstadoDeLaParada {
  /** Cami está parado aquí, subiendo gente. */
  enLaParada: boolean;
  /** Ya viene, a la vista. */
  llegando: boolean;
  /** Lleva mucho sin pasar. Tino se pone triste — y no es una alarma. */
  seTarda: boolean;
  /** Acaba de irse, y todavía se le ve contento. */
  seAcabaDeIr: boolean;
  /** Lo que falta, en unidades del `viewBox`. */
  falta: number;
}

export interface Calle {
  vehiculos: Vehiculo[];
  /** Dónde está la obra ahora. */
  obraX: number;
  /** En qué carril está la obra. */
  obraCarril: number;
  /** En qué segundo de su ciclo va la obra. */
  obraEnSuCiclo: number;
  /** Desde cuándo está Cami parado, o `null` si no lo está. */
  esperandoDesde: number | null;
  /** Cami ya se paró en esta vuelta. */
  yaParo: boolean;
  /** Cuándo salió de la parada la última vez. */
  saliaEn: number;
  /** Se tardó en la vuelta anterior: los pasajeros brincan más al subir. */
  seTardo: boolean;
  parada: EstadoDeLaParada;
}

/** La calle recién puesta, antes del primer cuadro. */
export function calleNueva(): Calle {
  const vehiculos: Vehiculo[] = [
    {
      esCami: true,
      x: -100,
      carril: 0,
      carrilDestino: 0,
      carrilPreferido: 0,
      v: 60,
      vDeseada: 92,
      largo: 90,
    },
  ];
  for (let i = 0; i < 7; i++) {
    vehiculos.push({
      esCami: false,
      x: i * 225 + 60,
      carril: i % 2,
      carrilDestino: i % 2,
      carrilPreferido: i % 2,
      v: 70,
      vDeseada: 82 + ((i * 13) % 36),
      largo: 64,
    });
  }
  return {
    vehiculos,
    obraX: SITIOS_DE_LA_OBRA[0],
    obraCarril: 1,
    obraEnSuCiclo: 0,
    esperandoDesde: null,
    yaParo: false,
    saliaEn: -8,
    seTardo: false,
    parada: {
      enLaParada: false,
      llegando: false,
      seTarda: false,
      seAcabaDeIr: false,
      falta: 900,
    },
  };
}

/** ¿Está este vehículo en ese carril, o yendo hacia él? */
function enElCarril(v: Vehiculo, carril: number): boolean {
  return v.carrilDestino === carril || Math.abs(v.carril - carril) < 0.55;
}

/** El hueco que hay por delante en un carril. La calle da la vuelta, así que el hueco también. */
function huecoDelante(calle: Calle, v: Vehiculo, carril: number): number {
  let hueco = Infinity;
  for (const o of calle.vehiculos) {
    if (o === v || !enElCarril(o, carril)) continue;
    const d = (((o.x - v.x) % LARGO) + LARGO) % LARGO;
    if (d > 0 && d < LARGO / 2) hueco = Math.min(hueco, d - v.largo);
  }
  return hueco;
}

/** El hueco que hay por detrás: sin esto, uno se cambiaría de carril encima de otro. */
function huecoDetras(calle: Calle, v: Vehiculo, carril: number): number {
  let hueco = Infinity;
  for (const o of calle.vehiculos) {
    if (o === v || !enElCarril(o, carril)) continue;
    const d = (((v.x - o.x) % LARGO) + LARGO) % LARGO;
    if (d > 0 && d < LARGO / 2) hueco = Math.min(hueco, d - o.largo);
  }
  return hueco;
}

/**
 * Un cuadro de la calle. Muta `calle` a propósito: se llama sesenta veces por
 * segundo y copiar ocho vehículos cada vez sería basura para el recolector.
 *
 * @param dt segundos desde el cuadro anterior, ya acotados por quien llama.
 * @param t  segundos desde que la página abrió.
 */
export function avanzarLaCalle(calle: Calle, dt: number, t: number): void {
  const enSuCiclo = t % CICLO_DE_LA_OBRA_S;
  const ciclo = Math.floor(t / CICLO_DE_LA_OBRA_S);
  const hayObra = enSuCiclo > 8.5 && enSuCiclo < 24.5;
  calle.obraEnSuCiclo = enSuCiclo;

  /* Cada ciclo la obra aparece en otro sitio y en el otro carril. */
  const sitio = SITIOS_DE_LA_OBRA[ciclo % SITIOS_DE_LA_OBRA.length];
  if (calle.obraX !== sitio) {
    calle.obraX = sitio;
    calle.obraCarril = (ciclo + 1) % 2;
  }

  /*
   * La hora pico va y viene con un coseno lento: la calle no siempre corre
   * igual, y ver el mismo ritmo un minuto entero delata que es un bucle.
   */
  const pico = 0.62 + 0.38 * (0.5 + 0.5 * Math.cos((t * Math.PI * 2) / 70));

  for (const v of calle.vehiculos) {
    let hueco = huecoDelante(calle, v, v.carrilDestino);

    /* La obra tapa un carril: se frena, y se cambia si hay sitio. */
    if (hayObra && v.carrilDestino === calle.obraCarril) {
      const d = calle.obraX - 60 - (v.x + v.largo);
      if (d > -30) {
        hueco = Math.min(hueco, d);
        const otro = 1 - calle.obraCarril;
        if (
          d < 300 &&
          huecoDelante(calle, v, otro) > 18 &&
          huecoDetras(calle, v, otro) > 36
        ) {
          v.carrilDestino = otro;
        }
      }
    }

    /* Y en cuanto puede, cada quien vuelve a su carril — salvo si ahí está la obra. */
    const laObraEstorba =
      hayObra &&
      v.carrilPreferido === calle.obraCarril &&
      v.x < calle.obraX + 70 &&
      v.x + v.largo > calle.obraX - 330;
    if (
      v.carrilDestino !== v.carrilPreferido &&
      !laObraEstorba &&
      huecoDelante(calle, v, v.carrilPreferido) > 36 &&
      huecoDetras(calle, v, v.carrilPreferido) > 46
    ) {
      v.carrilDestino = v.carrilPreferido;
    }

    if (v.esCami) {
      const falta = PARADA_X - (v.x + v.largo);
      /* La parada se le trata como un coche detenido delante: frena solo. */
      if (!calle.yaParo && falta > -12) hueco = Math.min(hueco, falta + 12);
      if (!calle.yaParo && falta < 6 && v.v < 6) {
        if (calle.esperandoDesde == null) calle.esperandoDesde = t;
        if (t - calle.esperandoDesde > ESPERA_EN_PARADA_S) {
          calle.yaParo = true;
          calle.esperandoDesde = null;
          calle.saliaEn = t;
          calle.seTardo = false;
        }
      }
      calle.parada.falta = falta;
    }

    /*
     * La velocidad sale del hueco: pegado frena, con sitio acelera. Frena más
     * rápido de lo que acelera (6 contra 1.6), que es como frena la gente.
     */
    const vQuerida =
      v.vDeseada * pico * Math.max(0, Math.min(1, (hueco - 12) / 90));
    v.v += (vQuerida - v.v) * (1 - Math.exp(-dt * (vQuerida < v.v ? 6 : 1.6)));
    v.carril += (v.carrilDestino - v.carril) * (1 - Math.exp(-dt * 3));
  }

  for (const v of calle.vehiculos) {
    v.x += v.v * dt;
    if (v.x > 1450) {
      v.x -= LARGO;
      if (v.esCami) calle.yaParo = false;
    }
  }

  /* Y lo que Tino sabe. Si Cami ya pasó, lo que falta es la vuelta entera. */
  const falta = calle.yaParo ? calle.parada.falta + LARGO : calle.parada.falta;
  const enLaParada = calle.esperandoDesde != null;
  const llegando = !calle.yaParo && falta < 260 && !enLaParada;
  const seTarda =
    !calle.yaParo && !enLaParada && !llegando && t - calle.saliaEn > SE_TARDA_S;
  if (seTarda) calle.seTardo = true;

  calle.parada = {
    enLaParada,
    llegando,
    seTarda,
    seAcabaDeIr: t - calle.saliaEn < 2.4 && calle.saliaEn > 0,
    falta,
  };
}

/**
 * **Lo que dice la placa de Tino.**
 *
 * Es la única frase de la calle que afirma algo, y por eso es lo único de aquí
 * que se prueba renglón por renglón.
 *
 * Cuenta **paradas y no minutos** (8.9b), y **escribe la unidad**: «a 3» a
 * secas, en la placa de una parada, se lee como minutos igual de fácil, y un
 * número correcto con la unidad equivocada es una afirmación falsa.
 *
 * Tope de cuatro: más lejos que eso la placa diría un número que no le sirve a
 * nadie, y el prototipo ya lo acotaba igual.
 */
export function loQueDiceLaPlaca(parada: EstadoDeLaParada): string {
  if (parada.enLaParada) return "¡ya!";
  const paradas = Math.max(
    1,
    Math.min(4, Math.ceil(parada.falta / LARGO_DE_UNA_PARADA)),
  );
  return paradas === 1 ? "a 1 parada" : `a ${paradas} paradas`;
}

/**
 * El ánimo de Tino: contento cuando lo ve venir o lo tiene enfrente, triste
 * cuando se tarda, neutro el resto.
 *
 * **Nunca es una alarma.** Que Tino se ponga triste porque el camión tarda es
 * el gesto de quien espera, no un letrero rojo: la app no acusa a nadie, y la
 * portada tampoco.
 */
export function animoDeTino(parada: EstadoDeLaParada): -1 | 0 | 1 {
  if (parada.seTarda) return -1;
  if (parada.enLaParada || parada.llegando || parada.seAcabaDeIr) return 1;
  return 0;
}
