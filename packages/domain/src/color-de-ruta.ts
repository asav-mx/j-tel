/**
 * El color de una ruta: se escoge una vez, de una lista.
 *
 * **Decisión de ASAV, 23-sep-2026** (enmienda (a) al handoff de la identidad de
 * Ontoy). Reemplaza la regla anterior, que decía que la concesión elegía
 * cualquier color y que el sistema lo corregía al dibujar —le corría el tono al
 * rojo o al ámbar si caía junto al naranja, le movía la luz—:
 *
 *  - **Lo escoge J-Staff al capturar**, de una lista. Los tonos parecidos al
 *    naranja de Ontoy **no aparecen en la lista**.
 *  - **Se guarda uno solo,** y es el mismo en la lámina del poste, en la app y
 *    pintado en el camión.
 *  - **Nada se corrige al dibujar.** Lo que se capturó es lo que se pinta.
 *
 * Lo que sigue en pie, porque no le cambia el color a nadie: el texto **encima**
 * del color (blanco o carbón según el 3:1) y el **halo** de la traza sobre el
 * mapa (Marco 8.8c). Los dos viven en `contraste-de-ruta.ts` de Ontoy.
 *
 * ## Qué bloquea y qué sólo avisa, y por qué no es lo mismo
 *
 * **El naranja de Ontoy se bloquea.** Es de Ontoy y de nadie más; la única forma
 * de sostener eso es no dejar guardar un tono que pelee con él.
 *
 * **Los colores reservados de la plataforma sólo se avisan.** El cobre de lo
 * vivo, el verde del latido y los dos del sello significan algo en *nuestras*
 * pantallas — y el color de una ruta es el que los camiones traen pintados en la
 * calle. Si un transportista pintó su flota de un verde parecido al del latido,
 * la app no puede decirle que se equivocó de verde: el color de una ruta es
 * identidad, nunca estado, y el nombre siempre lo acompaña (8.8c). Así que se
 * declara, para que quien captura lo sepa, y decide él.
 */

/** Un color de la lista que J-Staff ofrece. */
export type ColorDeRuta = { hex: string; nombre: string };

/**
 * La lista que J-Staff ofrece.
 *
 * **Son los que existen de verdad.** La regla del sistema de diseño de Ontoy es
 * «nunca inventes un hex: sale de `tokens/colors.css` o se agrega ahí primero», y
 * estos cinco son los únicos colores de ruta que el skill declara hoy: el azul de
 * la 51 y el morado viven en `tokens/colors.css`; el verde, el rosa y el
 * turquesa son las muestras de la §2 del handoff.
 *
 * **Faltan por crecer, y eso no lo decide el código.** Una ciudad tiene más de
 * cinco rutas. Ampliar la lista pide hexes nuevos en `tokens/colors.css`, que es
 * del sistema de diseño; mientras tanto, «otro color» cubre el resto con la
 * misma regla.
 *
 * **Medido, no escogido a ojo** (23-sep-2026): ninguno cae en la banda del
 * naranja, ninguno choca con un color reservado, y el par más junto son 41° de
 * tono (azul y morado) — separados de sobra. Tres de los cinco no llegan a 3:1
 * sobre el lienzo claro, y por eso existe el halo: verde 2.13:1, turquesa 2.45:1
 * y rosa 2.51:1 contra Banqueta.
 */
export const COLORES_DE_RUTA: readonly ColorDeRuta[] = [
  { hex: "#4F7FD8", nombre: "azul" },
  { hex: "#2FA6A0", nombre: "turquesa" },
  { hex: "#5FB36B", nombre: "verde" },
  { hex: "#8B6CC9", nombre: "morado" },
  { hex: "#E36F8C", nombre: "rosa" },
];

/**
 * Los colores que la plataforma tiene tomados y lo que significan.
 *
 * **Esta es su única casa.** Vivían en `contraste-de-ruta.ts` de Ontoy, donde
 * nada los usaba: la función que los leía sólo la llamaba su propia prueba. Aquí
 * los usa la captura, que es donde sirven.
 */
export const RESERVADOS_DE_LA_PLATAFORMA: readonly { hex: string; que: string }[] = [
  { hex: "#B05A0F", que: "el cobre de lo vivo" },
  { hex: "#FFA24D", que: "el cobre de lo vivo" },
  { hex: "#1B9E6B", que: "el verde del latido" },
  { hex: "#2FCB8B", que: "el verde del latido" },
  { hex: "#2E6A4E", que: "el verde del sello" },
  { hex: "#A93636", que: "el ladrillo del no cumplido" },
];

/** El naranja de Ontoy. De Ontoy y de nadie más. */
export const NARANJA_DE_ONTOY = "#F6A15B";

/**
 * La banda de tono que queda fuera, del handoff §1b: «≈14°–44°, saturado».
 *
 * **Va con piso de saturación a propósito.** Un beige o un gris tibio puede caer
 * en 30° de tono y no parecerse en nada al naranja de Ontoy; lo que pelea con él
 * es un naranja, no cualquier cosa con ese tono. Sin el piso, la lista estaría
 * rechazando colores que nadie confundiría.
 */
const BANDA_DE_ONTOY = { desde: 14, hasta: 44, saturacionMinima: 0.35 };

const FORMATO = /^#[0-9a-fA-F]{6}$/;

/** Los tres canales de un `#rrggbb`, de 0 a 1. `null` si no se puede leer. */
function canales(hex: string): [number, number, number] | null {
  const limpio = hex.trim();
  if (!FORMATO.test(limpio)) return null;
  const n = limpio.slice(1);
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** Tono (0–360), saturación y luz (0–1) en HSL. `null` si no se puede leer. */
export function tonoSaturacionLuz(hex: string): { tono: number; saturacion: number; luz: number } | null {
  const c = canales(hex);
  if (!c) return null;
  const [r, g, b] = c;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luz = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { tono: 0, saturacion: 0, luz };
  const saturacion = luz > 0.5 ? d / (2 - max - min) : d / (max + min);
  let tono: number;
  if (max === r) tono = ((g - b) / d) % 6;
  else if (max === g) tono = (b - r) / d + 2;
  else tono = (r - g) / d + 4;
  tono = (tono * 60 + 360) % 360;
  return { tono, saturacion, luz };
}

/** ¿Este color pelea con el naranja de Ontoy? */
export function tonoDeOntoy(hex: string): boolean {
  const m = tonoSaturacionLuz(hex);
  if (!m) return false;
  return (
    m.tono >= BANDA_DE_ONTOY.desde &&
    m.tono <= BANDA_DE_ONTOY.hasta &&
    m.saturacion >= BANDA_DE_ONTOY.saturacionMinima
  );
}

/**
 * Qué color de la plataforma está tomando este hex, si toma alguno. **Avisa, no
 * bloquea** — ver la cabecera.
 *
 * Mira parecido y no igualdad: un hex a un dígito de distancia del cobre es el
 * cobre para cualquiera que lo vea, y una comparación exacta lo dejaría pasar.
 */
export function colorReservado(hex: string): string | null {
  const m = tonoSaturacionLuz(hex);
  if (!m) return null;
  for (const r of RESERVADOS_DE_LA_PLATAFORMA) {
    const n = tonoSaturacionLuz(r.hex)!;
    const distanciaDeTono = Math.min(Math.abs(n.tono - m.tono), 360 - Math.abs(n.tono - m.tono));
    if (distanciaDeTono <= 6 && Math.abs(n.luz - m.luz) <= 0.06 && Math.abs(n.saturacion - m.saturacion) <= 0.2) {
      return r.que;
    }
  }
  return null;
}

/**
 * Por qué este color **no se puede guardar** como color de una ruta, o `null` si
 * sí se puede.
 *
 * Lo que sale de aquí se le enseña a quien captura, tal cual. Por eso la frase
 * dice qué hacer y no sólo que no.
 */
export function porQueNoSirveParaUnaRuta(hex: string): string | null {
  if (!canales(hex)) return "El color va en formato #RRGGBB";
  if (tonoDeOntoy(hex)) {
    return `Ese tono es del naranja de Ontoy (${NARANJA_DE_ONTOY}), que no lleva ningún otro objeto. Escoge otro.`;
  }
  return null;
}

/** ¿Está en la lista que J-Staff ofrece? */
export function estaEnLaLista(hex: string): boolean {
  return COLORES_DE_RUTA.some((c) => c.hex.toLowerCase() === hex.trim().toLowerCase());
}

/**
 * **¿Se rechaza este cambio de color?** La razón, o `null` si se puede guardar.
 *
 * La regla completa, en un solo lugar y sin base de datos — que es lo que
 * permite probarla en CI, donde las de integración no corren.
 *
 * **Sólo se rechaza lo que CAMBIA** (ASAV, 24-sep-2026). La primera versión
 * rechazaba el color prohibido siempre, y eso dejaba encerrado a todo circuito ya
 * capturado con un tono del naranja: el formulario manda el color en cada
 * guardado, así que no se le podía corregir ni el nombre. La regla es sobre lo
 * que se escoge, no sobre lo que ya está escrito — y lo que ya está escrito lo
 * señala la pantalla, en grande, para que se corrija.
 *
 * **Comparar sin distinguir mayúsculas no es cosmético:** la base guarda
 * `#B05A0F` y un formulario puede mandar `#b05a0f`. Tratarlos como distintos
 * convertiría «no toqué el color» en un cambio, y volvería a encerrar el
 * circuito — exactamente el defecto que esto arregla.
 */
export function cambioDeColorRechazado(
  colorGuardado: string,
  colorNuevo: string | undefined,
): string | null {
  if (colorNuevo === undefined) return null;
  const igual = colorNuevo.trim().toUpperCase() === colorGuardado.trim().toUpperCase();
  if (igual) return null;
  return porQueNoSirveParaUnaRuta(colorNuevo);
}
