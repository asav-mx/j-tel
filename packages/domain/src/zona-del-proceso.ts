/**
 * **¿En qué zona cree que vive este proceso?**
 *
 * El producto corre en Vercel, que corre en UTC, y **nada en el repo lo
 * afirmaba ni lo comprobaba**: era cierto por costumbre del proveedor. El
 * diagnóstico del 23-sep-2026
 * (`docs/Diagnostico-Rango-Del-Generador-2026-09-23.md`) encontró que el
 * generador de ocurrencias decidía su rango en la zona de la máquina, y que
 * fuera de UTC arrancaba un día antes.
 *
 * El arreglo de fondo es que **nada dependa de la zona del proceso** — las
 * fechas civiles se calculan con la zona explícita del circuito o del
 * contrato—. Esto es la otra mitad, la que pidió Asav: **una alarma**, para el
 * día que algo del motor corra en una máquina que no está en UTC.
 *
 * ## Por qué avisa y no se cae
 *
 * Una zona distinta **no es una emergencia**: con el arreglo de las fechas
 * civiles, el motor sigue calculando bien. Lo que significa es que una
 * suposición que sostuvo mucho código dejó de valer, y que conviene mirar lo
 * que todavía no se haya revisado. Tumbar el arranque por eso dejaría sin
 * servicio a toda la plataforma por una advertencia.
 *
 * ## Por qué mira el desplazamiento y no sólo `TZ`
 *
 * `TZ` puede no estar puesta y el sistema estar igualmente en UTC, y puede
 * decir `UTC` en una máquina cuyo reloj está corrido. Lo que de verdad importa
 * es **qué contesta `Date`**, que es lo que el código usa; `TZ` se reporta como
 * dato de apoyo para que quien lea la alarma sepa dónde buscar.
 */

export interface ZonaDelProceso {
  /** `process.env.TZ`, si está puesta. */
  readonly tz: string | undefined;
  /** Lo que contesta `new Date().getTimezoneOffset()`: minutos, 0 en UTC. */
  readonly desplazamientoMinutos: number;
  /** Lo que el sistema dice de sí mismo, para el mensaje. */
  readonly zonaResuelta?: string;
}

export type VeredictoDeZona =
  | { readonly enUtc: true }
  | { readonly enUtc: false; readonly mensaje: string };

/**
 * ¿Corre en UTC?
 *
 * El desplazamiento se mide con el signo al revés que la intuición
 * —`getTimezoneOffset` devuelve **480** en UTC-8— y por eso el mensaje lo
 * traduce a horas con su signo, que es como lo dice todo el mundo.
 */
export function revisarZonaDelProceso(zona: ZonaDelProceso): VeredictoDeZona {
  if (zona.desplazamientoMinutos === 0) return { enUtc: true };

  const horas = -zona.desplazamientoMinutos / 60;
  const conSigno = `${horas > 0 ? "+" : ""}${Number.isInteger(horas) ? horas : horas.toFixed(2)}`;
  const nombre = zona.zonaResuelta ?? zona.tz ?? "(sin nombre)";
  return {
    enUtc: false,
    mensaje:
      `Este proceso NO corre en UTC: ${nombre} (UTC${conSigno}), TZ=${zona.tz ?? "(sin poner)"}. ` +
      "El producto se escribió suponiendo UTC —es lo que hace Vercel— y esa suposición " +
      "acaba de dejar de valer. Las fechas civiles del motor ya no dependen de la zona del " +
      "proceso (arreglo del 23-sep-2026), pero cualquier código que todavía use `setHours` o " +
      "`new Date('…T00:00:00')` sin zona explícita va a decidir otro día. " +
      "Ver docs/Diagnostico-Rango-Del-Generador-2026-09-23.md.",
  };
}

/** La zona de ESTE proceso, leída del sistema. */
export function zonaDeEsteProceso(): ZonaDelProceso {
  let zonaResuelta: string | undefined;
  try {
    zonaResuelta = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* Un runtime sin ICU no sabe su nombre; el desplazamiento sigue valiendo. */
  }
  return {
    tz: process.env.TZ,
    desplazamientoMinutos: new Date().getTimezoneOffset(),
    zonaResuelta,
  };
}
