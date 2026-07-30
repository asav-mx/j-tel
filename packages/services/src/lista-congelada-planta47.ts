/**
 * Lee la lista congelada de las 300 ocurrencias (Planta 47, bug de zona
 * horaria) directo del CSV embebido en
 * docs/correcciones/2026-07-30-lista-congelada-planta47.md — no se
 * regenera el criterio de selección aquí, se lee tal cual quedó guardado
 * (§4 de la ficha). Compartido por todo lo que necesite el mismo alcance:
 * el simulador de 300 y el análisis de KML sospechoso.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const LISTA_CONGELADA_PATH = resolve(
  __dirname,
  "../../../docs/correcciones/2026-07-30-lista-congelada-planta47.md",
);

export type FilaLista = {
  occurrenceId: string;
  serviceDate: string;
  ruta: string;
  turno: string;
  factIdEsperado: string;
  estadoActual: string;
};

export function leerListaCongelada(): FilaLista[] {
  const contenido = readFileSync(LISTA_CONGELADA_PATH, "utf-8");
  const lineas = contenido.split("\n");
  const inicio = lineas.findIndex((l) => l.trim() === "```csv");
  const fin = lineas.indexOf("```", inicio + 1);
  if (inicio === -1 || fin === -1) {
    throw new Error(`No se encontró el bloque \`\`\`csv en ${LISTA_CONGELADA_PATH}`);
  }
  const filas = lineas.slice(inicio + 1, fin).filter((l) => l.trim().length > 0);
  const header = filas[0]!.split(",");
  const idx = (col: string) => header.indexOf(col);

  return filas.slice(1).map((linea) => {
    const cols = linea.split(",");
    return {
      occurrenceId: cols[idx("occurrence_id")]!,
      serviceDate: cols[idx("service_date")]!,
      ruta: cols[idx("ruta")]!,
      turno: cols[idx("turno")]!,
      factIdEsperado: cols[idx("fact_id")]!,
      estadoActual: cols[idx("estado_actual")]!,
    };
  });
}
