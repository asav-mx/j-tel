import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { CLERK_CONFIGURADO } from "@/lib/clerk-estado";
import { ENCABEZADO_RUTA_COMPLETA } from "@/lib/destino-de-vuelta";

/**
 * El middleware del Paso 1 hace dos cosas y **ninguna de las dos cierra nada**.
 *
 *  1. La limpieza de URL que ya existía, intacta.
 *  2. Monta el contexto de Clerk para que `auth()` pueda leerse en cualquier
 *     pantalla. `clerkMiddleware()` por sí solo NO protege rutas: solo adjunta
 *     el estado de sesión. Proteger exige llamar `auth.protect()`, y eso es el
 *     Paso 2 — deliberadamente ausente de este archivo.
 *
 * El matcher se abre a toda la app porque `auth()` lanza si la petición no pasó
 * por aquí. Con el matcher viejo —solo `/cliente` y `/carrier`— cualquier
 * pantalla de J-Staff que preguntara quién soy tronaría.
 *
 * Los crons siguen entrando sin sesión y sin estorbo: nadie los bloquea, y su
 * guardia sigue siendo `CRON_SECRET` dentro de cada ruta.
 */

/** Corrige ?account%3Dtecma → ?account=tecma (links rotos al copiar desde chat). */
function cleanedAccountUrl(url: URL): URL | null {
  if (url.searchParams.get("account")) return null;

  const fixed = new URL(url.toString());

  for (const key of [...fixed.searchParams.keys()]) {
    const match = key.match(/^account=(.+)$/);
    if (match?.[1]?.trim()) {
      fixed.searchParams.delete(key);
      fixed.searchParams.set("account", match[1].trim());
      return fixed;
    }
  }

  const raw = fixed.search.slice(1);
  const encodedPrefix = "account%3D";
  if (raw.toLowerCase().startsWith(encodedPrefix)) {
    const slug = decodeURIComponent(raw.slice(encodedPrefix.length)).replace(/=+$/, "");
    if (slug.trim()) {
      fixed.search = `?account=${encodeURIComponent(slug.trim())}`;
      return fixed;
    }
  }

  return null;
}

/**
 * La limpieza sigue acotada a las dos caras que la necesitaban. El matcher se
 * abrió para Clerk, no para esto: aplicarla en todas partes cambiaría el
 * comportamiento de rutas que hoy nadie toca.
 */
function limpiarUrlDeCuenta(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/cliente") && !path.startsWith("/carrier")) return;

  const cleaned = cleanedAccountUrl(request.nextUrl);
  if (cleaned && cleaned.href !== request.nextUrl.href) {
    return NextResponse.redirect(cleaned);
  }
}

/**
 * El layout raíz necesita saber en qué ruta está para no pintar el distintivo
 * de identidad encima del landing, que es público y no trata datos. Un layout
 * de servidor no puede leer el pathname, así que se lo pasamos por encabezado.
 *
 * Y desde la pieza 1.j viaja también la ruta **con su búsqueda**, que es la que
 * la guardia necesita para poder devolverte a donde ibas. Van en encabezados
 * distintos a propósito: `ENCABEZADO_RUTA` lo consumen comparaciones de prefijo
 * —`/landing`, `/cliente`— y meterle la búsqueda le cambiaría el significado a
 * quien ya lo usa. Un encabezado que quiere decir dos cosas termina diciendo la
 * equivocada.
 */
function conRuta(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(ENCABEZADO_RUTA, request.nextUrl.pathname);
  headers.set(ENCABEZADO_RUTA_COMPLETA, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const ENCABEZADO_RUTA = "x-jtel-path";


function manejar(request: NextRequest) {
  return limpiarUrlDeCuenta(request) ?? conRuta(request);
}

/*
 * Sin llaves de Clerk no se llama a `clerkMiddleware`: construirlo sin
 * credenciales falla en tiempo de petición y dejaría la app entera sin
 * responder. Sin llaves, esto es exactamente el middleware de antes.
 */
export default CLERK_CONFIGURADO
  ? clerkMiddleware((_auth, request) => manejar(request))
  : manejar;

export const config = {
  matcher: [
    // Todo menos los estáticos de Next y los archivos con extensión.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
