"use client";

import { useCallback, useEffect, useState } from "react";
import { jornadaNueva, type JornadaDelLector, type RegistroDePaso } from "@jtel/domain/validador";

/**
 * La jornada vive **en el aparato**, como todo lo demás del lector.
 *
 * Mismo trato que el pase del pasajero: `try/catch` en cada lectura y escritura
 * porque `localStorage` lanza en una ventana privada, y el estado se llena al
 * montar y no durante el primer dibujo.
 *
 * ## Por qué la jornada se reinicia sola al cambiar el día
 *
 * El tope sin señal y el de los códigos dictados son **por lector y por día**.
 * Si la jornada no se reinicia, un lector que lleva tres días sin sincronizar
 * dejaría de aceptar y nadie sabría por qué. Se compara la fecha local, que es
 * la del chofer.
 *
 * ## Lo que NO se borra
 *
 * Los pasos de un día que termina se pierden aquí, y eso está mal a la larga:
 * son evidencia y la ficha dice que cada viaje es un renglón que no se borra.
 * Hoy no hay a dónde mandarlos —la sincronización llega con el P4— así que el
 * aparato guarda **la jornada de hoy y la del día anterior**, para que un
 * cambio de día a media noche no se lleve lo que nadie subió todavía.
 */

const LLAVE = "ontoy:lector";

interface Guardado {
  aparato: string;
  jornadas: JornadaDelLector[];
}

/** Folio → instante, tal como lo guarda `MemoriaDeQuemados`. */
type QuemadosPlanos = Array<[string, number]>;

interface JornadaPlana {
  aparato: string;
  dia: string;
  quemados: QuemadosPlanos;
  pasos: RegistroDePaso[];
}

const aplanar = (j: JornadaDelLector): JornadaPlana => ({
  aparato: j.aparato,
  dia: j.dia,
  quemados: [...j.quemados],
  pasos: [...j.pasos],
});

const levantar = (p: JornadaPlana): JornadaDelLector => ({
  aparato: p.aparato,
  dia: p.dia,
  quemados: new Map(p.quemados),
  pasos: p.pasos,
});

/** La fecha del lector, en su propia zona. */
export const diaDeHoy = (ahora = new Date()): string =>
  `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;

/**
 * El nombre del aparato. Nace la primera vez y se queda: sin él, dos lectores
 * en el mismo taller se confundirían al conciliar.
 */
function aparatoDeEsteLector(): string {
  const azar = Math.floor(Math.random() * 100);
  return `J-VAL-${String(azar).padStart(2, "0")}`;
}

export function useJornadaDelLector() {
  const [jornada, setJornada] = useState<JornadaDelLector | null>(null);
  const [anterior, setAnterior] = useState<JornadaDelLector | null>(null);

  useEffect(() => {
    const hoy = diaDeHoy();
    let guardado: Guardado | null = null;
    try {
      const crudo = window.localStorage.getItem(LLAVE);
      if (crudo) {
        const leido = JSON.parse(crudo) as { aparato: string; jornadas: JornadaPlana[] };
        guardado = { aparato: leido.aparato, jornadas: leido.jornadas.map(levantar) };
      }
    } catch {
      /* sin dónde guardar: el lector sirve igual, sin memoria entre recargas */
    }
    const aparato = guardado?.aparato ?? aparatoDeEsteLector();
    const deHoy = guardado?.jornadas.find((j) => j.dia === hoy) ?? jornadaNueva(aparato, hoy);
    setJornada(deHoy);
    setAnterior(guardado?.jornadas.find((j) => j.dia !== hoy) ?? null);
  }, []);

  const guardar = useCallback(
    (siguiente: JornadaDelLector) => {
      setJornada(siguiente);
      try {
        const jornadas = [siguiente, anterior].filter((j): j is JornadaDelLector => j !== null);
        window.localStorage.setItem(
          LLAVE,
          JSON.stringify({ aparato: siguiente.aparato, jornadas: jornadas.map(aplanar) }),
        );
      } catch {
        /* igual que arriba */
      }
    },
    [anterior],
  );

  return { jornada, guardar };
}
