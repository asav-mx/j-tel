"use client";

/**
 * Mandarle a la cámara del teléfono: enfoque y zoom.
 *
 * ## Por qué esto existe
 *
 * Con la resolución ya resuelta, el lector seguía sin leer: **la cámara no
 * enfocaba el código**. Y ahí hay física de por medio, no un descuido —la
 * cámara principal de un teléfono no enfoca más cerca de unos 10 cm, y el
 * código necesita estar cerca para dar píxeles. Los dos límites se cruzan justo
 * donde estábamos trabajando.
 *
 * **El zoom es la salida buena**, y por eso está aquí: con 2× el chofer puede
 * **alejarse** hasta donde la cámara sí enfoca, y el código sigue llenando la
 * mira. Ataca la causa en vez de pedirle pulso a nadie.
 *
 * ## Nada de esto está garantizado
 *
 * `focusMode`, `pointsOfInterest` y `zoom` son extensiones: Chrome de Android
 * las trae, el Safari del iPhone no expone casi ninguna. **Todo va en
 * `try/catch` y nada se da por hecho** — sin ellas el lector sigue funcionando,
 * sólo que enfocar depende de alejar el teléfono a mano.
 *
 * Por eso también se **enseña qué soporta el aparato** en la línea de
 * diagnóstico: si una prueba en la calle falla, que vuelva diciendo con qué
 * contaba y no sólo que no enganchó.
 */

interface CapacidadesCrudas {
  focusMode?: string[];
  pointsOfInterest?: unknown;
  zoom?: { min?: number; max?: number; step?: number };
}

export interface CapacidadesDeLaCamara {
  readonly enfoqueContinuo: boolean;
  readonly puntoDeEnfoque: boolean;
  readonly zoom: { readonly min: number; readonly max: number; readonly step: number } | null;
}

export const SIN_CAPACIDADES: CapacidadesDeLaCamara = {
  enfoqueContinuo: false,
  puntoDeEnfoque: false,
  zoom: null,
};

/** Cuánto zoom se pide al arrancar, si el aparato lo permite. */
export const ZOOM_DE_ARRANQUE = 2;

function crudas(pista: MediaStreamTrack): CapacidadesCrudas {
  try {
    const leer = (pista as unknown as { getCapabilities?: () => CapacidadesCrudas })
      .getCapabilities;
    return typeof leer === "function" ? (leer.call(pista) ?? {}) : {};
  } catch {
    return {};
  }
}

export function leerCapacidades(pista: MediaStreamTrack): CapacidadesDeLaCamara {
  const c = crudas(pista);
  const z = c.zoom;
  return {
    enfoqueContinuo: Array.isArray(c.focusMode) && c.focusMode.includes("continuous"),
    puntoDeEnfoque: c.pointsOfInterest !== undefined,
    zoom:
      z && typeof z.min === "number" && typeof z.max === "number" && z.max > z.min
        ? { min: z.min, max: z.max, step: typeof z.step === "number" ? z.step : 0.1 }
        : null,
  };
}

/** Aplica restricciones avanzadas sin tumbar nada si el aparato no las conoce. */
async function pedir(pista: MediaStreamTrack, avanzada: Record<string, unknown>): Promise<boolean> {
  try {
    await pista.applyConstraints({ advanced: [avanzada] } as MediaTrackConstraints);
    return true;
  } catch {
    return false;
  }
}

export const pedirEnfoqueContinuo = (pista: MediaStreamTrack): Promise<boolean> =>
  pedir(pista, { focusMode: "continuous" });

/**
 * Enfocar donde alguien tocó. `x` e `y` van de 0 a 1 dentro de la imagen.
 *
 * Si el aparato no conoce `pointsOfInterest`, se vuelve a pedir enfoque
 * continuo: en muchos teléfonos eso basta para que el autoenfoque arranque otra
 * vez, que es justo lo que el toque quiere decir.
 */
export async function enfocarEn(pista: MediaStreamTrack, x: number, y: number): Promise<boolean> {
  const acotar = (n: number) => Math.min(1, Math.max(0, n));
  const conPunto = await pedir(pista, {
    pointsOfInterest: [{ x: acotar(x), y: acotar(y) }],
    focusMode: "continuous",
  });
  return conPunto || pedirEnfoqueContinuo(pista);
}

export async function aplicarZoom(pista: MediaStreamTrack, valor: number): Promise<boolean> {
  return pedir(pista, { zoom: valor });
}

/** Qué zoom tiene ahora, para enseñarlo y para moverlo de a poco. */
export function zoomActual(pista: MediaStreamTrack): number | null {
  try {
    const leer = (pista as unknown as { getSettings?: () => { zoom?: number } }).getSettings;
    const z = typeof leer === "function" ? leer.call(pista).zoom : undefined;
    return typeof z === "number" ? z : null;
  } catch {
    return null;
  }
}

/** Lo que la línea de diagnóstico dice de la cámara. Corto: es una línea. */
export function describirCapacidades(c: CapacidadesDeLaCamara, zoom: number | null): string {
  const enfoque = [c.enfoqueContinuo && "continuo", c.puntoDeEnfoque && "toque"].filter(Boolean);
  const partes = [`enfoque: ${enfoque.length ? enfoque.join("+") : "sin control"}`];
  if (c.zoom) {
    const ahora = zoom === null ? "" : ` en ${Math.round(zoom * 10) / 10}×`;
    partes.push(`zoom ${c.zoom.min}–${c.zoom.max}×${ahora}`);
  } else {
    partes.push("sin zoom");
  }
  return partes.join(" · ");
}
