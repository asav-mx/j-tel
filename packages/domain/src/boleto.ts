import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import type { LlaveDeFirma } from "./boleto-llave.js";

/**
 * El boleto firmado — Ontoy 3.0 · PR P1
 * (`docs/Ficha-Construccion-Ontoy-3-Pagos.md`).
 *
 * **Nada de aquí cobra.** Los boletos son objetos firmados con datos sembrados;
 * este módulo no sabe de dinero, ni de precios, ni de saldos, y no habla con
 * nadie. La valla de `scripts/verificar-sin-cobro.mjs` está para que siga así.
 *
 * ## Qué problema resuelve
 *
 * Un validador en un camión tiene que decidir, **sin internet**, si el boleto
 * que le enseñan vale. Sin red no puede preguntarle a nadie, así que el boleto
 * tiene que traer su propia prueba: J-Tel lo firma con Ed25519 y el validador
 * verifica esa firma con la llave pública, que lleva cargada de antes.
 *
 * ## Por qué no basta con la firma
 *
 * Una firma no caduca. Si el QR fuera sólo el boleto firmado, una captura de
 * pantalla serviría para siempre y se pasaría por WhatsApp. Por eso el boleto
 * trae dentro, firmada por J-Tel, **la llave pública de su portador**, y quien
 * lo enseña prueba en el momento que tiene la privada: firma la ventana de
 * tiempo actual. Una captura se lleva el boleto y una prueba que caduca; sin la
 * llave privada no puede calcular la siguiente.
 *
 * Son dos firmas y dicen dos cosas distintas: **J-Tel firma el boleto, y el
 * boleto firma el momento.**
 *
 * ## Cuánto vive una captura — decidido por Asav el 23-sep-2026
 *
 * La ventana rota cada {@link VENTANA_MS}; el validador acepta {@link
 * TOLERANCIA_VENTANAS} ventanas hacia cada lado, porque ni su reloj ni el del
 * pasajero están sincronizados cuando no hay red.
 *
 * Esa tolerancia **es** el tiempo que una captura sigue sirviendo:
 * `(2 × 4 + 1) × 30 s = 4 min 30 s`. Asav eligió **±2 min** sobre tres opciones
 * (±30 s, ±2 min, ±5 min) sabiendo el costo de cada lado: menos tolerancia
 * cierra la puerta a la captura pero rechaza boletos buenos de teléfonos con el
 * reloj corrido —gente honesta—, y más tolerancia alcanza para mandar la
 * captura a otra ruta.
 *
 * Lo que abarató ser generoso: el validador **recuerda lo que quemó**, así que
 * una captura reusada en el mismo camión falla siempre, sin importar la
 * tolerancia. La ventana sólo abre la puerta hacia *otro* validador.
 *
 * ## Lo que el doble uso promete, y lo que no — decidido por Asav el 23-sep-2026
 *
 * **Dentro de un aparato, absoluto.** {@link verificarBoleto} con su memoria
 * rechaza el segundo paso, siempre.
 *
 * **Entre aparatos, diferido.** Dos validadores sin red no se conocen: un boleto
 * puede pasar en dos camiones distintos, y eso **sólo se sabe al sincronizar**,
 * con {@link cotejarQuemados}. Este módulo no promete más que eso a propósito.
 * Acotarlo —atando el boleto a un circuito o a una franja— se decide en el P3,
 * cuando se sepa cada cuánto sincronizan los lectores de verdad. Fijar hoy ese
 * número sería inventarlo antes de medirlo.
 */

// ─────────────────────────────────────────────────────────────────────────────
// El reloj

/** Cada cuánto rota el código del QR. */
export const VENTANA_MS = 30_000;

/**
 * Cuántas ventanas hacia cada lado acepta el validador: 4 × 30 s = **±2 min**
 * de deriva de reloj (Asav, 23-sep-2026). Ver la cabecera del módulo.
 */
export const TOLERANCIA_VENTANAS = 4;

/**
 * Cuánto tiempo sigue sirviendo una captura de pantalla, en milisegundos.
 * No se usa para decidir nada: existe para que el número esté calculado en un
 * solo lugar, y para que una prueba lo fije. Si alguien mueve la tolerancia,
 * este número se mueve y la prueba lo dice en voz alta.
 */
export const VIDA_DE_UNA_CAPTURA_MS = (2 * TOLERANCIA_VENTANAS + 1) * VENTANA_MS;

/** En qué ventana cae un instante. */
export function ventanaDe(instante: number): number {
  return Math.floor(instante / VENTANA_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Las piezas

export type CuerpoDeBoleto = {
  /** El folio que ve la gente. Único por boleto. */
  readonly folio: string;
  /** Qué ruta ampara. */
  readonly ruta: string;
  /** Epoch ms. Antes de esto el boleto no vale. */
  readonly emitido: number;
  /** Epoch ms. Después de esto el boleto no vale. */
  readonly vence: number;
  /** Siempre. Un boleto de varios usos sería otra cosa y tendría otro tipo. */
  readonly unSoloUso: true;
  /** La llave pública del portador, en hex. Quién puede probar que lo trae. */
  readonly portador: string;
};

/** El boleto tal como J-Tel lo emitió: su cuerpo y la firma de J-Tel encima. */
export type BoletoSellado = {
  readonly cuerpo: CuerpoDeBoleto;
  readonly firmaDeJTel: string;
};

/** Lo que cabe en el QR en un instante dado. */
export type Presentacion = {
  readonly boleto: BoletoSellado;
  /** La ventana que el teléfono del pasajero creía que era. */
  readonly ventana: number;
  /** La firma del portador sobre esa ventana, en hex. */
  readonly pruebaDelPortador: string;
};

/** Las dos llaves del boleto. La privada no sale del teléfono del pasajero. */
export type Portador = {
  readonly privada: Uint8Array;
  readonly publica: Uint8Array;
};

/**
 * Por qué no pasó. Son motivos separados a propósito: «no sirve» no es un
 * veredicto, y un chofer con una fila detrás necesita saber si el boleto es
 * falso, si se venció, si el teléfono trae el reloj corrido o si ya lo usaron.
 */
export type Rechazo =
  | "cuerpo_mal_formado"
  | "firma_no_es_de_jtel"
  | "aun_no_vigente"
  | "vencido"
  | "codigo_fuera_de_ventana"
  | "prueba_no_es_del_portador"
  | "ya_quemado_en_este_aparato";

export type Veredicto =
  | { readonly pasa: true; readonly folio: string }
  | { readonly pasa: false; readonly motivo: Rechazo };

// ─────────────────────────────────────────────────────────────────────────────
// Qué se firma
//
// Los separadores no son adorno —la misma lección que `publico.ts` ya aprendió
// con las huellas—: sin ellos, dos cuerpos distintos pueden concatenarse a la
// misma cadena y colisionar por construcción, y una firma de un boleto valdría
// para otro. Aquí hay separador Y hay `revisarCuerpo`, porque el separador sólo
// sirve si ningún campo puede contenerlo.

const DOMINIO_DEL_BOLETO = "j-tel/boleto/v1";
const DOMINIO_DEL_ROTANTE = "j-tel/boleto-rotante/v1";

const HEX_DE_32_BYTES = /^[0-9a-f]{64}$/;

function serializarCuerpo(c: CuerpoDeBoleto): Uint8Array {
  return utf8ToBytes(
    [
      DOMINIO_DEL_BOLETO,
      c.folio,
      c.ruta,
      String(c.emitido),
      String(c.vence),
      "un-solo-uso",
      c.portador,
    ].join("\n"),
  );
}

function serializarVentana(folio: string, ventana: number): Uint8Array {
  return utf8ToBytes([DOMINIO_DEL_ROTANTE, folio, String(ventana)].join("\n"));
}

/**
 * ¿Este cuerpo se puede serializar sin ambigüedad?
 *
 * El cuerpo que llega al validador lo controla quien enseña el QR, así que esto
 * no es paranoia de tipos: un folio con un salto de línea adentro movería la
 * frontera entre dos campos. Lo mal formado se rechaza antes de mirar la firma.
 */
function cuerpoEstaBienFormado(c: CuerpoDeBoleto): boolean {
  const textos = [c.folio, c.ruta, c.portador];
  if (textos.some((t) => typeof t !== "string" || t.length === 0 || t.includes("\n"))) return false;
  if (!HEX_DE_32_BYTES.test(c.portador)) return false;
  if (!Number.isSafeInteger(c.emitido) || !Number.isSafeInteger(c.vence)) return false;
  if (c.vence <= c.emitido) return false;
  return c.unSoloUso === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Emitir y presentar

/**
 * Las dos llaves de un boleto. Las hace el teléfono del pasajero; J-Tel sólo ve
 * la pública, que es la que acaba firmada dentro del cuerpo.
 *
 * `semilla` es para las pruebas: con ella el par es reproducible. En un teléfono
 * se omite y sale de la aleatoriedad del sistema.
 */
export function crearPortador(semilla?: Uint8Array): Portador {
  const privada = semilla ? sha256(semilla) : ed25519.utils.randomSecretKey();
  return { privada, publica: ed25519.getPublicKey(privada) };
}

/**
 * J-Tel emite un boleto: arma el cuerpo y lo firma.
 *
 * `llave` se pide siempre. No hay omisión: firmar con la de laboratorio tiene
 * que quedar escrito en el sitio donde se firma (ver `boleto-llave.ts`).
 */
export function emitirBoleto(
  datos: {
    folio: string;
    ruta: string;
    emitido: number;
    vence: number;
    portador: Uint8Array;
  },
  llave: LlaveDeFirma,
): BoletoSellado {
  const cuerpo: CuerpoDeBoleto = {
    folio: datos.folio,
    ruta: datos.ruta,
    emitido: datos.emitido,
    vence: datos.vence,
    unSoloUso: true,
    portador: bytesToHex(datos.portador),
  };
  if (!cuerpoEstaBienFormado(cuerpo)) {
    throw new Error(
      `No se puede emitir un boleto con este cuerpo: folio y ruta van sin saltos de línea y no vacíos, ` +
        `las fechas son enteros con vence > emitido, y el portador son 32 bytes en hex. Folio: ${JSON.stringify(datos.folio)}`,
    );
  }
  return { cuerpo, firmaDeJTel: bytesToHex(ed25519.sign(serializarCuerpo(cuerpo), llave.privada)) };
}

/**
 * Lo que el teléfono pinta en el QR ahora mismo: el boleto, la ventana en la
 * que cree estar, y la firma del portador sobre esa ventana.
 *
 * Esto corre en el teléfono del pasajero cada {@link VENTANA_MS}. Que el
 * portador pueda firmar cualquier ventana no es un hueco: la llave privada es
 * suya. El punto es que **una captura no se lleva la llave**.
 */
export function presentarBoleto(
  boleto: BoletoSellado,
  portador: Portador,
  ahora: number,
): Presentacion {
  const ventana = ventanaDe(ahora);
  return {
    boleto,
    ventana,
    pruebaDelPortador: bytesToHex(
      ed25519.sign(serializarVentana(boleto.cuerpo.folio, ventana), portador.privada),
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificar, sin red

function firmaValida(firmaHex: string, mensaje: Uint8Array, publica: Uint8Array): boolean {
  /* `verify` avienta ante bytes mal formados en vez de devolver `false`; para un
     validador eso es lo mismo que una firma que no cuadra, y no debe tumbar la app. */
  try {
    return ed25519.verify(hexToBytes(firmaHex), mensaje, publica);
  } catch {
    return false;
  }
}

/**
 * ¿Pasa este boleto? **Sin red, sin base de datos, sin reloj compartido.**
 *
 * El orden de las comprobaciones es deliberado: primero si el boleto es de
 * J-Tel, luego si está vigente, luego si el código es de ahora, y al final si ya
 * se usó. Un boleto falso no debe enterarse de si su folio estaba quemado.
 *
 * `quemados` es la memoria de **este** aparato. Omitirla es pedir la
 * verificación criptográfica a secas, que es lo que necesita quien quiere saber
 * si un boleto es legítimo sin quemarlo —no es un atajo para saltarse el
 * control de un solo uso.
 */
export function verificarBoleto(
  presentacion: Presentacion,
  contexto: {
    llavePublicaDeJTel: Uint8Array;
    ahora: number;
    quemados?: MemoriaDeQuemados;
  },
): Veredicto {
  const { cuerpo, firmaDeJTel } = presentacion.boleto;

  if (!cuerpoEstaBienFormado(cuerpo)) return { pasa: false, motivo: "cuerpo_mal_formado" };

  if (!firmaValida(firmaDeJTel, serializarCuerpo(cuerpo), contexto.llavePublicaDeJTel)) {
    return { pasa: false, motivo: "firma_no_es_de_jtel" };
  }

  if (contexto.ahora < cuerpo.emitido) return { pasa: false, motivo: "aun_no_vigente" };
  if (contexto.ahora > cuerpo.vence) return { pasa: false, motivo: "vencido" };

  if (!Number.isSafeInteger(presentacion.ventana)) {
    return { pasa: false, motivo: "codigo_fuera_de_ventana" };
  }
  const deriva = Math.abs(presentacion.ventana - ventanaDe(contexto.ahora));
  if (deriva > TOLERANCIA_VENTANAS) return { pasa: false, motivo: "codigo_fuera_de_ventana" };

  const mensaje = serializarVentana(cuerpo.folio, presentacion.ventana);
  if (!firmaValida(presentacion.pruebaDelPortador, mensaje, hexToBytes(cuerpo.portador))) {
    return { pasa: false, motivo: "prueba_no_es_del_portador" };
  }

  if (contexto.quemados && estaQuemado(contexto.quemados, cuerpo.folio)) {
    return { pasa: false, motivo: "ya_quemado_en_este_aparato" };
  }

  return { pasa: true, folio: cuerpo.folio };
}

// ─────────────────────────────────────────────────────────────────────────────
// La memoria de lo quemado

/** Folio → cuándo se quemó (epoch ms). Inmutable: quemar devuelve otra. */
export type MemoriaDeQuemados = ReadonlyMap<string, number>;

export const MEMORIA_VACIA: MemoriaDeQuemados = new Map();

export function estaQuemado(memoria: MemoriaDeQuemados, folio: string): boolean {
  return memoria.has(folio);
}

/**
 * Quema un folio. **El primer quemado manda**: volver a quemar no mueve la
 * hora, porque la hora del primer paso es evidencia y un segundo intento no
 * debe poder borrarla.
 */
export function quemar(
  memoria: MemoriaDeQuemados,
  folio: string,
  ahora: number,
): MemoriaDeQuemados {
  if (memoria.has(folio)) return memoria;
  const siguiente = new Map(memoria);
  siguiente.set(folio, ahora);
  return siguiente;
}

// ─────────────────────────────────────────────────────────────────────────────
// El doble uso entre aparatos, que sólo se ve al sincronizar

/** Un folio que dos o más aparatos quemaron cada uno por su lado. */
export type DobleUso = {
  readonly folio: string;
  /** Los aparatos que lo quemaron, y cuándo, en orden de hora. */
  readonly pasos: ReadonlyArray<{ readonly aparato: string; readonly instante: number }>;
};

/**
 * Lo que salta cuando los lectores por fin sincronizan.
 *
 * **Esto no deshace nada.** Cada paso ya ocurrió y queda como renglón: el
 * cotejo levanta el hallazgo, no lo corrige. Es la misma ley de la medición —lo
 * que pasó, pasó— y es también la razón por la que este módulo no promete un
 * «un solo uso» absoluto entre aparatos: no puede sostenerlo sin red, y promete
 * sólo lo que sostiene.
 */
export function cotejarQuemados(
  porAparato: ReadonlyMap<string, MemoriaDeQuemados>,
): readonly DobleUso[] {
  const pasosPorFolio = new Map<string, Array<{ aparato: string; instante: number }>>();
  for (const [aparato, memoria] of porAparato) {
    for (const [folio, instante] of memoria) {
      const pasos = pasosPorFolio.get(folio) ?? [];
      pasos.push({ aparato, instante });
      pasosPorFolio.set(folio, pasos);
    }
  }
  return [...pasosPorFolio]
    .filter(([, pasos]) => pasos.length > 1)
    .map(([folio, pasos]) => ({
      folio,
      pasos: [...pasos].sort((a, b) => a.instante - b.instante || a.aparato.localeCompare(b.aparato)),
    }))
    .sort((a, b) => a.folio.localeCompare(b.folio));
}

/* Una sola puerta: quien importe `@jtel/domain/boleto` necesita también el tipo
   de la llave y, en pruebas, la de laboratorio. */
export {
  LLAVE_DE_LABORATORIO,
  PUBLICA_DE_LABORATORIO_HEX,
  FRASE_DE_LABORATORIO,
  type LlaveDeFirma,
} from "./boleto-llave.js";
