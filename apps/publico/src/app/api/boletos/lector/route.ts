import { NextResponse } from "next/server";
import { llavePublicaBienFormada } from "@jtel/domain";
import { getRepos } from "@/lib/db";

/**
 * **¿Quién soy?** — Ontoy 3.0 · PR P3.5.
 *
 * Un lector nace con un par de llaves y sin nombre. Alguien lo da de alta en
 * J-Tel con su llave pública; el aparato se entera de su propio nombre
 * preguntando por ella la primera vez que tiene señal.
 *
 * ## Por qué esto no es una puerta
 *
 * Contesta sobre **la llave que le enseñes**, y la llave de un lector sólo la
 * tiene ese lector. No se puede listar, no se puede recorrer y no dice nada de
 * ningún otro aparato. Un desconocido con una llave inventada recibe 404, que
 * es lo mismo que recibiría un lector que todavía nadie registró.
 *
 * **De un lector dado de baja se contesta 404 también.** No es esconder: es
 * que la pregunta «¿cómo me llamo?» ya no tiene respuesta útil —su llave está
 * revocada y sus lotes se van a rechazar— y decirle su nombre sólo lo haría
 * creer que puede entregar.
 *
 * No devuelve la cuenta, ni la unidad, ni el circuito. El aparato no los
 * necesita para entregar, y lo que no se manda no se puede filtrar.
 */
export async function GET(request: Request) {
  const llave = new URL(request.url).searchParams.get("llave") ?? "";
  if (!llavePublicaBienFormada(llave)) {
    return json({ error: "llave_mal_formada" }, 400);
  }

  const lector = await getRepos().libroDeBoletos.lectorPorLlave(llave);
  if (!lector || lector.bajaEn) {
    return json({ error: "sin_registrar" }, 404);
  }

  return json({ lector_id: lector.id, label: lector.label });
}

function json(cuerpo: unknown, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { "cache-control": "no-store" } });
}
