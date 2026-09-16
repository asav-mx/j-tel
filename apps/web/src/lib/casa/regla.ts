import type { PiezaDeRegla, ReglaDeTipo } from "@jtel/domain";

/**
 * La regla de un tipo de papel, tal como la escribe J-Staff (D2).
 *
 * La revisan dos lugares con la misma función: la página, al pasar de «editar» a
 * «revisar el cambio», y la ruta que guarda. Si cada una validara por su cuenta,
 * lo que se revisó y lo que se guardó podrían ser dos reglas distintas.
 *
 * Decidido por ASAV el 16 de septiembre de 2026:
 * - Obligatorio y vence: sí, no, o **sin decidir**. Sin decidir no supone nada.
 * - Días de aviso de 0 a 365 y periodicidad de 1 a 120 meses, sólo si vence.
 * - **La nota «de dónde sale la regla» es obligatoria**: es lo que permite
 *   defender el número el día que alguien pregunte por qué.
 */

export const AVISO_MAXIMO = 365;
export const PERIODICIDAD_MAXIMA = 120;
export const LARGO_NOTA_MINIMO = 5;
export const LARGO_NOTA_MAXIMO = 500;

export type TresEstados = "si" | "no" | "sin_decidir";

export interface ReglaEscrita {
  regla: ReglaDeTipo;
  nota: string;
}

/** Los campos crudos, para devolverlos al formulario tal como se escribieron. */
export const CAMPOS_DE_REGLA = ["obligatorio", "vence", "diasDeAviso", "periodicidadMeses", "nota"] as const;

function tres(valor: string): boolean | null | undefined {
  if (valor === "si") return true;
  if (valor === "no") return false;
  if (valor === "sin_decidir") return null;
  return undefined;
}

function entero(valor: string): number | null | "mal" {
  if (valor === "") return null;
  if (!/^\d{1,4}$/.test(valor)) return "mal";
  return Number(valor);
}

export function revisarRegla(
  leer: (campo: (typeof CAMPOS_DE_REGLA)[number]) => string | null | undefined,
): { ok: true; escrita: ReglaEscrita } | { ok: false; error: string } {
  const campo = (c: (typeof CAMPOS_DE_REGLA)[number]) => (leer(c) ?? "").trim();

  const obligatorio = tres(campo("obligatorio"));
  const vence = tres(campo("vence"));
  if (obligatorio === undefined) return { ok: false, error: "Elige si el papel es obligatorio: sí, no o sin decidir." };
  if (vence === undefined) return { ok: false, error: "Elige si el papel vence: sí, no o sin decidir." };

  const aviso = entero(campo("diasDeAviso"));
  const meses = entero(campo("periodicidadMeses"));
  if (aviso === "mal") return { ok: false, error: "Los días de aviso son un número entero." };
  if (meses === "mal") return { ok: false, error: "La periodicidad es un número entero de meses." };

  if (vence !== true && (aviso !== null || meses !== null)) {
    return {
      ok: false,
      error: "Los días de aviso y la periodicidad sólo aplican si el papel vence. Déjalos vacíos, o marca que vence.",
    };
  }
  if (aviso !== null && aviso > AVISO_MAXIMO) {
    return { ok: false, error: `Los días de aviso van de 0 a ${AVISO_MAXIMO}. Revisa el número.` };
  }
  if (meses !== null && (meses < 1 || meses > PERIODICIDAD_MAXIMA)) {
    return { ok: false, error: `La periodicidad va de 1 a ${PERIODICIDAD_MAXIMA} meses. Revisa el número.` };
  }

  const nota = campo("nota");
  if (nota.length < LARGO_NOTA_MINIMO) {
    return {
      ok: false,
      error: "Escribe de dónde sale la regla —la ley, el artículo, el oficio—. Sin eso, en un año nadie sabrá si el número salió de la ley o de un dedo.",
    };
  }
  if (nota.length > LARGO_NOTA_MAXIMO) return { ok: false, error: `La nota pasa de ${LARGO_NOTA_MAXIMO} caracteres.` };

  return {
    ok: true,
    escrita: { regla: { obligatorio, vence, diasDeAviso: aviso, periodicidadMeses: meses }, nota },
  };
}

/** La regla en una frase corta, para el apoyo de una pieza. */
export function reglaEnPalabras(regla: ReglaDeTipo | null): string {
  if (!regla) return "sin regla";
  const partes = [
    regla.obligatorio === true ? "obligatorio" : regla.obligatorio === false ? "opcional" : null,
    regla.vence === true
      ? regla.periodicidadMeses
        ? `vence cada ${regla.periodicidadMeses === 12 ? "año" : `${regla.periodicidadMeses} meses`}`
        : "vence"
      : regla.vence === false
        ? "no vence"
        : null,
  ].filter(Boolean);
  return partes.join(" · ") || "a medio cargar";
}

const PIEZA: Record<PiezaDeRegla, string> = {
  obligatorio: "si es obligatorio",
  vence: "si vence",
  dias_de_aviso: "los días de aviso",
};

export function faltantesEnPalabras(faltan: readonly PiezaDeRegla[]): string {
  return faltan.map((f) => PIEZA[f]).join(", ");
}

/** El valor de un campo de tres estados, para volver a marcarlo en el formulario. */
export function tresEstadosDe(valor: boolean | null | undefined): TresEstados {
  return valor === true ? "si" : valor === false ? "no" : "sin_decidir";
}

// ── Las rutas del catálogo ───────────────────────────────────────────────

export const RAIZ_CATALOGO = "/casa/jstaff/cuentas-y-demos/catalogo";

export const rutasDelCatalogo = {
  catalogo: (mercadoId?: string | null) => (mercadoId ? `${RAIZ_CATALOGO}?mercado=${encodeURIComponent(mercadoId)}` : RAIZ_CATALOGO),
  tipo: (tipoId: string) => `${RAIZ_CATALOGO}/${tipoId}`,
  /** Editar o revisar, llevando los campos tal como se escribieron. */
  accion: (tipoId: string, accion: "editar" | "revisar", campos: Partial<Record<(typeof CAMPOS_DE_REGLA)[number], string>> = {}, error?: string) => {
    const q = new URLSearchParams({ accion });
    for (const c of CAMPOS_DE_REGLA) {
      const v = campos[c];
      if (v !== undefined && v !== "") q.set(c, v.slice(0, 600));
    }
    if (error) q.set("error", error);
    return `${RAIZ_CATALOGO}/${tipoId}?${q.toString()}`;
  },
};
