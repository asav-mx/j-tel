import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * El recorrido del DÍA COMPLETO de una unidad — Parte 2 de reconciliación.
 *
 * SOLO LECTURA. **Cara del transportista, y solo ahí:** un recorrido es la ruta
 * que la unidad servía, así que enseñarlo del lado del cliente nombraría la
 * operación de un tercero (Ley 3). Esta ruta vive bajo `/api/carrier/`.
 *
 * ---
 *
 * **Por qué el día completo y no la ventana.** La ventana es la frontera de lo
 * que el árbitro miró, y está medido que se le queda corta: de los acusados sin
 * unidad, la ventana de hoy abriría antes en **381 de 397**, y en la población
 * de ventana corta **el 100 %** tiene puntos guardados de la misma candidata
 * **antes** de que su ventana abriera. Ahí es donde el transportista puede
 * enseñar que la unidad hizo la ruta antes de que el árbitro mirara.
 *
 * ⚠ **Y la ley que lo acompaña: esto es evidencia para MIRAR, no entrada del
 * veredicto.** El árbitro decidió con la ventana. Si algún día un dato de fuera
 * de la ventana mueve un resultado, la ventana deja de ser la frontera de nada.
 * Por eso esta ruta **no escribe**, y por eso devuelve los dos tramos separados
 * —dentro y fuera— en vez de un total: dos cosas distintas no se cuentan juntas.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountSlug = (url.searchParams.get("account") ?? "").trim();
  const occurrenceId = (url.searchParams.get("occurrenceId") ?? "").trim();
  const unitId = (url.searchParams.get("unitId") ?? "").trim();

  if (!accountSlug || !occurrenceId || !unitId) {
    return NextResponse.json(
      { error: "Faltan account, occurrenceId o unitId" },
      { status: 400 },
    );
  }

  const g = await exigir(request, { tipo: "carrier", slug: accountSlug }, "json");
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(accountSlug);
  if (!carrier || carrier.type !== "carrier") {
    return NextResponse.json({ error: "Carrier no encontrado" }, { status: 404 });
  }

  const occurrence = await repos.occurrences.findById(occurrenceId);
  if (!occurrence?.trip || !occurrence.profile?.contract) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
  if (occurrence.profile.contract.carrierAccountId !== carrier.id) {
    return NextResponse.json({ error: "No autorizado para este servicio" }, { status: 403 });
  }

  const unidades = await repos.fleet.getUnitsForCarrier(carrier.id);
  if (!unidades.some((u) => u.id === unitId)) {
    return NextResponse.json(
      { error: "Esa unidad no es de este transportista" },
      { status: 400 },
    );
  }

  /*
   * Los aparatos que esa unidad trajo ESE DÍA. Se resuelve por asignación y no
   * por el último aparato conocido: una unidad puede cambiar de dispositivo, y
   * preguntar por el de hoy dejaría fuera el rastro del día que se disputa
   * (Ley 5 del Marco — el GPS es un dispositivo, no la unidad).
   */
  const asignaciones = await repos.fleet.getActiveAssignmentsForCarrier(carrier.id);
  const imeis = asignaciones
    .filter((a) => a.unitId === unitId && a.device?.imei)
    .map((a) => a.device!.imei);
  if (imeis.length === 0) {
    return NextResponse.json({
      ok: true,
      sinAparato: true,
      // No es cero: es que no se sabe con qué aparato buscar.
      mensaje: "No hay aparato asignado a esta unidad para poder buscar su rastro",
    });
  }

  // El día del servicio, de punta a punta, en la zona del contrato.
  const inicioVentana = occurrence.trip.evidenceWindowStart;
  const finVentana = occurrence.trip.evidenceWindowEnd;
  const diaInicio = new Date(inicioVentana);
  diaInicio.setUTCHours(0, 0, 0, 0);
  const diaFin = new Date(diaInicio);
  diaFin.setUTCDate(diaFin.getUTCDate() + 1);

  const puntos = await repos.telemetry.getForImeis(imeis, diaInicio, diaFin);
  if (puntos.length === 0) {
    return NextResponse.json({
      ok: true,
      total: 0,
      dentro: 0,
      antes: 0,
      despues: 0,
      primero: null,
      ultimo: null,
    });
  }

  const dentroDe = (t: Date) => t >= inicioVentana && t <= finVentana;
  const antes = puntos.filter((p) => p.recordedAt < inicioVentana).length;
  const despues = puntos.filter((p) => p.recordedAt > finVentana).length;
  const dentro = puntos.filter((p) => dentroDe(p.recordedAt)).length;

  return NextResponse.json({
    ok: true,
    total: puntos.length,
    // Los tres van separados a propósito: sumarlos borraría la frontera con la
    // que se juzgó, que es justo lo que esta pieza existe para enseñar.
    dentro,
    antes,
    despues,
    primero: puntos[0]!.recordedAt.toISOString(),
    ultimo: puntos[puntos.length - 1]!.recordedAt.toISOString(),
    ventana: {
      inicio: inicioVentana.toISOString(),
      fin: finVentana.toISOString(),
    },
  });
}
