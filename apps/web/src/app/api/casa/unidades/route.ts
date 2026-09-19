import { NextResponse } from "next/server";
import { corregirUnidad, darDeAltaUnidad } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { rutas } from "@/lib/casa/expedientes";

/**
 * Dar de alta y corregir una unidad desde la casa nueva (C4-e).
 *
 * Es un formulario HTML, igual que las acciones de dispositivo: contesta con
 * 303 de vuelta a la pantalla, con el error en palabras de quien captura
 * (`?error=`) y lo que tecleó para no volver a escribirlo, o con el hecho
 * (`?hecho=`). La pantalla cuenta el hecho leyendo la base.
 *
 * ## Dos preguntas, como en el papel
 *
 * 1. **La guardia** (`carrier-maneja-flota`): perteneces al carrier de
 *    `account` *y* tu rol actúa sobre su flota. Despacho pertenece y no pasa.
 * 2. **El muro, en services:** la unidad que se corrige es de esa cuenta. Una
 *    ajena responde igual que una que no existe.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const cuenta = String(form.get("account") ?? "").trim();
  const accion = String(form.get("accion") ?? "");

  const cuarto = rutas.cuarto(cuenta || null);
  const g = await exigir(request, { tipo: "carrier-maneja-flota", slug: cuenta }, { redirigirA: cuarto });
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(cuenta);
  if (!carrier || carrier.type !== "carrier") return volver(request, cuarto, { error: "La cuenta no existe." });

  const capturado = {
    nombre: String(form.get("nombre") ?? ""),
    placa: String(form.get("placa") ?? ""),
    vin: String(form.get("vin") ?? ""),
  };
  // Lo tecleado regresa con el aviso: equivocarse en un carácter del VIN no
  // cuesta volver a copiar los diecisiete.
  const deVuelta = {
    nombre: capturado.nombre.slice(0, 60),
    placa: capturado.placa.slice(0, 30),
    vin: capturado.vin.slice(0, 40),
  };

  if (accion === "alta") {
    const r = await darDeAltaUnidad(repos, { carrierId: carrier.id, ...capturado });
    if (!r.ok) return volver(request, cuarto, { accion: "alta-unidad", error: r.mensaje, ...deVuelta });
    return volver(request, rutas.unidad(r.unitId, cuenta), { hecho: "alta" });
  }

  if (accion === "corregir") {
    const unitId = String(form.get("unitId") ?? "").trim();
    const r = await corregirUnidad(repos, { carrierId: carrier.id, unitId, ...capturado });
    if (!r.ok) {
      // Si la unidad no es de esta cuenta, su ficha es un 404 y el aviso no se
      // vería nunca: se vuelve al cuarto, que sí lo dibuja.
      if (r.error === "unidad_no_encontrada") return volver(request, cuarto, { error: r.mensaje });
      return volver(request, rutas.unidad(unitId, cuenta), { accion: "corregir", error: r.mensaje, ...deVuelta });
    }
    return volver(request, rutas.unidad(r.unitId, cuenta), { hecho: "corregida" });
  }

  return volver(request, cuarto, { error: "Esa acción no existe." });
}

function volver(request: Request, ruta: string, extra: Record<string, string> = {}) {
  const destino = new URL(ruta, request.url);
  for (const [k, v] of Object.entries(extra)) destino.searchParams.set(k, v);
  return NextResponse.redirect(destino, 303);
}
