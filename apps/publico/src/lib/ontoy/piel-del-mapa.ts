import type { Flavor } from "@protomaps/basemaps";

/**
 * **La ropa del mapa** — el escalón 1 del §9 del handoff, en colores.
 *
 * El fondo del mapa dejó de ser una imagen que alguien más dibujó: ahora son
 * **datos** —calles, manzanas, agua— y el dibujo es nuestro. Este archivo dice
 * de qué color va cada cosa, en las dos pieles.
 *
 * ## Por qué esto reemplaza al filtro CSS, y no lo acompaña
 *
 * Hasta hoy el mapa se teñía con un filtro sobre las teselas de
 * OpenStreetMap: `invert(1) hue-rotate(185deg) …` de noche, `saturate(.72)` de
 * día (`lib/tinte-del-mapa.ts`). Un filtro es lo mejor que se puede hacer sobre
 * una imagen ajena, y tiene dos costos que ya no hay por qué pagar:
 *
 *  - **Tiñe todo por igual.** No sabe qué es una calle y qué es un parque, así
 *    que no puede callar lo que no importa ni subirle a lo que sí.
 *  - **Los amarillos y naranjas de OSM seguían debajo.** Naranja es de Ontoy y
 *    de nadie más, y el mapa lo traía puesto en cada carretera.
 *
 * Con los colores aquí, la piel se elige; no se corrige. **El filtro se queda en
 * el repo como plan B declarado** hasta que esto ruede en la calle.
 *
 * ## Cada color sale de un token, y hay una prueba que lo cobra
 *
 * `piel-del-mapa.test.ts` compara **cada hex de este archivo** contra
 * `app/tokens-ontoy.css`. La regla del skill —«nunca inventes un hex»— aquí no
 * se puede sostener leyendo: son cuarenta y tantos valores y ninguno se ve hasta
 * que el mapa se dibuja.
 *
 * ## Lo que este mapa NO dibuja, a propósito
 *
 * **Ni un POI ajeno.** Ni tiendas, ni restaurantes, ni gasolineras, ni sus
 * íconos: el universo de Ontoy no comparte el mapa con marcas de nadie (§9). Sí
 * van los **nombres de calle y de colonia**, que son referencias reales y son
 * como un juarense se ubica.
 *
 * **Ni el barrio dibujado** (la tiendita, los tacos, el semáforo). Eso es para
 * escenas y redes; en el mapa en vivo el barrio va sólo con referencias reales
 * («Qué NO entra» del plan, 25-sep).
 */

/**
 * Los tokens que usa el mapa, con su nombre. **No se escribe un hex que no esté
 * aquí**, y la prueba compara esta tabla contra `tokens-ontoy.css`.
 */
const T = {
  carbon: "#2a2e37",
  "carbon-2": "#4a4f5a",
  gris: "#6b6f78",
  hueso: "#f7f3ec",
  banqueta: "#ede9e1",
  "arena-clara": "#e2dcd1",
  arena: "#dcd5c8",
  "arena-2": "#c9c1b3",
  blanco: "#ffffff",
  noche: "#1e2b4d",
  "noche-2": "#26365e",
  "noche-3": "#324673",
  pasto: "#d3e4c9",
  lagrima: "#7fb8f0",
} as const;

export const TOKENS_DEL_MAPA = T;

/**
 * **El lienzo**: de qué color queda el suelo cuando no hay nada encima. Es lo
 * que ven los ojos entre las calles, y es **contra esto** que se mide si la
 * traza de una ruta necesita halo (Marco 8.8c, `contraste-de-ruta.ts`).
 *
 * Antes eran dos valores medidos a ojo del mapa teñido (`#EFEBE3` y `#2B323B`).
 * Ahora no hay que medir nada: el suelo lo pintamos nosotros, y es este token.
 */
export const LIENZO = { dia: T.banqueta, noche: T.noche } as const;

/**
 * **Día.** Suelo banqueta, manzanas arena clara, calles hueso y avenidas
 * blancas — el §9 del handoff, en ese orden de claridad.
 *
 * La diferencia entre el suelo y una calle es de 1.09:1, y **es a propósito**:
 * el mapa es el fondo de las rutas, no el protagonista. Lo que separa la calle
 * del suelo no es el brillo, es su **orilla** (`--arena`), igual que los bordes
 * de las tarjetas de la app.
 */
const DIA: Flavor = {
  background: T.banqueta,
  earth: T.banqueta,

  /* Parques y arbolado: lo único verde del mapa. */
  park_a: T.pasto,
  park_b: T.pasto,
  wood_a: T.pasto,
  wood_b: T.pasto,

  /*
   * Juárez es desierto: el matorral va en arena, no en verde. Un mapa que pinta
   * el desierto de pasto es un dato correcto con el color de otra ciudad.
   */
  scrub_a: T["arena-clara"],
  scrub_b: T["arena-clara"],
  sand: T.arena,
  beach: T.arena,
  glacier: T.blanco,

  /*
   * **Los usos de suelo van todos del mismo color, y eso es una decisión.**
   * El estilo de Protomaps los distingue por color —hospital, escuela,
   * industria, zoológico—, que es un mapa contándote de qué es cada terreno.
   * Aquí el mapa contesta una cosa: por dónde pasa tu camión. Un manchón de
   * color que no es una ruta compite con la única que sí lo es.
   */
  hospital: T["arena-clara"],
  industrial: T["arena-clara"],
  school: T["arena-clara"],
  zoo: T["arena-clara"],
  military: T["arena-clara"],
  pedestrian: T["arena-clara"],
  aerodrome: T["arena-clara"],
  runway: T.hueso,
  pier: T.hueso,

  water: T.lagrima,

  /* Las manzanas: un paso más oscuras que el suelo. */
  buildings: T["arena-clara"],

  /* Calles: hueso con orilla de arena. */
  other: T.hueso,
  minor_service: T.hueso,
  minor_a: T.hueso,
  minor_b: T.hueso,
  link: T.hueso,
  minor_service_casing: T.arena,
  minor_casing: T.arena,
  link_casing: T.arena,

  /* Avenidas y carreteras: más claras que las calles, igual de calladas. */
  major: T.blanco,
  highway: T.blanco,
  major_casing_early: T.arena,
  major_casing_late: T.arena,
  highway_casing_early: T.arena,
  highway_casing_late: T.arena,

  /* Túneles: la calle se apaga sin desaparecer. */
  tunnel_other: T["arena-clara"],
  tunnel_minor: T["arena-clara"],
  tunnel_link: T["arena-clara"],
  tunnel_major: T["arena-clara"],
  tunnel_highway: T["arena-clara"],
  tunnel_other_casing: T.arena,
  tunnel_minor_casing: T.arena,
  tunnel_link_casing: T.arena,
  tunnel_major_casing: T.arena,
  tunnel_highway_casing: T.arena,

  /* Puentes: los mismos colores que en el suelo. */
  bridges_other: T.hueso,
  bridges_minor: T.hueso,
  bridges_link: T.hueso,
  bridges_major: T.blanco,
  bridges_highway: T.blanco,
  bridges_other_casing: T.arena,
  bridges_minor_casing: T.arena,
  bridges_link_casing: T.arena,
  bridges_major_casing: T.arena,
  bridges_highway_casing: T.arena,

  railway: T["arena-2"],

  /*
   * **La frontera se ve, y no es un detalle de estilo.** En Juárez el límite
   * internacional es la referencia que todo mundo usa para ubicarse; un mapa de
   * esta ciudad que lo esconde se lee peor que uno que lo enseña.
   */
  boundaries: T["arena-2"],

  /*
   * Las etiquetas. El texto apagado va en `--carbon-2` y no en `--gris`
   * (enmienda (e) del skill, ASAV 24-sep): el gris mide 4.16:1 sobre banqueta y
   * el piso del texto es 4.5. Aquí se lee en la calle, con sol.
   */
  roads_label_minor: T["carbon-2"],
  roads_label_minor_halo: T.hueso,
  roads_label_major: T.carbon,
  roads_label_major_halo: T.hueso,
  subplace_label: T["carbon-2"],
  subplace_label_halo: T.hueso,
  city_label: T.carbon,
  city_label_halo: T.hueso,
  state_label: T["carbon-2"],
  state_label_halo: T.hueso,
  country_label: T["carbon-2"],
  address_label: T["carbon-2"],
  address_label_halo: T.hueso,
  ocean_label: T["carbon-2"],
};

/**
 * **Noche.** Azul noche de suelo, y la ciudad se lee por sus calles: son lo
 * único que se aclara. Las manzanas quedan apenas encima del suelo y los
 * parques dejan de ser verdes — de noche nada es verde.
 */
const NOCHE: Flavor = {
  background: T.noche,
  earth: T.noche,

  park_a: T["noche-2"],
  park_b: T["noche-2"],
  wood_a: T["noche-2"],
  wood_b: T["noche-2"],
  scrub_a: T["noche-2"],
  scrub_b: T["noche-2"],
  sand: T["noche-2"],
  beach: T["noche-2"],
  glacier: T["noche-3"],

  hospital: T["noche-2"],
  industrial: T["noche-2"],
  school: T["noche-2"],
  zoo: T["noche-2"],
  military: T["noche-2"],
  pedestrian: T["noche-2"],
  aerodrome: T["noche-2"],
  runway: T["noche-3"],
  pier: T["noche-3"],

  water: T.lagrima,

  buildings: T["noche-2"],

  other: T["noche-3"],
  minor_service: T["noche-3"],
  minor_a: T["noche-3"],
  minor_b: T["noche-3"],
  link: T["noche-3"],
  minor_service_casing: T["noche-2"],
  minor_casing: T["noche-2"],
  link_casing: T["noche-2"],

  major: T.gris,
  highway: T.gris,
  major_casing_early: T["noche-2"],
  major_casing_late: T["noche-2"],
  highway_casing_early: T["noche-2"],
  highway_casing_late: T["noche-2"],

  tunnel_other: T["noche-2"],
  tunnel_minor: T["noche-2"],
  tunnel_link: T["noche-2"],
  tunnel_major: T["noche-2"],
  tunnel_highway: T["noche-2"],
  tunnel_other_casing: T.noche,
  tunnel_minor_casing: T.noche,
  tunnel_link_casing: T.noche,
  tunnel_major_casing: T.noche,
  tunnel_highway_casing: T.noche,

  bridges_other: T["noche-3"],
  bridges_minor: T["noche-3"],
  bridges_link: T["noche-3"],
  bridges_major: T.gris,
  bridges_highway: T.gris,
  bridges_other_casing: T["noche-2"],
  bridges_minor_casing: T["noche-2"],
  bridges_link_casing: T["noche-2"],
  bridges_major_casing: T["noche-2"],
  bridges_highway_casing: T["noche-2"],

  railway: T["carbon-2"],
  boundaries: T.gris,

  /* De noche el texto apagado va en `--arena-2` (7.80:1 sobre azul noche). */
  roads_label_minor: T["arena-2"],
  roads_label_minor_halo: T.noche,
  roads_label_major: T.hueso,
  roads_label_major_halo: T.noche,
  subplace_label: T["arena-2"],
  subplace_label_halo: T.noche,
  city_label: T.hueso,
  city_label_halo: T.noche,
  state_label: T["arena-2"],
  state_label_halo: T.noche,
  country_label: T["arena-2"],
  address_label: T["arena-2"],
  address_label_halo: T.noche,
  ocean_label: T["arena-2"],
};

/**
 * La piel del mapa que toca. **Ni `pois` ni `landcover`**: los dos son opcionales
 * en el estilo de Protomaps y no ponerlos es lo que apaga los POIs ajenos y los
 * manchones de cobertura de suelo de zoom lejano.
 */
export function pielDelMapa(deNoche: boolean): Flavor {
  return deNoche ? NOCHE : DIA;
}

/** El idioma de los nombres del mapa. */
export const IDIOMA_DEL_MAPA = "es";
