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

  // Objeto TIPADO, sin `as never`. Un cast aquí apagaría justo la comprobación
  // que evita mandar un nombre de columna que no existe — que es exactamente el
  // bug que dejó sin crearse todas las paradas del 26 de agosto.
  const cambios: Partial<{
    name: string;
    declaredFrequencyMinutes: number;
    staleAfterSeconds: number;
    arrivalRangeFloorSeconds: number;
    stopSnapToleranceMeters: number;
    avgSpeedKmh: number;
    serviceStartLocal: string;
    serviceEndLocal: string;
  }> = {};

  const nombre = String(form.get("nombre") ?? "").trim();
  if (nombre) cambios.name = nombre;

  const frecuencia = entero("frecuenciaMin");
  if (frecuencia === null) return volver({ error: "La frecuencia tiene que ser mayor que cero" });
  if (frecuencia !== undefined) cambios.declaredFrequencyMinutes = frecuencia;

  const umbral = entero("umbralSeg");
  if (umbral === null) return volver({ error: "El umbral de dato viejo tiene que ser mayor que cero" });
  if (umbral !== undefined) cambios.staleAfterSeconds = umbral;

  const piso = entero("pisoSeg");
  if (piso === null) return volver({ error: "El piso del rango tiene que ser mayor que cero" });
  if (piso !== undefined) cambios.arrivalRangeFloorSeconds = piso;

  const tolerancia = entero("toleranciaM");
  if (tolerancia === null) return volver({ error: "La tolerancia tiene que ser mayor que cero" });
  if (tolerancia !== undefined) cambios.stopSnapToleranceMeters = tolerancia;

  /*
   * La velocidad admite decimales —la medida fue 20.5— así que no pasa por
   * `entero`, que redondea. Un 20 en vez de un 20.5 mueve el rango de llegada
   * un 2.5%: poco, y aun así es un dato calibrado perdiendo precisión por una
   * función que no era para él.
   */
  const crudaVel = form.get("velocidadKmh");
  if (crudaVel !== null && String(crudaVel).trim() !== "") {
    const v = Number(crudaVel);
    if (!Number.isFinite(v) || v <= 0) {
      return volver({ error: "La velocidad tiene que ser mayor que cero" });
    }
    cambios.avgSpeedKmh = v;
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
    const actualizado = await getRepos().circuits.updateCircuit(id, cambios);
    if (!actualizado) return volver({ error: "No existe ese circuito" });
  } catch {
    // Los CHECK de la base rechazando un valor imposible.
    return volver({ error: "La base rechazó alguno de los valores" });
  }

  return volver({ ok: "Circuito actualizado" });
}
