import { NextResponse } from "next/server";
import { JTTEL_TZ } from "@jtel/domain";
import { pausarVerificacion } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { rutasDeContratos } from "@/lib/casa/contratos";

/**
 * Pausar la verificación de un contrato (0041). Sólo el admin de plataforma.
 *
 * Se revisa otra vez con la misma función que armó la vista previa: lo que se
 * escribe es lo que se revisó, o nada. El evento y el borrado de las
 * ocurrencias sin hecho van en una sola transacción.
 *
 * Es un formulario HTML: los errores regresan a «pausar» como aviso, con lo
 * tecleado.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const contractId = String(form.get("contractId") ?? "").trim();
  const campos = { fecha: String(form.get("fecha") ?? "").trim(), motivo: String(form.get("motivo") ?? "") };

  const g = await exigir(request, { tipo: "jstaff-pausa-verificacion" }, { redirigirA: rutasDeContratos.lista() });
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const contrato = contractId ? await repos.pausas.contrato(contractId) : null;
  if (!contrato) return NextResponse.redirect(new URL(rutasDeContratos.lista(), request.url), 303);

  const r = await pausarVerificacion(repos, {
    contractId,
    fechaIso: campos.fecha,
    motivo: campos.motivo,
    zona: contrato.zona ?? JTTEL_TZ,
    ahora: new Date(),
    actor: { kind: "human", id: g.identidad.userId },
  });
  if (!r.ok) {
    return NextResponse.redirect(new URL(rutasDeContratos.accion(contractId, "pausar", campos, r.mensaje), request.url), 303);
  }
  return NextResponse.redirect(new URL(rutasDeContratos.contrato(contractId), request.url), 303);
}
