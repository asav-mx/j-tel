import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { CAMPOS_DE_REGLA, revisarRegla, rutasDelCatalogo } from "@/lib/casa/regla";

/**
 * Guardar la regla de un tipo de papel: una versión nueva, con su autor y su
 * nota (D2). Nunca edita: la base rechaza el UPDATE desde la 0038.
 *
 * Sólo J-Staff: el catálogo es la ley de un mercado, no la preferencia de un
 * carrier. Mientras la matriz fina 6.29 siga abierta, cualquier J-Staff edita, y
 * su id queda en la versión.
 *
 * Se revisa otra vez con la misma función que usó la pantalla de «revisar el
 * cambio»: lo que se guarda es exactamente lo que se revisó, o nada.
 *
 * Es un formulario HTML: los errores regresan a «editar» como aviso, con lo
 * tecleado.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const tipoId = String(form.get("tipoId") ?? "").trim();
  const campos = Object.fromEntries(CAMPOS_DE_REGLA.map((c) => [c, String(form.get(c) ?? "")]));

  const g = await exigir(request, { tipo: "jstaff" }, { redirigirA: rutasDelCatalogo.catalogo() });
  if (!g.ok) return g.respuesta;

  const aEditar = (error: string) =>
    NextResponse.redirect(new URL(rutasDelCatalogo.accion(tipoId, "editar", campos, error), request.url), 303);

  if (!tipoId) return NextResponse.redirect(new URL(rutasDelCatalogo.catalogo(), request.url), 303);

  const revisada = revisarRegla((c) => campos[c]);
  if (!revisada.ok) return aEditar(revisada.error);

  const repos = getRepos();
  const tipo = await repos.expedientes.tipoDeDocumento(tipoId);
  if (!tipo) return NextResponse.redirect(new URL(rutasDelCatalogo.catalogo(), request.url), 303);

  await repos.expedientes.agregarVersionDeRegla(tipoId, revisada.escrita.regla, {
    kind: "human",
    id: g.identidad.userId,
    nota: revisada.escrita.nota,
  });

  return NextResponse.redirect(new URL(rutasDelCatalogo.tipo(tipoId), request.url), 303);
}
