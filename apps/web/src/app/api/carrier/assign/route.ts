import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Emparejar un GPS con una unidad.
 *
 * Esta ruta necesita DOS comprobaciones, no una, y por eso es la más larga de
 * la tanda. La guardia demuestra que perteneces al carrier del `carrierSlug`;
 * eso no dice nada de los ids que mandas.
 *
 * `assignDevice` cierra la asignación abierta de ese GPS **o de esa unidad**,
 * sin filtrar por carrier. Con solo la guardia de cuenta, un carrier
 * autenticado podía mandar el `unitId` de otro y cerrarle su emparejamiento
 * vigente — dejando a esa unidad sin GPS acreditado y, con ella, sin
 * verificación. Cruce entre carriers, con el Marco de por medio.
 *
 * Por eso los dos ids se comprueban contra la flota del carrier ya
 * autorizado. Pertenecer a la cuenta y ser dueño de los recursos son dos
 * preguntas distintas, y ésta necesitaba las dos.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const carrierSlug = String(formData.get("carrierSlug") ?? "").trim();
  const unitId = String(formData.get("unitId") ?? "").trim();
  const deviceId = String(formData.get("deviceId") ?? "").trim();

  const volverA = `/carrier/flota${carrierSlug ? `?account=${encodeURIComponent(carrierSlug)}` : ""}`;

  const g = await exigir(request, { tipo: "carrier", slug: carrierSlug }, { redirigirA: volverA });
  if (!g.ok) return g.respuesta;

  if (!unitId || !deviceId) {
    return NextResponse.json(
      { error: "Debes elegir una unidad y un GPS" },
      { status: 400 },
    );
  }

  const repos = getRepos();
  // La guardia ya comprobó la membresía contra este slug, así que la cuenta
  // existe y es un carrier; se relee solo para tener su id.
  const carrier = await repos.accounts.findBySlug(carrierSlug);
  if (!carrier) {
    return NextResponse.json({ error: "Carrier no encontrado" }, { status: 404 });
  }

  const [unidades, equipos] = await Promise.all([
    repos.fleet.getUnitsForCarrier(carrier.id),
    repos.fleet.getDevicesForCarrier(carrier.id),
  ]);

  if (!unidades.some((u) => u.id === unitId)) {
    return NextResponse.json({ error: "Esa unidad no es de este carrier" }, { status: 403 });
  }
  if (!equipos.some((d) => d.id === deviceId)) {
    return NextResponse.json({ error: "Ese GPS no es de este carrier" }, { status: 403 });
  }

  await repos.fleet.assignDevice(unitId, deviceId, new Date());
  return NextResponse.redirect(new URL(volverA, request.url));
}
