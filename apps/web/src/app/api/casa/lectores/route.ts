import { NextResponse } from "next/server";
import { asignarLector, darDeAltaLector, darDeBajaLector, soltarLector } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { rutasDeLectores } from "@/lib/casa/lectores";

/**
 * Las acciones sobre un lector, desde J-Staff.
 *
 * Formulario HTML de verdad: contesta con 303 de vuelta a la pantalla, con el
 * error **en palabras de quien captura** (`?error=`) o con el hecho
 * (`?hecho=`). El hecho sólo nombra **qué** pasó; la pantalla lo cuenta
 * leyendo la base, así que una dirección editada a mano no le hace decir nada
 * falso. Igual que `/api/casa/dispositivos`.
 *
 * **Una sola guardia, y es la de J-Staff**: los lectores son de la plataforma,
 * y la concesión de Ontoy es J-Tel. El muro que sí se aplica —que un lector no
 * se monte en el camión de otro transportista— vive en `@jtel/services`, donde
 * se puede probar sin una sesión.
 *
 * Quién actuó (`por`) sale de la sesión, nunca del formulario.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const accion = String(form.get("accion") ?? "");
  const cuarto = rutasDeLectores.cuarto();

  const g = await exigir(request, { tipo: "jstaff" }, { redirigirA: cuarto });
  if (!g.ok) return g.respuesta;

  /* La guardia ya exigió sesión; sin un quién no se escribe una historia que
     prometió guardar quién. */
  const por = g.identidad.userId;
  if (!por) return volver(request, cuarto, { error: "Inicia sesión." });

  const repos = getRepos();
  const ahora = new Date();

  if (accion === "alta") {
    const llaveCapturada = String(form.get("llave") ?? "");
    const r = await darDeAltaLector(repos, {
      carrierId: String(form.get("carrier") ?? "").trim(),
      llaveCapturada,
      unitId: String(form.get("unitId") ?? "").trim() || null,
      por,
    });
    if (!r.ok) {
      /* Lo tecleado regresa con el aviso: equivocarse en un carácter no cuesta
         volver a copiar los sesenta y cuatro. */
      return volver(request, rutasDeLectores.cuarto({ accion: "alta" }), {
        error: r.mensaje,
        llave: llaveCapturada.slice(0, 80),
      });
    }
    return volver(request, rutasDeLectores.cuarto({ hecho: "alta", lector: r.lectorId }));
  }

  const lectorId = String(form.get("lectorId") ?? "").trim();
  if (!lectorId) return volver(request, cuarto, { error: "Esa acción no existe." });
  const ficha = (params: Parameters<typeof rutasDeLectores.ver>[1] = {}) =>
    rutasDeLectores.ver(lectorId, params);

  if (accion === "asignar") {
    const r = await asignarLector(repos, {
      lectorId,
      unitId: String(form.get("unitId") ?? "").trim(),
      por,
      ahora,
    });
    if (!r.ok) return alFallar(request, r.error, r.mensaje, cuarto, ficha);
    return volver(request, ficha({ hecho: "asignado" }));
  }

  if (accion === "soltar" || accion === "baja") {
    const motivo = String(form.get("motivo") ?? "");
    const r =
      accion === "soltar"
        ? await soltarLector(repos, { lectorId, motivo, por, ahora })
        : await darDeBajaLector(repos, { lectorId, motivo, por, ahora });
    if (!r.ok) return alFallar(request, r.error, r.mensaje, cuarto, ficha);
    return volver(request, ficha({ hecho: accion === "soltar" ? "soltado" : "baja" }));
  }

  return volver(request, cuarto, { error: "Esa acción no existe." });
}

/**
 * Un lector que no existe no tiene ficha, y su aviso no se vería nunca: se
 * vuelve al cuarto, que sí la dibuja.
 */
function alFallar(
  request: Request,
  error: string,
  mensaje: string,
  cuarto: string,
  ficha: (params?: { error?: string; hecho?: string }) => string,
) {
  return error === "lector_no_encontrado"
    ? volver(request, cuarto, { error: mensaje })
    : volver(request, ficha({ error: mensaje }));
}

function volver(request: Request, ruta: string, extra: Record<string, string> = {}) {
  const destino = new URL(ruta, request.url);
  for (const [k, v] of Object.entries(extra)) destino.searchParams.set(k, v);
  return NextResponse.redirect(destino, 303);
}
