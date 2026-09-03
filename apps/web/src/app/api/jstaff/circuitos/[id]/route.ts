import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Editar los campos de un circuito, desde el expediente.
 *
 * Todo lo que define un circuito es **campo, no constante**: si el
 * concesionario cambia su frecuencia el martes, el martes se ajusta, sin
 * desplegar. Los `CHECK` de la base son la última palabra: un cero no entra
 * aunque el formulario lo deje escribir.
 *
 * ## Las cuatro perillas que antes no se podían tocar
 *
 * `corridor_tolerance_meters`, `service_confidence_minutes`, `color_hex` y
 * `time_zone` sólo se podían mover con SQL a mano. Las dos primeras deciden
 * **qué unidad ve el pasajero y hasta cuándo la app dice que hay servicio** —o
 * sea, lo más consecuente del circuito— y vivían fuera del alcance de quien
 * opera. Ahora entran por aquí como las demás.
 *
 * ## Los dos nombres que se separaron
 *
 * Había **dos distancias** y el formulario llamaba «tolerancia» a la que menos
 * importa. `pegadoParadasM` es para colocar una parada a mano sobre un mapa
 * quieto (25 m); `corredorEnRutaM` decide si un camión en movimiento cuenta
 * como en ruta (150 m). Ponerlas juntas sin renombrarlas habría dejado el mismo
 * riesgo con mejor acomodo: quien busca «la tolerancia» encuentra una de las
 * dos y la mueve. **Cada nombre dice qué hace su número**, aquí y en la
 * pantalla.
 *
 * ## Cambiar un umbral no reescribe nada
 *
 * Ninguno de estos valores está congelado dentro de un hecho: el sprint público
 * mide y reporta, no sella. Mover un umbral cambia lo que la app dice **de aquí
 * en adelante**, y no toca ni una posición ya guardada.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  const form = await request.formData();

  /*
   * El regreso lleva ancla. En el teléfono el expediente es una columna larga,
   * y devolver a quien acaba de guardar hasta arriba lo obliga a buscar dónde
   * estaba. La sección la manda el formulario que envió.
   */
  const seccion = String(form.get("seccion") ?? "").trim();
  const volver = (params: Record<string, string>) => {
    const url = new URL(`/jstaff/circuitos/${id}`, request.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (/^[a-z-]{1,40}$/.test(seccion)) url.hash = seccion;
    return NextResponse.redirect(url, 303);
  };

  const numero = (campo: string, { entero = true }: { entero?: boolean } = {}) => {
    const crudo = form.get(campo);
    if (crudo === null || String(crudo).trim() === "") return undefined;
    const v = Number(crudo);
    if (!Number.isFinite(v) || v <= 0) return null; // null = inválido
    return entero ? Math.round(v) : v;
  };

  // Objeto TIPADO, sin `as never`. Un cast aquí apagaría justo la comprobación
  // que evita mandar un nombre de columna que no existe — que es exactamente el
  // bug que dejó sin crearse todas las paradas del 26 de agosto.
  const cambios: Partial<{
    name: string;
    colorHex: string;
    declaredFrequencyMinutes: number | null;
    staleAfterSeconds: number;
    serviceConfidenceMinutes: number;
    corridorToleranceMeters: number;
    stopSnapToleranceMeters: number;
    arrivalRangeFloorSeconds: number;
    avgSpeedKmh: number;
    serviceStartLocal: string;
    serviceEndLocal: string;
    timeZone: string;
  }> = {};

  const nombre = String(form.get("nombre") ?? "").trim();
  if (nombre) cambios.name = nombre;

  /*
   * El color es el que identifica la ruta en el mapa del pasajero. Un hex
   * inválido no revienta nada — pinta una ruta invisible, que es peor —, así que
   * se comprueba aquí y además lo comprueba un CHECK de la base.
   */
  const color = String(form.get("colorHex") ?? "").trim();
  if (color) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return volver({ error: "El color va en formato #RRGGBB" });
    }
    cambios.colorHex = color.toUpperCase();
  }

  /*
   * Vaciar el campo BORRA la frecuencia, y es una acción legítima: si el
   * concesionario deja de declararla, la app tiene que dejar de prometerla. Por
   * eso aquí el vacío no es «no cambies nada» como en los demás campos.
   */
  if (form.has("frecuenciaMin")) {
    const crudo = String(form.get("frecuenciaMin") ?? "").trim();
    if (!crudo) cambios.declaredFrequencyMinutes = null;
    else {
      const v = Number(crudo);
      if (!Number.isFinite(v) || v <= 0) {
        return volver({ error: "La frecuencia tiene que ser mayor que cero, o quedar vacía" });
      }
      cambios.declaredFrequencyMinutes = Math.round(v);
    }
  }

  /*
   * Cada perilla con su mensaje propio. Un «la base rechazó alguno de los
   * valores» obliga a quien captura a adivinar cuál de seis campos fue, en un
   * teléfono, con el concesionario enfrente.
   */
  const perillas: Array<{
    campo: string;
    error: string;
    entero?: boolean;
    aplicar: (v: number) => void;
  }> = [
    {
      campo: "corredorEnRutaM",
      error: "La distancia del corredor tiene que ser mayor que cero",
      aplicar: (v) => (cambios.corridorToleranceMeters = v),
    },
    {
      campo: "frescuraSeg",
      error: "Los segundos de dato viejo tienen que ser mayores que cero",
      aplicar: (v) => (cambios.staleAfterSeconds = v),
    },
    {
      campo: "confianzaMin",
      error: "La ventana de confianza tiene que ser mayor que cero",
      aplicar: (v) => (cambios.serviceConfidenceMinutes = v),
    },
    {
      // La velocidad admite decimales —la medida fue 20.5— y redondearla movería
      // el tiempo estimado un 2.5% por culpa de una función que no era para ella.
      campo: "velocidadKmh",
      error: "La velocidad tiene que ser mayor que cero",
      entero: false,
      aplicar: (v) => (cambios.avgSpeedKmh = v),
    },
    {
      campo: "pisoRangoSeg",
      error: "El piso del tiempo estimado tiene que ser mayor que cero",
      aplicar: (v) => (cambios.arrivalRangeFloorSeconds = v),
    },
    {
      campo: "pegadoParadasM",
      error: "La distancia de pegado de paradas tiene que ser mayor que cero",
      aplicar: (v) => (cambios.stopSnapToleranceMeters = v),
    },
  ];

  for (const p of perillas) {
    const v = numero(p.campo, { entero: p.entero ?? true });
    if (v === null) return volver({ error: p.error });
    if (v !== undefined) p.aplicar(v);
  }

  const hora = (campo: string) => {
    const v = String(form.get(campo) ?? "").trim();
    return /^\d{2}:\d{2}(:\d{2})?$/.test(v) ? v : undefined;
  };
  const hi = hora("horaInicio");
  const hf = hora("horaFin");
  if (hi) cambios.serviceStartLocal = hi;
  if (hf) cambios.serviceEndLocal = hf;

  /*
   * La zona horaria se comprueba contra `Intl`, no contra una lista nuestra.
   *
   * No es cosmética: `enHorarioDeServicio` construye la hora local del circuito
   * con esta cadena, así que una zona inventada **lanza** y se lleva por delante
   * el endpoint del pasajero — el circuito entero deja de contestar. Una lista
   * propia de zonas sería un segundo lugar donde vive el catálogo de IANA, y se
   * quedaría vieja sola.
   */
  const zona = String(form.get("zonaHoraria") ?? "").trim();
  if (zona) {
    try {
      new Intl.DateTimeFormat("es-MX", { timeZone: zona }).format(new Date());
    } catch {
      return volver({ error: `«${zona}» no es una zona horaria que el sistema reconozca` });
    }
    cambios.timeZone = zona;
  }

  if (Object.keys(cambios).length === 0) return volver({ error: "No mandaste ningún cambio" });

  try {
    const actualizado = await getRepos().circuits.updateCircuit(id, cambios);
    if (!actualizado) return volver({ error: "No existe ese circuito" });
  } catch {
    // Los CHECK de la base rechazando un valor imposible.
    return volver({ error: "La base rechazó alguno de los valores" });
  }

  return volver({ ok: "Guardado" });
}
