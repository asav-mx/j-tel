import { NextResponse } from "next/server";
import { darDeAltaDispositivo } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { rutasDeDispositivos } from "@/lib/casa/dispositivos";

/**
 * Las acciones sobre dispositivos desde la casa nueva (C4).
 *
 * Es un formulario HTML: contesta con 303 de vuelta a la pantalla, con el error
 * en palabras de quien captura (`?error=`) o con el hecho (`?hecho=`). El hecho
 * sólo nombra **qué** pasó; la pantalla lo cuenta leyendo la base, así que una
 * dirección editada a mano no le hace decir nada falso.
 *
 * ## Dos preguntas, como en el papel
 *
 * 1. **La guardia** (`carrier-maneja-flota`): perteneces al carrier de
 *    `account` *y* tu rol actúa sobre su flota. Despacho pertenece y no pasa.
 * 2. **El muro, en services:** el dispositivo y la unidad que mandas son de esa
 *    cuenta. Un id ajeno responde igual que uno que no existe.
 *
 * Quién actuó (`por`) sale de la sesión, nunca del formulario.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const cuenta = String(form.get("account") ?? "").trim();
  const accion = String(form.get("accion") ?? "");

  const cuarto = rutasDeDispositivos.cuarto(cuenta || null);
  const g = await exigir(request, { tipo: "carrier-maneja-flota", slug: cuenta }, { redirigirA: cuarto });
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(cuenta);
  if (!carrier || carrier.type !== "carrier") {
    return volver(request, cuarto, { error: "La cuenta no existe." });
  }

  if (accion === "alta") {
    const imeiCapturado = String(form.get("imei") ?? "");
    const r = await darDeAltaDispositivo(repos, {
      carrierId: carrier.id,
      imeiCapturado,
      prefijo: String(form.get("prefijo") ?? ""),
    });
    if (!r.ok) {
      // Lo tecleado regresa con el aviso: equivocarse en un dígito no cuesta
      // volver a copiar los quince.
      return volver(request, rutasDeDispositivos.cuarto(cuenta, { accion: "alta" }), {
        error: r.mensaje,
        imei: imeiCapturado.slice(0, 40),
      });
    }
    return volver(request, rutasDeDispositivos.cuarto(cuenta, { hecho: "alta", dispositivo: r.deviceId }));
  }

  return volver(request, cuarto, { error: "Esa acción no existe." });
}

function volver(request: Request, ruta: string, extra: Record<string, string> = {}) {
  const destino = new URL(ruta, request.url);
  for (const [k, v] of Object.entries(extra)) destino.searchParams.set(k, v);
  return NextResponse.redirect(destino, 303);
}
