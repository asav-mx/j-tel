/*
 * Paleta de identidad — azules, índigos, violetas y magentas.
 *
 * Vive en `lib` y no dentro de un componente porque la usan los dos lados de la
 * frontera: el lienzo de leaflet, que es cliente, y las pantallas de servidor
 * que dibujan el chip de cada unidad. Duplicarla para no cruzar el import sería
 * dejar dos paletas que se separan sin que nadie lo note — y esta paleta tiene
 * una condición medida que hay que poder verificar en UN lugar.
 *
 * Es la única excepción de color a mano del producto, y es deliberada: estos
 * hexes no miden ni juzgan, IDENTIFICAN — el mismo papel que el código de la
 * ruta. Con catorce trazas encimadas todas en acero el mapa deja de ser legible.
 *
 * **La condición de la excepción: la paleta no toca verde, rojo ni ámbar**,
 * para que una traza jamás se confunda con un veredicto. Y eso se mide, no se
 * mira: toda la paleta vive en la banda 196°–312° de tono, que es la única
 * región separada por 45° o más de los tres colores de veredicto en SUS DOS
 * temas (verde 149/151°, ámbar 41/42°, rojo 358°).
 *
 * Separación mínima medida contra cualquier veredicto: **47.1°**. La paleta
 * anterior tenía dos aguamarinas a 19.8° y 21.6° del verde — no eran el verde
 * del veredicto, pero a esa distancia una traza menta junto a un chip
 * `Cumplido` se lee de la misma familia, y eso es justo lo que la regla
 * prohíbe. Cambiarlas no costó legibilidad: la distancia perceptual mínima
 * entre trazas subió de ΔE 8.5 a 9.3.
 *
 * Si alguna vez se agrega o cambia un color aquí, se vuelve a medir. Ningún
 * tono fuera de 196°–312°. La prueba de `monitoreo-map.test.ts` lo hace cumplir.
 */
export const COLORES_IDENTIDAD = [
  "#45c2f7",
  "#8dc3ec",
  "#3687f2",
  "#829fe3",
  "#5a74f6",
  "#383ddc",
  "#8b7af5",
  "#8262da",
  "#9f5ff1",
  "#c891e8",
  "#d751ec",
  "#e873dc",
];

/** El color que le toca a un índice de identidad, con vuelta al principio. */
export function colorDeIdentidad(indice: number): string {
  return COLORES_IDENTIDAD[indice % COLORES_IDENTIDAD.length]!;
}
