import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/**
 * La llave con la que J-Tel firma boletos — **la de laboratorio**.
 *
 * Ontoy 3.0 · PR P1 (`docs/Ficha-Construccion-Ontoy-3-Pagos.md`).
 *
 * ## Esta llave es pública a propósito
 *
 * Se deriva de una frase que está escrita aquí abajo, en claro, y que cualquiera
 * puede leer en el repo. **Eso no es un descuido: es la marca.** Una llave de
 * laboratorio que pareciera secreta sería justo la que alguien podría creer
 * buena para producción; una que se reconstruye leyendo el código no se puede
 * confundir con nada.
 *
 * La llave de producción **no existe todavía** y no va a nacer en un archivo:
 * vivirá en una bóveda, y su parte privada no va a pasar por este repo. Cuando
 * exista, `LLAVE_DE_LABORATORIO` no cambia —se queda para las pruebas— y el
 * código de producción recibirá la suya por fuera.
 *
 * Por eso ninguna función de `boleto.ts` toma esta llave por omisión: `emitir`
 * pide con qué firmar y `verificar` pide contra qué verificar. Firmar con la de
 * laboratorio es siempre una decisión escrita en el sitio donde se firma, nunca
 * lo que pasa si nadie dijo nada.
 */

/**
 * De aquí sale la llave, y está en claro porque la marca es que se pueda leer.
 * Cambiar esta frase cambia la llave: hay una prueba que lo nota.
 */
export const FRASE_DE_LABORATORIO =
  "j-tel · boleto · llave de laboratorio · NO ES DE PRODUCCION";

export type LlaveDeFirma = {
  /** Los 32 bytes con los que se firma. */
  readonly privada: Uint8Array;
  /** Los 32 bytes contra los que se verifica. Es la que viaja al validador. */
  readonly publica: Uint8Array;
  /**
   * Siempre `false` en este repo. El tipo es literal para que una llave de
   * producción no pueda entrar por aquí sin que alguien cambie el tipo a mano.
   */
  readonly esDeProduccion: false;
  /** Para que un volcado en consola diga lo que es. */
  readonly queEs: string;
};

function llaveDesdeFrase(frase: string): LlaveDeFirma {
  /* sha256 de la frase da los 32 bytes que Ed25519 pide como secreto, y los da
     igual en cualquier máquina: la llave de laboratorio es la misma en tu
     computadora, en la mía y en CI, que es lo que permite fijarla en una prueba. */
  const privada = sha256(utf8ToBytes(frase));
  return {
    privada,
    publica: ed25519.getPublicKey(privada),
    esDeProduccion: false,
    queEs: "Llave de LABORATORIO. Datos falsos. No firma nada que cobre dinero real.",
  };
}

export const LLAVE_DE_LABORATORIO: LlaveDeFirma = llaveDesdeFrase(FRASE_DE_LABORATORIO);

/**
 * La pública de laboratorio en hex, que es como viajaría a un validador.
 * Fijada en una prueba: si cambia sin que nadie lo quiera, se lee en rojo.
 */
export const PUBLICA_DE_LABORATORIO_HEX = bytesToHex(LLAVE_DE_LABORATORIO.publica);
