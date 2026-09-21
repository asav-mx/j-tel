/**
 * El color de una ruta sobre el mapa — **identidad, nunca estado** (8.8c).
 *
 * La 8.8c pide dos cosas que el código sí puede sostener, y una que no:
 *
 *  - **El nombre siempre acompaña al color.** Eso lo cumplen los componentes: no
 *    hay ninguna pieza donde el color sea lo único que distingue una ruta.
 *  - **3:1 sobre el mapa, en las dos pieles** — y aquí está el problema: el
 *    color lo escoge quien captura el circuito, es el que los camiones traen
 *    pintados en la calle, y la app **no puede cambiarlo**. Un amarillo de ruta
 *    sobre un mapa claro puede medir 1.6:1 y aun así ser el color correcto.
 *  - Lo que la app sí puede es lo que la propia 8.8c sugiere: **el halo**. Una
 *    orilla del color del lienzo alrededor de la traza la separa del fondo sin
 *    tocar el color de nadie.
 *
 * Así que el halo no es decoración ni se pone «por si acaso»: se **mide** el
 * contraste del color contra el lienzo y se engorda el halo cuando no alcanza.
 * Una traza que cumple sola no lo necesita; una que no, lo lleva y entonces
 * cumple.
 *
 * Lo que este módulo NO hace: cambiarle el color a una ruta, ni negarse a
 * dibujarla. El color es un dato de la calle y la app lo respeta.
 */

/** Luminancia relativa de un `#rrggbb`, con la fórmula de WCAG. */
export function luminancia(hex: string): number | null {
  const n = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(n)) return null;
  const canales = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lineal = canales.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lineal[0]! + 0.7152 * lineal[1]! + 0.0722 * lineal[2]!;
}

/** La razón de contraste entre dos colores. `null` si alguno no se puede leer. */
export function contraste(a: string, b: string): number | null {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return null;
  const [alto, bajo] = la > lb ? [la, lb] : [lb, la];
  return (alto + 0.05) / (bajo + 0.05);
}

/** Lo que la 8.8c exige de un color que no es texto, sobre el mapa. */
export const MINIMO_SOBRE_EL_MAPA = 3;

/**
 * Qué tan grueso va el halo de una traza de ese color sobre ese lienzo.
 *
 * `0` cuando el color cumple solo. Cuando no, un halo que crece con lo que le
 * falta — y nunca más de lo que se puede dibujar sin que la traza parezca otra
 * cosa. Un color ilegible no se corrige haciendo la traza el doble de gorda.
 */
export function haloParaLaTraza(colorDeRuta: string, lienzo: string): number {
  const razon = contraste(colorDeRuta, lienzo);
  // Sin poder medir, el halo va puesto: no medir no es lo mismo que cumplir.
  if (razon === null) return 4;
  if (razon >= MINIMO_SOBRE_EL_MAPA) return 0;
  const falta = MINIMO_SOBRE_EL_MAPA - razon;
  return Math.min(6, Math.round(2 + falta * 2));
}

/**
 * Los colores que la plataforma tiene reservados y que **no se le asignan a una
 * ruta** (8.8c): el cobre de lo vivo, el verde del latido, y los dos del sello.
 *
 * Esto no rechaza el dato —el color viene de la calle y la app lo dibuja— pero
 * sí lo **declara**, para que quien captura circuitos se entere de que eligió un
 * color que ya significa otra cosa en la plataforma. El aviso es para J-Staff,
 * nunca para el pasajero: a él no le importa nuestra paleta.
 */
const RESERVADOS: Record<string, string> = {
  "#b05a0f": "el cobre de lo vivo",
  "#ffa24d": "el cobre de lo vivo",
  "#1b9e6b": "el verde del latido",
  "#2fcb8b": "el verde del latido",
  "#2e6a4e": "el verde del sello",
  "#a93636": "el ladrillo del no cumplido",
};

export function colorReservado(colorDeRuta: string): string | null {
  return RESERVADOS[colorDeRuta.trim().toLowerCase()] ?? null;
}
