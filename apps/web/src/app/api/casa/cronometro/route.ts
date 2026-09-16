import { NextResponse } from "next/server";
import { getIdentidad } from "@/lib/auth";
import { sesionUtilizable } from "@/lib/guardia-api";

export const dynamic = "force-dynamic";

/**
 * Recibe lo que mide el navegador (`CronometroDelNavegador`) y lo escribe en
 * los registros de Vercel como `[cronometro] navegador …`. No guarda nada.
 *
 * Sólo con sesión, y sólo números y rutas del cascarón: cualquier otra cosa se
 * descarta sin decir por qué, porque no hay a quién decírselo.
 */
export async function POST(request: Request) {
  try {
    const identidad = await getIdentidad();
    if (!sesionUtilizable(identidad)) return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  let d: Record<string, unknown>;
  try {
    d = JSON.parse(await request.text());
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const ruta = (v: unknown) => (typeof v === "string" && /^\/casa[\w\-/]{0,200}$/.test(v) ? v : "?");
  const ms = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 600_000 ? Math.round(v) : "?");
  const despliegue = process.env.VERCEL_DEPLOYMENT_ID ?? "local";

  if (d.tipo === "carga") {
    console.log(
      `[cronometro] navegador carga hacia=${ruta(d.hacia)} primerByte=${ms(d.primerByte)}ms listo=${ms(d.listo)}ms completo=${ms(d.completo)}ms despliegue=${despliegue}`,
    );
  } else if (d.tipo === "navegacion") {
    console.log(
      `[cronometro] navegador navegacion desde=${ruta(d.desde)} hacia=${ruta(d.hacia)} clicAPantalla=${ms(d.ms)}ms despliegue=${despliegue}`,
    );
  }
  return new NextResponse(null, { status: 204 });
}
