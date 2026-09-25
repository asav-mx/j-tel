/*
 * **El barrio** — lo que hay alrededor del camino.
 *
 * Los objetos del universo, copiados de la hoja maestra del sistema de diseño:
 * la tiendita, la escuela, la farmacia, los tacos y los árboles. Todos con su
 * carita, todos en **colores de barrio** y **ninguno en naranja** — el naranja
 * es de Ontoy— ni en color de ruta: **no son de ninguna ruta**, son la ciudad
 * por la que la ruta pasa.
 *
 * Son **ilustración**, y en la landing eso está bien: aquí no hay un mapa de
 * nada, hay un dibujo de un barrio.
 */

/** La tiendita de la esquina. */
export function Tiendita(props: React.SVGProps<SVGGElement>) {
  return (
    <g {...props}>
      <rect x="4" y="16" width="52" height="38" rx="3" fill="var(--maiz)" />
      <rect x="4" y="16" width="52" height="8" fill="var(--rosa)" />
      <rect x="8" y="6" width="44" height="10" rx="3" fill="var(--carbon)" />
      <rect x="10" y="30" width="18" height="14" rx="3" fill="var(--carbon)" />
      <rect x="34" y="30" width="12" height="24" rx="2" fill="var(--carbon)" />
      <circle cx="15" cy="37" r="3.2" fill="var(--ojo)" />
      <circle cx="23" cy="37" r="3.2" fill="var(--ojo)" />
      <circle cx="16" cy="38.4" r="1.8" fill="var(--pupila)" />
      <circle cx="24" cy="38.4" r="1.8" fill="var(--pupila)" />
    </g>
  );
}

/** La escuela, con su asta y su bandera. */
export function Escuela(props: React.SVGProps<SVGGElement>) {
  return (
    <g {...props}>
      <rect x="10" y="30" width="62" height="40" fill="var(--maiz)" />
      <path d="M6 32 L41 10 L76 32 Z" fill="var(--carbon)" />
      <rect x="4" y="4" width="2.5" height="66" fill="var(--carbon)" />
      <rect x="6.5" y="5" width="12" height="8" fill="var(--rosa)" />
      <rect x="16" y="40" width="10" height="9" rx="2" fill="var(--asfalto)" />
      <rect x="56" y="40" width="10" height="9" rx="2" fill="var(--asfalto)" />
      <rect x="35" y="48" width="12" height="22" rx="2" fill="var(--asfalto)" />
      <circle cx="35" cy="30" r="4" fill="var(--ojo)" />
      <circle cx="47" cy="30" r="4" fill="var(--ojo)" />
      <circle cx="36" cy="30" r="2.2" fill="var(--pupila)" />
      <circle cx="48" cy="30" r="2.2" fill="var(--pupila)" />
    </g>
  );
}

/** La farmacia, con su cruz. */
export function Farmacia(props: React.SVGProps<SVGGElement>) {
  return (
    <g {...props}>
      <rect x="6" y="22" width="54" height="38" fill="var(--arena)" />
      <rect x="2" y="12" width="62" height="13" rx="4" fill="var(--nopal)" />
      <rect x="46" y="6" width="16" height="16" rx="4" fill="var(--hueso)" />
      <rect x="52" y="8.5" width="4" height="11" fill="var(--nopal)" />
      <rect x="48.5" y="12" width="11" height="4" fill="var(--nopal)" />
      <rect x="12" y="32" width="20" height="16" rx="3" fill="var(--asfalto)" />
      <rect x="38" y="32" width="14" height="28" rx="2" fill="var(--asfalto)" />
      <circle cx="18" cy="40" r="3.2" fill="var(--ojo)" />
      <circle cx="26" cy="40" r="3.2" fill="var(--ojo)" />
      <circle cx="19" cy="40" r="1.8" fill="var(--pupila)" />
      <circle cx="27" cy="40" r="1.8" fill="var(--pupila)" />
    </g>
  );
}

/** El puesto de tacos, con su toldo. */
export function Tacos(props: React.SVGProps<SVGGElement>) {
  return (
    <g {...props}>
      <rect x="29" y="4" width="2" height="12" fill="var(--carbon)" />
      <path d="M8 18 A22 14 0 0 1 52 18 Z" fill="var(--rosa)" />
      <rect x="10" y="24" width="40" height="22" rx="5" fill="var(--agua)" />
      <rect x="6" y="20" width="48" height="5" rx="2.5" fill="var(--carbon)" />
      <text
        x="30"
        y="43"
        textAnchor="middle"
        fill="var(--blanco)"
        style={{ font: "800 6px var(--titular)" }}
      >
        TACOS
      </text>
      <circle cx="24" cy="32" r="4" fill="var(--ojo)" />
      <circle cx="36" cy="32" r="4" fill="var(--ojo)" />
      <circle cx="25" cy="32" r="2.2" fill="var(--pupila)" />
      <circle cx="37" cy="32" r="2.2" fill="var(--pupila)" />
      <circle cx="18" cy="50" r="5" fill="var(--carbon)" />
      <circle cx="42" cy="50" r="5" fill="var(--carbon)" />
    </g>
  );
}

/** Un árbol. */
export function Arbol(props: React.SVGProps<SVGGElement>) {
  return (
    <g {...props}>
      <rect x="22" y="32" width="8" height="24" rx="2" fill="var(--carbon)" />
      <circle cx="14" cy="30" r="12" fill="var(--nopal)" />
      <circle cx="38" cy="30" r="12" fill="var(--nopal)" />
      <circle cx="26" cy="20" r="18" fill="var(--nopal)" />
      <circle cx="20" cy="22" r="4.2" fill="var(--ojo)" />
      <circle cx="32" cy="22" r="4.2" fill="var(--ojo)" />
      <circle cx="21" cy="22" r="2.3" fill="var(--pupila)" />
      <circle cx="33" cy="22" r="2.3" fill="var(--pupila)" />
    </g>
  );
}

/**
 * El rectángulo que ocupa cada dibujo **en sus propias coordenadas**.
 *
 * Hace falta porque el diseño coloca cada pieza por su caja —«los tacos van en
 * 236,150 y miden 56 × 52»— y nuestros dibujos no nacen todos en el 0,0 ni del
 * mismo tamaño. Con la caja, la colocación sale de una cuenta y no de probar
 * escalas a ojo hasta que cuadre.
 */
const CAJAS = {
  tiendita: { x: 4, y: 6, w: 52, h: 48 },
  escuela: { x: 4, y: 4, w: 72, h: 66 },
  farmacia: { x: 2, y: 6, w: 62, h: 54 },
  tacos: { x: 6, y: 4, w: 48, h: 51 },
  arbol: { x: 2, y: 2, w: 48, h: 54 },
} as const;

/**
 * Dónde va cada uno, en el `viewBox` de 300 × 900 del camino: **las posiciones
 * del diseño, tal cual**.
 *
 * Están en los huecos que deja la serpiente — el camino va de un lado al otro y
 * el barrio ocupa el lado contrario en cada tramo — menos la tiendita, que el
 * diseño ponía en 226,800 y aquí baja a 240,836: nuestros Tinos de parada son
 * más grandes que los del prototipo, porque su placa cuenta paradas en vez de
 * minutos y necesita el doble de sitio, y ahí la quinta le caía encima.
 */
export const EL_BARRIO = [
  { que: "tacos", x: 236, y: 150, w: 56 },
  { que: "arbol", x: 4, y: 30, w: 44 },
  { que: "escuela", x: 0, y: 360, w: 62 },
  { que: "farmacia", x: 238, y: 600, w: 58 },
  { que: "tiendita", x: 240, y: 836, w: 54 },
  { que: "arbol", x: 8, y: 780, w: 40 },
] as const;

type Que = (typeof EL_BARRIO)[number]["que"];

/** El `transform` que lleva un dibujo a su sitio y su tamaño del diseño. */
export function dondeVa(pieza: (typeof EL_BARRIO)[number]): string {
  const caja = CAJAS[pieza.que];
  const escala = pieza.w / caja.w;
  const x = pieza.x - caja.x * escala;
  const y = pieza.y - caja.y * escala;
  return `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${escala.toFixed(3)})`;
}

export function PiezaDelBarrio({ que }: { que: Que }) {
  if (que === "tiendita") return <Tiendita />;
  if (que === "escuela") return <Escuela />;
  if (que === "farmacia") return <Farmacia />;
  if (que === "tacos") return <Tacos />;
  return <Arbol />;
}
