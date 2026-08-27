import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Editar los campos de un circuito.
 *
 * Los tres números del tramo —frecuencia declarada, umbral de dato viejo y piso
 * del rango— más la tolerancia de pegado, el horario y el nombre. Todos son
 * campos, y por eso se cambian aquí y no en un despliegue: si el concesionario
 * cambia su frecuencia el martes, el martes se ajusta.
 *
 * Los `CHECK` de la base son la última palabra: un cero no entra aunque el
 * formulario lo deje escribir.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  const form = await request.formData();
  const volver = (params: Record<string, string>) => {
    const url = new URL(`/jstaff/circuitos/${id}`, request.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, 303);
  };

  const entero = (campo: string) => {
    const crudo = form.get(campo);
    if (crudo === null || String(crudo).trim() === "") return undefined;
    const v = Number(crudo);
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null; // null = inválido
  };

  const cambios: Record<string, unknown> = {};
  const nombre = String(form.get("nombre") ?? "").trim();
  if (nombre) cambios.name = nombre;

  for (const [campo, columna] of [
    ["frecuenciaMin", "declaredFrequencyMinutes"],
    ["umbralSeg", "staleAfterSeconds"],
    ["pisoSeg", "arrivalRangeFloorSeconds"],
    ["toleranciaM", "stopSnapToleranceMeters"],
  ] as const) {
    const v = entero(campo);
    if (v === null) return volver({ error: `"${campo}" tiene que ser un número mayor que cero` });
    if (v !== undefined) cambios[columna] = v;
  }

  const hora = (campo: string) => {
    const v = String(form.get(campo) ?? "").trim();
    return /^\d{2}:\d{2}(:\d{2})?$/.test(v) ? v : undefined;
  };
  const hi = hora("horaInicio");
  const hf = hora("horaFin");
  if (hi) cambios.serviceStartLocal = hi;
  if (hf) cambios.serviceEndLocal = hf;

  if (Object.keys(cambios).length === 0) return volver({ error: "No mandaste ningún cambio" });

  try {
    const actualizado = await getRepos().circuits.updateCircuit(id, cambios as never);
    if (!actualizado) return volver({ error: "No existe ese circuito" });
  } catch {
    // Los CHECK de la base rechazando un valor imposible.
    return volver({ error: "La base rechazó alguno de los valores" });
  }

  return volver({ ok: "Circuito actualizado" });
}
