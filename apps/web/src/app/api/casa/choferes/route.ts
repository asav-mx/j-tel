import { NextResponse } from "next/server";
import { corregirChofer, darDeAltaChofer } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { rutas } from "@/lib/casa/expedientes";
import { rutaDelCajon } from "@/lib/casa/archivero";

/**
 * Dar de alta y corregir un chofer desde la casa nueva (Choferes V1).
 *
 * Es un formulario HTML, igual que el de la unidad (C4-e): contesta con 303 de
 * vuelta a la pantalla, con el error en palabras de quien captura (`?error=`) y
 * lo que tecleó para no volver a escribirlo, o con el hecho (`?hecho=`). La
 * pantalla cuenta el hecho leyendo la base.
 *
 * ## Dos preguntas, como en la unidad
 *
 * 1. **La guardia** (`carrier-maneja-flota`): perteneces al carrier de
 *    `account` *y* tu rol actúa sobre su flota. Despacho pertenece y no pasa.
 * 2. **El muro, en services:** el chofer que se corrige es de esa cuenta. Uno
 *    ajeno responde igual que uno que no existe.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const cuenta = String(form.get("account") ?? "").trim();
  const accion = String(form.get("accion") ?? "");

  // El alta vive en el cajón Choferes del archivero: ahí regresa.
  const cajon = rutaDelCajon("choferes", cuenta || null);
  const g = await exigir(request, { tipo: "carrier-maneja-flota", slug: cuenta }, { redirigirA: cajon });
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(cuenta);
  if (!carrier || carrier.type !== "carrier") return volver(request, cajon, { error: "La cuenta no existe." });

  const capturado = {
    nombre: String(form.get("nombre") ?? ""),
    licencia: String(form.get("licencia") ?? ""),
    venceEl: String(form.get("venceEl") ?? ""),
  };
  const deVuelta = {
    nombre: capturado.nombre.slice(0, 140),
    licencia: capturado.licencia.slice(0, 40),
    venceEl: capturado.venceEl.slice(0, 10),
  };
  const actor = { kind: "human", id: g.identidad.userId };

  if (accion === "alta") {
    const r = await darDeAltaChofer(repos, { carrierId: carrier.id, ...capturado, actor });
    if (!r.ok) return volver(request, cajon, { accion: "alta-chofer", error: r.mensaje, ...deVuelta });
    return volver(request, rutas.chofer(r.driverId, cuenta), { hecho: "alta" });
  }

  if (accion === "corregir") {
    const driverId = String(form.get("driverId") ?? "").trim();
    const r = await corregirChofer(repos, { carrierId: carrier.id, driverId, nombre: capturado.nombre, licencia: capturado.licencia, actor });
    if (!r.ok) {
      // Si el chofer no es de esta cuenta, su ficha es un 404 y el aviso no se
      // vería nunca: se vuelve al cajón, que sí lo dibuja.
      if (r.error === "chofer_no_encontrado") return volver(request, cajon, { error: r.mensaje });
      return volver(request, rutas.chofer(driverId, cuenta), { accion: "corregir", error: r.mensaje, nombre: deVuelta.nombre, licencia: deVuelta.licencia });
    }
    return volver(request, rutas.chofer(r.driverId, cuenta), { hecho: "corregido" });
  }

  return volver(request, cajon, { error: "Esa acción no existe." });
}

function volver(request: Request, ruta: string, extra: Record<string, string> = {}) {
  const destino = new URL(ruta, request.url);
  for (const [k, v] of Object.entries(extra)) destino.searchParams.set(k, v);
  return NextResponse.redirect(destino, 303);
}
