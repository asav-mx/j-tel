/**
 * Lo que baja del servidor — los dos contratos que Ontoy lee.
 *
 * Vivían dentro de `vista-pasajero.tsx`, el componente que esta app reemplaza.
 * Salen aquí porque ahora los leen tres piezas (Rutas, Mapa y la hoja de
 * parada), y tres copias de un contrato son tres formas de dejar de coincidir
 * con el servidor sin que nadie se entere.
 *
 * Ni uno solo de estos campos se calcula en el teléfono: la escalera de estados
 * (8.9) la resuelve el servidor y **la pantalla lee, no deduce**.
 */

import type { PromesaAhora } from "@jtel/domain";

export type Sentido = "ida" | "vuelta";
export type { PromesaAhora };

export interface Forma {
  circuito_id: string;
  nombre: string;
  color_hex: string;
  piso_rango_seg: number;
  dato_viejo_seg: number;
  /** La MISMA tolerancia con la que el servidor decidió qué publicar. */
  corredor_m: number;
  velocidad_declarada_kmh: number;
  horario: { inicio: string; fin: string; zona: string };
  trazados: Array<{ sentido: Sentido; coordenadas: Array<[number, number]>; largo_m: number }>;
  paradas: Array<{
    /** El slug del QR: la identidad pública de la parada, y la que se guarda. */
    id: string;
    nombre: string;
    orden: number;
    sentido: Sentido | null;
    lat: number;
    lon: number;
  }>;
}

export interface UnidadViva {
  /**
   * El número económico — el que trae pintado el camión. La 8.5 lo pide por su
   * nombre: «viene la 2120» es parte de la confianza. Antes iba un
   * identificador opaco; ver el porqué del cambio en el endpoint.
   */
  economico: string;
  lat: number;
  lon: number;
  rumbo: number | null;
  sentido: Sentido | null;
  antiguedad_seg: number;
  /**
   * Si la posición todavía dice DÓNDE ESTÁ el camión. Las que no lo están
   * siguen viniendo —el camión no se fue a ningún lado— pero se pintan apagadas
   * y **no entran al cálculo del rango** (8.9).
   */
  fresco: boolean;
}

export interface Vivo {
  /** La escalera ya resuelta por el servidor. */
  estado: "por_arrancar" | "fuera_de_horario" | "en_vivo" | "por_horario" | "sin_evidencia";
  abre_a: string;
  arranca_el: string | null;
  /** El rango sólo se enseña si la velocidad del circuito ya se calibró. */
  rango_activo: boolean;
  /**
   * Los avisos de la concesión que valen ahora (8.13b; 0052): «según la
   * concesión», con su fecha. Los enseña la campana (PR 4b). Opcional: una
   * respuesta de antes de la 0052 no los trae.
   */
  avisos?: Array<{ id: string; titulo: string; detalle: string | null; desde: string; hasta: string | null }>;
  /** La promesa de AHORA, de las franjas. Viaja aquí y no en la forma: la forma vive en caché. */
  promesa: PromesaAhora;
  unidades: UnidadViva[];
  generado_en: string;
}

/** La ruta como la ve la portada: identidad y promesa, sin sus paradas. */
export interface RutaDeLaCiudad {
  circuito_id: string;
  nombre: string;
  color_hex: string;
  /** La promesa de cuando se armó la portada. */
  promesa: PromesaAhora;
  horario: { inicio: string; fin: string; zona: string };
  arranca_el: string | null;
  trazados: Array<{ sentido: Sentido; coordenadas: Array<[number, number]>; largo_m: number }>;
}
