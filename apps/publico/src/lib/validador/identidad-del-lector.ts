"use client";

import { useCallback, useEffect, useState } from "react";
import { crearPortador } from "@jtel/domain/boleto";

/**
 * **Quién es este lector** — Ontoy 3.0 · PR P3.5.
 *
 * El aparato escribe en el libro de J-Tel, y el libro no se puede editar
 * después. Así que hace falta saber de qué aparato viene cada renglón, y que
 * nadie más pueda decir que es él: el lector guarda un par de llaves Ed25519 y
 * firma con la privada cada lote que entrega.
 *
 * ## La privada nace aquí y no sale de aquí
 *
 * Se genera en el aparato la primera vez que se abre la pantalla. **No viaja**:
 * lo que J-Tel registra es la pública. Si alguien borra los datos del
 * navegador, el lector pierde su identidad y hay que darlo de alta otra vez —
 * es el mismo trato que un aparato al que se le cambia la tarjeta, y es mejor
 * que una llave que se pueda copiar de un lado a otro.
 *
 * ## Cómo sabe cómo se llama
 *
 * No lo sabe hasta que alguien lo da de alta en J-Tel. Mientras tanto la
 * pantalla enseña su llave para que quien lo registre la copie, y dice en
 * claro que **lo que lea no se va a poder entregar todavía**. Cuando hay señal,
 * el lector pregunta por su propia llave y se entera de su nombre.
 *
 * Mientras no esté registrado el lector **sigue leyendo y sigue quemando**: sin
 * red ya decidía solo, y quedarse mudo porque falta un trámite dejaría gente
 * abajo. Lo que se acumula se entrega el día que lo registren.
 */

const LLAVE_GUARDADA = "ontoy:lector:identidad";

export interface IdentidadDelLector {
  /** Hex de 64. Es lo que se registra en J-Tel. */
  readonly llavePublica: string;
  /** Hex. **Vive sólo en este aparato.** */
  readonly privada: string;
  /** El id que le dio J-Tel, o null si nadie lo ha registrado. */
  readonly lectorId: string | null;
  /** Su nombre generado (`LEC-003`), cuando ya está registrado. */
  readonly label: string | null;
}

const aHex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export const deHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{2}/g)?.map((p) => parseInt(p, 16)) ?? []);

function nacer(): IdentidadDelLector {
  const par = crearPortador();
  return { llavePublica: aHex(par.publica), privada: aHex(par.privada), lectorId: null, label: null };
}

function leer(): IdentidadDelLector | null {
  try {
    const crudo = window.localStorage.getItem(LLAVE_GUARDADA);
    if (!crudo) return null;
    const valor = JSON.parse(crudo) as Partial<IdentidadDelLector>;
    if (typeof valor?.llavePublica !== "string" || typeof valor?.privada !== "string") return null;
    return {
      llavePublica: valor.llavePublica,
      privada: valor.privada,
      lectorId: typeof valor.lectorId === "string" ? valor.lectorId : null,
      label: typeof valor.label === "string" ? valor.label : null,
    };
  } catch {
    return null;
  }
}

function escribir(identidad: IdentidadDelLector): void {
  try {
    window.localStorage.setItem(LLAVE_GUARDADA, JSON.stringify(identidad));
  } catch {
    /* Sin dónde guardar, el lector sirve igual esta sesión: lee, quema y
       decide. Lo que no puede es entregar, porque su llave no sobrevive. */
  }
}

export function useIdentidadDelLector() {
  const [identidad, setIdentidad] = useState<IdentidadDelLector | null>(null);

  useEffect(() => {
    const guardada = leer() ?? nacer();
    escribir(guardada);
    setIdentidad(guardada);
  }, []);

  /**
   * Pregunta por su propia llave. Sólo cambia algo si J-Tel lo reconoce: un
   * 404 no borra el nombre que ya tenía —la red se cae más seguido que un
   * lector se da de baja—, y quedarse sin nombre por un timeout sería peor.
   */
  const preguntarQuienSoy = useCallback(async () => {
    if (!identidad) return;
    try {
      const r = await fetch(`/api/boletos/lector?llave=${identidad.llavePublica}`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const dicho = (await r.json()) as { lector_id?: string; label?: string };
      if (!dicho?.lector_id) return;
      if (dicho.lector_id === identidad.lectorId && dicho.label === identidad.label) return;
      const siguiente = {
        ...identidad,
        lectorId: dicho.lector_id,
        label: dicho.label ?? identidad.label,
      };
      escribir(siguiente);
      setIdentidad(siguiente);
    } catch {
      /* Sin red no pasa nada: se vuelve a preguntar cuando haya. */
    }
  }, [identidad]);

  return { identidad, preguntarQuienSoy };
}
