/**
 * LOS MUÑECOS DEL MAPA — Tino, Cami desde arriba y el pasajero.
 *
 * El escalón 2 del §9 del handoff: «nuestros muñecos encima». El escalón 1 —la
 * ropa del mapa— **no es de este archivo ni de este frente**: la base la sirve
 * `mapa-base.ts` y su estilo lo construye aparte.
 *
 * ## Por qué son cadenas y no componentes de React
 *
 * Porque Leaflet los pide así: un `divIcon` recibe HTML, no un árbol de React.
 * Devolverlos como cadena es lo que el mapa ya hacía con el punto de la unidad;
 * lo que cambia es que ahora el dibujo vive **fuera del componente**, en
 * funciones puras que se pueden probar sin montar un mapa.
 *
 * ## De dónde salen los dibujos
 *
 * Copiados del handoff (`App Mapa.dc.html` del #562), no redibujados: el propio
 * handoff lo pide —«cópialos de ahí; no hay que redibujarlos»—. Lo que sí se
 * hizo fue **parametrizar** lo que el dato decide: el color de la ruta y el
 * rumbo.
 *
 * ## La regla que gobierna este archivo
 *
 * **El color de ruta pinta lo que es de una ruta** —Tino y Cami— y nada más. El
 * pasajero va en Azul noche, que es de Ontoy: es el único muñeco del mapa que
 * **no** pertenece a ninguna ruta, y pintarlo del color de una diría que va en
 * ella (handoff §1: «"Tú estás aquí" = el pasajero», y §9b, variante 12a).
 */

/** El carbón de la paleta. Va en literal porque esto se escribe dentro de un SVG. */
const CARBON = "#2A2E37";
const BLANCO = "#ffffff";
/** Azul noche: el color del pasajero, que no es de ninguna ruta. */
const NOCHE = "#1E2B4D";
const HUESO = "#F7F3EC";

/** Lo que el mapa sabe de una unidad para dibujarla. */
export interface CamiEnElMapa {
  /** El color de SU ruta, del dato (`color_hex`). */
  color: string;
  /**
   * Los grados del GPS, o `null`. **Null no se rellena**: ver `rotacionDeCami`.
   */
  rumbo: number | null;
  /** Si la posición todavía dice dónde está. Una vieja se dibuja apagada (8.9). */
  fresco: boolean;
  /** El número que trae pintado el camión (8.5). */
  economico: string;
  /** «hace 6 min» — la edad, que nunca falta (8.3 y el estándar, regla 4). */
  edad: string;
}

/**
 * **El giro de Cami, y el caso que importa es el `null`.**
 *
 * El handoff pide que Cami «gire con su rumbo». El rumbo es un dato del GPS y
 * **puede no venir**: `UnidadViva.rumbo` es `number | null`, y viene nulo cuando
 * el aparato no lo reporta o el camión está detenido.
 *
 * Con el rumbo se gira. **Sin rumbo NO se gira** —se deja mirando al norte— y
 * eso es una decisión, no una omisión: cualquier otro ángulo sería inventado, y
 * un camión apuntando a una calle por la que no va es §E del Marco con un
 * agravante, porque el pasajero usa esa flecha para decidir de qué lado de la
 * avenida se para.
 *
 * Mirar al norte no afirma nada: es la orientación en la que está dibujado.
 */
export function rotacionDeCami(rumbo: number | null): number {
  if (rumbo === null || !Number.isFinite(rumbo)) return 0;
  // El GPS puede mandar 360, o negativos si alguien los resta mal aguas arriba.
  return ((rumbo % 360) + 360) % 360;
}

/**
 * **Cami desde arriba**, del color de su ruta y girando con su rumbo.
 *
 * El dibujo mide 80×120 en sus propias coordenadas y se escala a 26–34 px, que
 * es lo que el §9 pide para que se lea en el mapa.
 *
 * **Sólo el cuerpo gira.** El número y la edad se quedan derechos: un rótulo que
 * rota con el camión queda de cabeza la mitad del recorrido, y la edad del dato
 * es justo lo que no se puede volver ilegible.
 */
export function camiDesdeArriba(u: CamiEnElMapa): string {
  const giro = rotacionDeCami(u.rumbo);
  const viejo = !u.fresco;
  return `<span class="ontoy-cami${viejo ? " vieja" : ""}" style="--ruta:${u.color}">
  <svg class="ontoy-cami-cuerpo" viewBox="0 0 80 120" width="30" height="45" aria-hidden="true"
       style="transform:rotate(${giro}deg)">
    <rect x="9" y="22" width="8" height="16" rx="3" fill="${CARBON}"/>
    <rect x="63" y="22" width="8" height="16" rx="3" fill="${CARBON}"/>
    <rect x="9" y="84" width="8" height="16" rx="3" fill="${CARBON}"/>
    <rect x="63" y="84" width="8" height="16" rx="3" fill="${CARBON}"/>
    <rect x="14" y="8" width="52" height="104" rx="16" fill="${u.color}"/>
    <rect x="20" y="12" width="40" height="22" rx="9" fill="${CARBON}"/>
    <ellipse cx="32" cy="23" rx="7.5" ry="5.8" fill="${BLANCO}"/>
    <ellipse cx="48" cy="23" rx="7.5" ry="5.8" fill="${BLANCO}"/>
    <circle cx="32" cy="20.5" r="3.4" fill="${CARBON}"/>
    <circle cx="48" cy="20.5" r="3.4" fill="${CARBON}"/>
    <rect x="27" y="52" width="26" height="22" rx="6" fill="${HUESO}"/>
  </svg>
  <span class="ontoy-cami-num">${u.economico}</span>
  <span class="ontoy-cami-edad cifra">${u.edad}</span>
</span>`;
}

/**
 * `g-estrella-si` —la estrella maíz que sonríe— en cadena, para ponerla en la
 * esquina del muñeco. Copiada de `docs/diseno/app-v1/simbolos/g-estrella-si.svg`
 * sin sus metadatos; es la misma que el botón «Guardada» (`GlifoEstrellaSi`).
 * Antes era un «★» de texto: dependía de la fuente del teléfono para verse, y
 * no era la estrella del diseño.
 */
const ESTRELLA_SI = `<svg class="ontoy-tino-estrella" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" fill="#F2C14E" stroke="#F2C14E" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="10" cy="11.2" r="1.6" fill="#fff"/><circle cx="14" cy="11.2" r="1.6" fill="#fff"/>
    <circle cx="10" cy="11.2" r="0.85" fill="#2A2E37"/><circle cx="14" cy="11.2" r="0.85" fill="#2A2E37"/>
    <path d="M10.7 13.9q1.3 1.1 2.6 0" fill="none" stroke="#2A2E37" stroke-width="1.1" stroke-linecap="round"/>
  </svg>`;

/**
 * **Las «z» de Páris dormido** (README: «Cerrada: … todos los Tino duermen con
 * zzz»; lámina 2-mapa/13). Arriba a la derecha de la cabeza, una grande y una
 * chica, como las de Ontoy dormido. Su color sigue la piel (`.ontoy-tino-z`):
 * carbón de día, claras de noche, con un filo del fondo para leerse sobre el
 * mapa.
 */
const ZZZ = `<text x="86" y="22" class="ontoy-tino-z">z</text><text x="104" y="0" class="ontoy-tino-z chica">z</text>`;
/** Guardada y dormida: la estrella ya ocupa la orilla derecha, así que las «z» suben por la izquierda. */
const ZZZ_A_LA_IZQUIERDA = `<text x="14" y="22" class="ontoy-tino-z">z</text><text x="-4" y="0" class="ontoy-tino-z chica">z</text>`;

/** Cómo mira Tino. La mirada es señal, no adorno (handoff §1c). */
export type MiradaDeTino =
  /** Al frente: te habla a ti. Sin dato que decir. */
  | "al-frente"
  /** De lado: de allá viene. Sólo con una unidad medida en camino. */
  | "de-lado"
  /** Ojos cerrados: cerrado o de noche. */
  | "dormido";

/**
 * **Tino en una parada**, del color de su ruta.
 *
 * `de-lado` es el único estado que afirma algo —«de allá viene»— así que sólo lo
 * pone quien tenga una unidad medida en camino. Los otros dos no afirman nada:
 * uno te habla y el otro duerme porque la ruta está cerrada, que es un horario,
 * no una medición.
 *
 * **Sin placa y sin minutos.** La placa con el número vive en la hoja, donde hay
 * lugar para decir de qué ruta es y de cuándo es el dato. Un «3′» colgado de un
 * muñeco de 30 px en el mapa no cabe con su edad, y una cifra de tiempo sin su
 * edad no se muestra (estándar, regla 4).
 */
export function tinoEnLaParada(entrada: {
  color: string;
  mirada: MiradaDeTino;
  /**
   * **Tu parada guardada: Páris sonriendo, con su estrella** (ASAV, 25-sep).
   * La estrella es la del diseño —`g-estrella-si`, maíz y sonriente—, no un
   * carácter de texto; y guardada implica sonrisa, salvo que la ruta duerma.
   */
  guardada?: boolean;
  /**
   * **Páris sonríe.** No es una mirada —los ojos siguen diciendo lo suyo—: es
   * la boca, y la ponen quienes tienen algo bueno que decir: la hoja que te
   * recibe al escanear el letrero («Estás en esta parada», lámina
   * `5-paradas/04`) y, en el mapa, tu parada guardada.
   */
  sonrie?: boolean;
}): string {
  const { color, mirada, guardada = false } = entrada;
  /*
   * Guardada ⇒ sonríe: «tu parada guardada = Páris sonriendo con estrella».
   * **Salvo dormido**: con la ruta cerrada, Páris duerme, y una sonrisa encima
   * de unos ojos cerrados diría «todo bien» justo cuando no pasa ningún camión.
   * Lo cerrado manda; la estrella sí se queda, porque sigue siendo tuya.
   */
  const sonrie = mirada !== "dormido" && (entrada.sonrie ?? guardada);
  /* Las pupilas se corren para mirar de lado; cerrados son dos rayas. */
  const ojos =
    mirada === "dormido"
      ? `<path d="M44 34 q7 5 14 0" fill="none" stroke="${CARBON}" stroke-width="3" stroke-linecap="round"/>
         <path d="M62 34 q7 5 14 0" fill="none" stroke="${CARBON}" stroke-width="3" stroke-linecap="round"/>`
      : `<circle cx="51" cy="36" r="7.5" fill="${BLANCO}"/>
         <circle cx="69" cy="36" r="7.5" fill="${BLANCO}"/>
         <circle cx="${mirada === "de-lado" ? 47.5 : 51}" cy="35" r="4" fill="${CARBON}"/>
         <circle cx="${mirada === "de-lado" ? 65.5 : 69}" cy="35" r="4" fill="${CARBON}"/>`;
  return `<span class="ontoy-tino" style="--ruta:${color}">
  <svg viewBox="0 0 120 120" width="32" height="32" aria-hidden="true" style="overflow:visible">
    <rect x="57" y="36" width="6" height="72" fill="${CARBON}"/>
    <rect x="46" y="106" width="28" height="7" rx="3.5" fill="${CARBON}"/>
    <circle cx="60" cy="38" r="26" fill="${color}"/>
    ${ojos}
    ${sonrie ? `<path d="M52 47 q8 7 16 0" fill="none" stroke="${CARBON}" stroke-width="3" stroke-linecap="round"/>` : ""}
    ${mirada === "dormido" ? (guardada ? ZZZ_A_LA_IZQUIERDA : ZZZ) : ""}
  </svg>
  ${guardada ? ESTRELLA_SI : ""}
</span>`;
}

/**
 * **El pasajero** — «tú estás aquí», con su linterna de rumbo.
 *
 * ## La linterna sólo sale si hay rumbo medido
 *
 * El cono apunta a donde el pasajero mira, y eso es una **afirmación**: quien la
 * ve la usa para orientarse. El rumbo sale de `coords.heading` del navegador,
 * que **viene nulo casi siempre** —un teléfono quieto no tiene rumbo, y a pie
 * muchos aparatos no lo dan nunca—.
 *
 * Con rumbo, cono. **Sin rumbo, el pasajero va sin cono**, y no es que falte el
 * dibujo: es que no hay hacia dónde apuntar. Un cono al norte por omisión sería
 * el §E del Marco en su forma más cara, porque manda a alguien a caminar.
 *
 * ## Por qué no lleva color de ruta
 *
 * El pasajero no es de ninguna ruta. Va en Azul noche, que es de Ontoy. Pintarlo
 * del color de la que está abierta diría que va en ella.
 */
export function pasajeroConLinterna(rumbo: number | null): string {
  const hayRumbo = rumbo !== null && Number.isFinite(rumbo);
  const giro = hayRumbo ? ((rumbo! % 360) + 360) % 360 : 0;
  const cono = hayRumbo
    ? `<path d="M30 30 L14 4 A30 30 0 0 1 46 4 Z" fill="${NOCHE}" opacity=".22"
             style="transform:rotate(${giro}deg);transform-origin:30px 30px"/>`
    : "";
  return `<span class="ontoy-pasajero">
  <svg viewBox="0 0 60 60" width="36" height="36" aria-hidden="true" style="overflow:visible">
    ${cono}
    <circle cx="30" cy="34" r="14" fill="${BLANCO}"/>
    <circle cx="30" cy="34" r="11.5" fill="${NOCHE}"/>
    <circle cx="25.5" cy="31" r="3.6" fill="${BLANCO}"/>
    <circle cx="34.5" cy="31" r="3.6" fill="${BLANCO}"/>
    <circle cx="25.8" cy="29.4" r="2" fill="${CARBON}"/>
    <circle cx="34.8" cy="29.4" r="2" fill="${CARBON}"/>
    <circle cx="12" cy="40" r="4" fill="${NOCHE}"/>
    <circle cx="48" cy="40" r="4" fill="${NOCHE}"/>
  </svg>
  <span class="ontoy-pasajero-palabra">tú</span>
</span>`;
}
