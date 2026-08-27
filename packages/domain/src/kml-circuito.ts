/**
 * Lectura de KML para circuitos, **capa por capa**.
 *
 * ## Por qué no sirve `parseKmlWaypoints`
 *
 * El helper que ya existe aplana TODOS los bloques `<coordinates>` del archivo
 * en una sola lista. Para un KML de circuito eso es un error silencioso: el del
 * circuito 1 trae cuatro trazos —dos de ida y dos de regreso, en dos
 * resoluciones— más cuatro puntos de terminal, y aplanarlos produce una
 * polilínea de 1 349 vértices que salta de una punta a otra de la ciudad.
 *
 * ## Qué hace éste, y qué NO hace
 *
 * Devuelve cada capa por separado con las medidas que permiten **a una persona**
 * decidir cuál es ida y cuál regreso. **No decide.** Nunca elige por nombre de
 * capa: el archivo de mañana puede llamarlas de otro modo, y un concesionario
 * invitado va a subir el suyo con las convenciones de quien se lo dibujó.
 *
 * Medido en el circuito 1 el 26 de agosto de 2026: las capas buenas tienen
 * espaciado mediano de 19 y 25 m; las burdas, de 90 y 119 m con saltos de hasta
 * 874 m. A esa resolución el trazado corta esquinas y el «en circuito» miente.
 * Por eso las medidas viajan con la capa: hacen visible cuál no sirve.
 */

export interface CapaKml {
  /** Nombre del Placemark, tal cual viene. Para mostrar, no para decidir. */
  nombre: string;
  /** Carpeta que la contiene, si el archivo las usa. */
  carpeta: string | null;
  coordenadas: Array<[number, number]>;
  puntos: number;
  largoMetros: number;
  espaciadoMedianoMetros: number;
  huecoMaximoMetros: number;
  inicio: { lat: number; lon: number };
  fin: { lat: number; lon: number };
  /**
   * Verdadero cuando otra capa recorre el mismo corredor con mucho más detalle.
   *
   * Vive en el dato y no en la pantalla a propósito: el 26 de agosto de 2026 se
   * guardaron las capas burdas del circuito 1 porque la lista las mostraba
   * primero, con botones idénticos a los de las buenas, y el aviso vivía en otra
   * caja. Marcar la capa hace que la pantalla no pueda presentarlas como iguales.
   */
  cortaEsquinas: boolean;
}

export interface PuntoKml {
  nombre: string;
  carpeta: string | null;
  lat: number;
  lon: number;
}

export interface AnalisisKml {
  capas: CapaKml[];
  /** Placemarks de un solo punto: terminales, referencias. Candidatos a parada. */
  puntos: PuntoKml[];
  /** Lo que una persona debería mirar antes de escoger. Nunca bloquean. */
  avisos: string[];
}

const RADIO_TIERRA_M = 6_371_000;

export function metrosEntre(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const f1 = a.lat * rad;
  const f2 = b.lat * rad;
  const df = (b.lat - a.lat) * rad;
  const dl = (b.lon - a.lon) * rad;
  const h = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function mediana(xs: number[]): number {
  if (xs.length === 0) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

function textoDe(bloque: string, etiqueta: string): string | null {
  const m = bloque.match(new RegExp(`<${etiqueta}[^>]*>([\\s\\S]*?)</${etiqueta}>`, "i"));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null;
}

function coordenadasDe(texto: string): Array<[number, number]> {
  const salida: Array<[number, number]> = [];
  for (const token of texto.trim().split(/\s+/)) {
    if (!token) continue;
    const partes = token.split(",");
    if (partes.length < 2) continue;
    const lon = Number(partes[0]);
    const lat = Number(partes[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    salida.push([lon, lat]);
  }
  return salida;
}

/** Con qué carpeta se queda cada Placemark, por posición en el archivo. */
function carpetaEn(xml: string, posicion: number): string | null {
  let carpeta: string | null = null;
  const re = /<Folder\b[^>]*>|<\/Folder>|<name[^>]*>([\s\S]*?)<\/name>/gi;
  const pila: Array<string | null> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m.index >= posicion) break;
    if (m[0].startsWith("</Folder")) pila.pop();
    else if (m[0].startsWith("<Folder")) pila.push(null);
    else if (pila.length > 0 && pila[pila.length - 1] === null) {
      pila[pila.length - 1] = m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    }
    carpeta = pila.length > 0 ? pila[pila.length - 1] : null;
  }
  return carpeta;
}

export function analizarKmlDeCircuito(xml: string): AnalisisKml {
  const capas: CapaKml[] = [];
  const puntos: PuntoKml[] = [];
  const avisos: string[] = [];

  const re = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi;
  let m: RegExpExecArray | null;
  let sinNombre = 0;

  while ((m = re.exec(xml)) !== null) {
    const bloque = m[1];
    const nombre = textoDe(bloque, "name") ?? `(sin nombre ${++sinNombre})`;
    const carpeta = carpetaEn(xml, m.index);

    const linea = bloque.match(/<LineString[\s\S]*?<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
    if (linea) {
      const coordenadas = coordenadasDe(linea[1]);
      if (coordenadas.length < 2) {
        avisos.push(`La capa "${nombre}" tiene menos de dos puntos y no se puede usar como trazado.`);
        continue;
      }
      const saltos: number[] = [];
      for (let i = 1; i < coordenadas.length; i++) {
        saltos.push(
          metrosEntre(
            { lat: coordenadas[i - 1][1], lon: coordenadas[i - 1][0] },
            { lat: coordenadas[i][1], lon: coordenadas[i][0] },
          ),
        );
      }
      capas.push({
        cortaEsquinas: false,
        nombre,
        carpeta,
        coordenadas,
        puntos: coordenadas.length,
        largoMetros: saltos.reduce((a, b) => a + b, 0),
        espaciadoMedianoMetros: mediana(saltos),
        huecoMaximoMetros: Math.max(...saltos),
        inicio: { lat: coordenadas[0][1], lon: coordenadas[0][0] },
        fin: {
          lat: coordenadas[coordenadas.length - 1][1],
          lon: coordenadas[coordenadas.length - 1][0],
        },
      });
      continue;
    }

    const punto = bloque.match(/<Point[\s\S]*?<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
    if (punto) {
      const c = coordenadasDe(punto[1]);
      if (c.length > 0) puntos.push({ nombre, carpeta, lat: c[0][1], lon: c[0][0] });
    }
  }

  if (capas.length === 0) avisos.push("El archivo no trae ningún trazado utilizable.");

  // Dos capas que cubren casi el mismo largo con muy distinta resolución son el
  // mismo recorrido dibujado dos veces. Avisar cuál es la fina evita que alguien
  // escoja la burda sin darse cuenta.
  for (let i = 0; i < capas.length; i++) {
    for (let j = i + 1; j < capas.length; j++) {
      const a = capas[i];
      const b = capas[j];
      const largoParecido = Math.abs(a.largoMetros - b.largoMetros) / Math.max(a.largoMetros, b.largoMetros) < 0.1;
      const resolucionDistinta = Math.max(a.puntos, b.puntos) >= Math.min(a.puntos, b.puntos) * 2;
      if (largoParecido && resolucionDistinta) {
        const fina = a.puntos > b.puntos ? a : b;
        const burda = a.puntos > b.puntos ? b : a;
        burda.cortaEsquinas = true;
        avisos.push(
          `"${fina.nombre}" y "${burda.nombre}" recorren lo mismo con distinto detalle ` +
            `(${fina.puntos} contra ${burda.puntos} puntos). La de menos puntos corta esquinas: ` +
            `su hueco máximo es de ${Math.round(burda.huecoMaximoMetros)} m contra ` +
            `${Math.round(fina.huecoMaximoMetros)} m.`,
        );
      }
    }
  }

  // Las capas se devuelven con las utilizables primero y, dentro de cada grupo,
  // la de más detalle arriba. El orden del archivo no dice nada sobre la calidad
  // del trazado, y dejarlo mandar fue lo que hizo que se guardara la burda.
  capas.sort((a, b) => {
    if (a.cortaEsquinas !== b.cortaEsquinas) return a.cortaEsquinas ? 1 : -1;
    return b.puntos - a.puntos;
  });

  return { capas, puntos, avisos };
}
