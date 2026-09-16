import { NextResponse } from "next/server";
import { FojaFueraDeCatalogo } from "@jtel/db";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { revisarCaptura, type AccionDePapel } from "@/lib/casa/captura";
import { rutas } from "@/lib/casa/expedientes";

/**
 * Capturar, renovar o corregir un papel de una unidad.
 *
 * - **capturar** y **renovar** crean una foja nueva. Son la misma escritura; se
 *   distinguen en pantalla porque renovar deja la anterior en el historial.
 * - **corregir** agrega una versión nueva a la foja vigente. La anterior queda
 *   con su autor.
 *
 * Nada se edita en sitio: la base rechaza el UPDATE (0038).
 *
 * ## Dos preguntas, como en `/api/carrier/assign`
 *
 * La guardia demuestra que perteneces al carrier de `account`. Eso no dice nada
 * de los ids que mandas, así que la unidad y la foja se comprueban contra esa
 * cuenta. La base sostiene el mismo muro con una llave compuesta, por si alguien
 * se saltara esta ruta.
 *
 * Es un formulario HTML: los errores regresan al formulario como aviso legible
 * (`?error=`), no como JSON crudo en una pestaña en blanco.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const cuenta = String(form.get("account") ?? "").trim();
  const accion = String(form.get("accion") ?? "") as AccionDePapel;
  const unitId = String(form.get("unitId") ?? "").trim();
  const tipoId = String(form.get("tipoId") ?? "").trim();
  const documentId = String(form.get("documentId") ?? "").trim();

  const papel = rutas.papel(unitId, tipoId, cuenta || null);
  const alFormulario = (error: string) => {
    const destino = new URL(rutas.papel(unitId, tipoId, cuenta || null, accion), request.url);
    destino.searchParams.set("error", error);
    // Lo que se tecleó regresa con el aviso: equivocarse en una fecha no
    // cuesta volver a escribir el papel entero.
    for (const campo of ["folio", "emitidoEl", "venceEl", "nota"]) {
      const valor = form.get(campo);
      if (typeof valor === "string" && valor.trim()) destino.searchParams.set(campo, valor.slice(0, 600));
    }
    return NextResponse.redirect(destino, 303);
  };

  const g = await exigir(request, { tipo: "carrier", slug: cuenta }, { redirigirA: rutas.cuarto(cuenta || null) });
  if (!g.ok) return g.respuesta;

  if (!["capturar", "renovar", "corregir"].includes(accion) || !unitId || !tipoId) {
    return alFormulario("Faltan datos del papel. Vuelve a abrirlo desde su unidad.");
  }

  const revisada = revisarCaptura(form);
  if (!revisada.ok) return alFormulario(revisada.error);

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(cuenta);
  if (!carrier) return alFormulario("La cuenta no existe.");

  const unidad = await repos.expedientes.unidadDeCuenta(carrier.id, unitId);
  if (!unidad) return alFormulario("Esa unidad no es de esta cuenta.");

  const actor = { kind: "human", id: g.identidad.userId, nota: revisada.datos.nota };
  const datos = {
    folio: revisada.datos.folio,
    emitidoEl: revisada.datos.emitidoEl,
    venceElImpreso: revisada.datos.venceElImpreso,
  };

  try {
    if (accion === "corregir") {
      if (!documentId) return alFormulario("No se sabe qué foja corregir. Vuelve a abrir el papel.");
      const fojas = await repos.expedientes.fojasDeSujeto(carrier.id, { unidadId: unitId });
      const foja = fojas.find((f) => f.foja.id === documentId);
      // La foja tiene que ser de esta unidad y de este tipo, y ser la vigente:
      // corregir una foja vieja reescribiría una renovación ya superada.
      const vigenteDelTipo = fojas.find((f) => f.foja.documentTypeId === tipoId);
      if (!foja || foja.foja.documentTypeId !== tipoId || vigenteDelTipo?.foja.id !== documentId) {
        return alFormulario("Sólo se corrige la foja vigente de este papel.");
      }
      const version = await repos.expedientes.corregirFoja({ carrierAccountId: carrier.id, documentId, datos, actor });
      if (!version) return alFormulario("Esa foja no es de esta cuenta.");
    } else {
      await repos.expedientes.capturarFoja({
        carrierAccountId: carrier.id,
        documentTypeId: tipoId,
        sujeto: { unidadId: unitId },
        datos,
        actor,
      });
    }
  } catch (e) {
    if (e instanceof FojaFueraDeCatalogo) return alFormulario(e.message);
    throw e;
  }

  return NextResponse.redirect(new URL(papel, request.url), 303);
}
