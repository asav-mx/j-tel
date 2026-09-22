/**
 * Los avisos **del propio teléfono** (8.13b: «se dicen aparte»). No son de la
 * concesión ni del servicio: son lo que le pasó a ESTE aparato preguntando.
 *
 * - **Red caída:** cuando la consulta falla seguido durante un minuto o más.
 *   Un sondeo fallido suelto es ruido, no un aviso.
 * - **El servidor pidió esperar (429):** la app pregunta más despacio.
 *
 * **Viven sólo mientras la app está abierta y no se guardan en ningún lado.**
 * Y **no prenden el punto de la campana** (decisión de ASAV, 22-sep): una
 * campana que grita por cada señal caída se vuelve invisible.
 *
 * Es un reductor puro sobre los sondeos, para probarlo sin red ni reloj.
 */

export interface AvisoDelTelefono {
  tipo: "red" | "espera";
  /** ISO de cuándo empezó. */
  desde: string;
  /** ISO de cuándo terminó, o `null` si sigue pasando. */
  hasta: string | null;
}

export interface EstadoDelTelefono {
  avisos: AvisoDelTelefono[];
  /** Desde cuándo falla la consulta sin parar (ISO), o `null`. */
  fallandoDesde: string | null;
  /** Si el último sondeo fue un 429. */
  esperando: boolean;
}

export const TELEFONO_INICIAL: EstadoDelTelefono = { avisos: [], fallandoDesde: null, esperando: false };

/** Un minuto seguido sin respuesta es un aviso; menos, es ruido. */
export const RED_CAIDA_MS = 60_000;
/** Los últimos N; más ya no le sirven a nadie. */
const MAXIMO = 5;

export function registrarSondeo(
  e: EstadoDelTelefono,
  s: { ok: boolean; status: number | null; ahora: Date },
): EstadoDelTelefono {
  const ahora = s.ahora.toISOString();
  let avisos = e.avisos;
  let fallandoDesde = e.fallandoDesde;
  let esperando = e.esperando;

  // 429: el servidor pidió esperar. Un aviso por episodio, cerrado al primer éxito.
  if (s.status === 429) {
    if (!esperando) avisos = [...avisos, { tipo: "espera", desde: ahora, hasta: null }];
    esperando = true;
  } else if (esperando && s.ok) {
    avisos = avisos.map((a) => (a.tipo === "espera" && a.hasta === null ? { ...a, hasta: ahora } : a));
    esperando = false;
  }

  // Red caída: cualquier falla que no sea el 429 (ése ya se dijo arriba).
  if (!s.ok && s.status !== 429) {
    fallandoDesde = fallandoDesde ?? ahora;
    const abierto = avisos.some((a) => a.tipo === "red" && a.hasta === null);
    if (!abierto && s.ahora.getTime() - new Date(fallandoDesde).getTime() >= RED_CAIDA_MS) {
      avisos = [...avisos, { tipo: "red", desde: fallandoDesde, hasta: null }];
    }
  } else if (s.ok) {
    avisos = avisos.map((a) => (a.tipo === "red" && a.hasta === null ? { ...a, hasta: ahora } : a));
    fallandoDesde = null;
  }

  return { avisos: avisos.slice(-MAXIMO), fallandoDesde, esperando };
}
