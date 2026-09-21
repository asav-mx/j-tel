import { NextResponse } from "next/server";
import { asignarUnidadACircuito, soltarUnidadDeCircuito } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { rutasDeCircuito } from "@/lib/casa/circuitos";

/**
 * El carrier asigna y suelta sus unidades en un circuito, desde Ver ‹circuito›
 * (ficha de huecos de «asignar unidad», PR 2).
 *
 * Es un formulario HTML, como las acciones de dispositivo: contesta con 303 de
 * vuelta a la pantalla, con el error en palabras de quien captura (`?error=`) o
 * con el hecho (`?hecho=`). La pantalla cuenta el hecho leyendo la base.
 *
 * ## Tres preguntas
 *
 * 1. **La guardia** (`carrier-maneja-flota`): perteneces al carrier de
 *    `account` *y* tu rol actúa sobre su flota. Despacho pertenece y no pasa.
 * 2. **El muro, en services:** la unidad es de esa cuenta y la concesión del
 *    circuito la tiene ligada; la asignación que se suelta es suya y de ESTE
 *    circuito. Un id ajeno responde igual que uno que no existe.
 * 3. **El aviso:** jalar una unidad de otro circuito exige que el formulario
 *    confirme cuál se cierra (`confirmaCierreDe`).
 *
 * Quién actuó (`por`) sale de la sesión, nunca del formulario. El poder de
 * J-Staff sigue en `/api/jstaff/circuitos/[id]/unidades`, sin cambios.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const cuenta = String(form.get("account") ?? "").trim();
  const accion = String(form.get("accion") ?? "");
  const circuitId = String(form.get("circuitId") ?? "").trim();

  const cuarto = rutasDeCircuito.cuarto(cuenta || null);
  const g = await exigir(request, { tipo: "carrier-maneja-flota", slug: cuenta }, { redirigirA: cuarto });
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(cuenta);
  if (!carrier || carrier.type !== "carrier") return volver(request, cuarto, { error: "La cuenta no existe." });
  if (!circuitId) return volver(request, cuarto, { error: "Esa acción no existe." });

  // Un circuito que esta cuenta no ve se contesta desde el cuarto: su ficha es
  // un 404 y el aviso no se vería nunca.
  const visible = await repos.circuits.getCircuitVisibleParaCuenta(carrier.id, circuitId);
  if (!visible) return volver(request, cuarto, { error: "Ese circuito no es de esta cuenta." });
  const ficha = (params: Parameters<typeof rutasDeCircuito.ver>[2] = {}) =>
    rutasDeCircuito.ver(circuitId, cuenta, params);

  // La guardia ya exigió sesión; sin un quién no se escribe una historia que
  // prometió guardar quién (0048).
  const por = g.identidad.userId;
  if (!por) return volver(request, cuarto, { error: "Inicia sesión." });

  if (accion === "asignar") {
    const unitId = String(form.get("unitId") ?? "").trim();
    const r = await asignarUnidadACircuito(repos, {
      carrierId: carrier.id,
      circuitId,
      unitId,
      confirmaCierreDe: String(form.get("confirmaCierreDe") ?? "").trim() || null,
      por,
    });
    if (!r.ok) return volver(request, ficha({ accion: "asignar" }), { error: r.mensaje });
    return volver(request, ficha({ hecho: "asignada", unidad: unitId }));
  }

  if (accion === "soltar") {
    const assignmentId = String(form.get("assignmentId") ?? "").trim();
    const motivo = String(form.get("motivo") ?? "");
    const r = await soltarUnidadDeCircuito(repos, { carrierId: carrier.id, circuitId, assignmentId, motivo, por });
    if (!r.ok) {
      return volver(request, ficha({ accion: "soltar", asignacion: assignmentId }), {
        error: r.mensaje,
        motivo: motivo.slice(0, 600),
      });
    }
    return volver(request, ficha({ hecho: "soltada", unidad: r.unidadId }));
  }

  return volver(request, ficha(), { error: "Esa acción no existe." });
}

function volver(request: Request, ruta: string, extra: Record<string, string> = {}) {
  const destino = new URL(ruta, request.url);
  for (const [k, v] of Object.entries(extra)) destino.searchParams.set(k, v);
  return NextResponse.redirect(destino, 303);
}
