import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

/**
 * **¿Ya se usó mi boleto?** — Ontoy 3.0 · PR P3.5.
 *
 * Lo que cierra el ciclo del pasajero. El teléfono enseñó el pase y se quedó
 * sin saber si lo dejaron subir —el lector no le habla al celular—, así que
 * cuando hay señal pregunta por los suyos.
 *
 * ## Lo que el pase pregunta, y lo que no
 *
 * **Sólo los folios en uso** (decisión de Asav, 23-sep-2026, e1): los que
 * enseñó y nadie confirmó. Los que todavía no ha usado no se nombran —no hay
 * nada que preguntar de ellos— y los ya confirmados tampoco.
 *
 * **Va por POST** aunque sea una lectura, y no es capricho: en un GET los
 * folios viajan en la ruta, y las rutas acaban en el registro del servidor, en
 * el del CDN y en el historial del navegador. En el cuerpo, no.
 *
 * ## Lo que el servidor NO guarda de esta consulta
 *
 * Nada. Ni la lista, ni un contador, ni quién preguntó. Esta ruta no escribe
 * una sola fila, y ésa es la mitad de la decisión (e1): el pase pregunta por
 * sus folios sin que quede la liga entre ellos.
 *
 * ## Por qué un reclamo dictado no cuenta
 *
 * `foliosQuemados` sólo mira los quemados con firma verificada. Un reclamo
 * dictado es alguien diciendo ocho dígitos en voz alta: si confirmara, quien
 * leyera tu folio por encima del hombro podría gastarte el viaje desde otro
 * camión. El pase se queda en «sin confirmar», que es la verdad.
 */
export async function POST(request: Request) {
  let cuerpo: { folios?: unknown };
  try {
    cuerpo = (await request.json()) as { folios?: unknown };
  } catch {
    return json({ error: "cuerpo_ilegible" }, 400);
  }

  const folios = cuerpo.folios;
  if (!Array.isArray(folios) || folios.some((f) => typeof f !== "string")) {
    return json({ error: "folios_mal_formados" }, 400);
  }
  /*
   * Un pase con cien viajes en el aire no existe: son los que enseñaste y nadie
   * confirmó. El tope está para que la consulta no se vuelva un barrido de
   * folios ajenos —preguntar por diez mil sería buscar cuáles existen.
   */
  if (folios.length > 50) return json({ error: "demasiados_folios" }, 413);

  const quemados = await getRepos().libroDeBoletos.foliosQuemados(folios as string[]);
  return json({ quemados });
}

function json(cuerpo: unknown, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { "cache-control": "no-store" } });
}
