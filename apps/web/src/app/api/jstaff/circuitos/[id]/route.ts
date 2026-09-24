import { NextResponse } from "next/server";
import { porQueNoSirveParaUnaRuta } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { destinoDeVuelta } from "@/lib/casa/volver";

/**
 * Editar los campos de un circuito, desde el expediente.
 *
 * Todo lo que define un circuito es **campo, no constante**: si el
 * concesionario cambia su frecuencia el martes —o mueve el día en que arranca
 * su servicio—, el martes se ajusta, sin desplegar. Los `CHECK` de la base son
 * la última palabra: un cero no entra aunque el formulario lo deje escribir.
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
    // El expediente nuevo de J-Staff pide regresar a él; sin eso, a la pantalla vieja como siempre.
    const url = new URL(destinoDeVuelta(form) ?? `/jstaff/circuitos/${id}`, request.url);
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
    staleAfterSeconds: number;
    serviceConfidenceMinutes: number;
    corridorToleranceMeters: number;
    stopSnapToleranceMeters: number;
    arrivalRangeFloorSeconds: number;
    avgSpeedKmh: number;
    arrivalTolerancePct: number;
    corridorExitMinutes: number;
    serviceStartLocal: string;
    serviceEndLocal: string;
    timeZone: string;
    serviceLaunchDate: string | null;
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
    /*
     * La regla del color vive en el dominio y se sostiene AQUÍ, no en la
     * pantalla: el selector de pastillas no ofrece un tono del naranja de
     * Ontoy, pero un formulario viejo en una pestaña abierta, o un `curl`,
     * mandan lo que quieran. Una regla que sólo vive en el navegador no es una
     * regla (enmienda (a) de ASAV, 23-sep-2026).
     */
    const noSirve = porQueNoSirveParaUnaRuta(color);
    if (noSirve) return volver({ error: noSirve });
    cambios.colorHex = color.toUpperCase();
  }

  /*
   * La frecuencia ya no se escribe aquí: la promesa tiene una sola fuente, las
   * franjas (`/promesa`, decisión de Asav del 21 sep 2026). Un formulario viejo
   * que todavía mande `frecuenciaMin` no escribe nada — la valla
   * `promesa-una-fuente.test.ts` vigila que nadie vuelva a escribir la columna.
   */

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
    {
      // Hoy sólo se movía con SQL (A4b). Admite decimales: la banda es ±pct % de la promesa.
      campo: "toleranciaLlegadaPct",
      error: "La tolerancia de llegada tiene que ser mayor que cero",
      entero: false,
      aplicar: (v) => (cambios.arrivalTolerancePct = v),
    },
    {
      campo: "minutosFueraCorredor",
      error: "Los minutos fuera del corredor tienen que ser mayores que cero",
      aplicar: (v) => (cambios.corridorExitMinutes = v),
    },
  ];

  for (const p of perillas) {
    const v = numero(p.campo, { entero: p.entero ?? true });
    if (v === null) return volver({ error: p.error });
    if (v !== undefined) p.aplicar(v);
  }
  // La base también lo cuida (0051): más de 100 % dejaría la orilla de abajo en negativo.
  if (cambios.arrivalTolerancePct !== undefined && cambios.arrivalTolerancePct > 100) {
    return volver({ error: "La tolerancia de llegada no puede pasar de 100 %" });
  }

  /*
   * La fecha de arranque, con la MISMA regla que la frecuencia: vaciar el campo
   * BORRA el valor. No es «no cambies nada», y es una acción legítima — si el
   * circuito ya arrancó y alguien quiere dejar de anunciarlo, se vacía.
   *
   * `null` significa que el circuito ya opera. Nunca se rellena con la fecha de
   * hoy: eso fabricaría una declaración que nadie hizo y, de paso, apagaría el
   * servicio hasta la medianoche.
   */
  if (form.has("arrancaEl")) {
    const crudo = String(form.get("arrancaEl") ?? "").trim();
    if (!crudo) cambios.serviceLaunchDate = null;
    else {
      if (!esFechaCivil(crudo)) {
        return volver({ error: "La fecha de arranque va en formato AAAA-MM-DD, o queda vacía" });
      }
      cambios.serviceLaunchDate = crudo;
    }
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

  /*
   * **Las reglas de la medición se firman** (0051, A4b — ASAV, 21-sep-2026):
   * si el envío cambia una —un ajuste, la tolerancia, los minutos fuera del
   * corredor, el horario, la zona o la fecha de arranque—, pide motivo y queda
   * en el registro con quién, cuándo y el antes → después LEÍDO DE LA BASE. El
   * repositorio decide qué cambió; aquí sólo se le pasa quién y por qué, de la
   * sesión y del formulario. Sin motivo no se guarda nada del envío.
   */
  const motivo = String(form.get("motivo") ?? "").trim().slice(0, 280) || null;
  try {
    const r = await getRepos().circuits.cambiarCircuito(id, cambios, { motivo, por: g.identidad.userId });
    if (!r.ok) {
      if (r.error === "no_existe") return volver({ error: "No existe ese circuito" });
      if (r.error === "falta_quien") return volver({ error: "Inicia sesión: el cambio de una regla queda firmado." });
      return volver({
        error: "No se guardó nada: este cambio mueve una regla de la medición. Di por qué — queda escrito con tu nombre.",
      });
    }
    return volver({
      ok:
        r.registrados > 0
          ? `Guardado · ${r.registrados === 1 ? "1 regla cambiada" : `${r.registrados} reglas cambiadas`}, con su motivo`
          : "Guardado",
    });
  } catch {
    // Los CHECK de la base rechazando un valor imposible.
    return volver({ error: "La base rechazó alguno de los valores" });
  }
}

/**
 * ¿Es una fecha civil de verdad, y no sólo diez caracteres con guiones?
 *
 * El formato solo no basta: `2026-13-45` lo cumple, y `new Date(...)` no lo
 * rechaza — lo **desborda** al 14 de febrero de 2027, una fecha perfectamente
 * creíble que nadie declaró. La comprobación es de ida y vuelta: si el día que
 * sale no es el día que entró, la cadena no era una fecha.
 *
 * Se comprueba aquí y no sólo en el `<input type="date">` del formulario: el
 * navegador no es la última palabra sobre lo que entra a la base.
 */
function esFechaCivil(valor: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const [, y, mes, d] = m;
  const fecha = new Date(Date.UTC(Number(y), Number(mes) - 1, Number(d)));
  return (
    fecha.getUTCFullYear() === Number(y) &&
    fecha.getUTCMonth() === Number(mes) - 1 &&
    fecha.getUTCDate() === Number(d)
  );
}
