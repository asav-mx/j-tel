"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  jornadaNueva,
  jornadasQueSeGuardan,
  type JornadaDelLector,
  type RegistroDePaso,
} from "@jtel/domain/validador";

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
 * ## Lo que se guarda: hasta que esté entregado
 *
 * Decisión de Asav, 23-sep-2026. Se guarda la jornada de hoy y **toda jornada
 * vieja que todavía deba algo**; las viejas ya acusadas se sueltan, porque su
 * evidencia vive en el libro de J-Tel, que es el que no pierde renglones. La
 * regla entera —y el defecto que reemplaza— está en `jornadasQueSeGuardan`.
 *
 * ✎ Antes esto guardaba **dos jornadas**, la de hoy y una vieja cualquiera, y
 * su comentario decía que no había a dónde mandar nada porque «la
 * sincronización llega con el P4». El P3.5 **es** esa sincronización, así que
 * el comentario afirmaba algo falso y la regla que justificaba tiraba
 * evidencia: un lector que pasara tres cambios de día sin señal perdía los
 * pasos del día más viejo sin decir una palabra.
 *
 * ## Y si de verdad ya no cabe
 *
 * `localStorage` tiene un tope, y guardar cada boleto entero —hace falta: el
 * servidor re-verifica su firma— lo acerca. Cuando el navegador dice que no
 * cabe, **no se tira nada**: lo aceptado sigue en la memoria de esta pantalla,
 * se avisa con `memoriaLlena` y la pantalla lo dice. Cada entrega que acuse
 * algo libera lugar y el siguiente guardado vuelve a pasar solo.
 *
 * Lo que se pierde en ese estado es lo de **una recarga**, no lo del día — y se
 * pierde habiéndolo dicho, que es lo que pedía la regla.
 */

const LLAVE = "ontoy:lector";

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

/**
 * **Lo guardado, en texto.** La memoria de quemados es un `Map`, y un `Map`
 * **no sobrevive a `JSON.stringify`** —sale `{}`, sin error y sin aviso—, así
 * que se aplana a pares y se vuelve a levantar al leer. Es exactamente el tipo
 * de pérdida silenciosa que esta tanda de cambios existe para cerrar, y por eso
 * las dos mitades se prueban juntas.
 */
export const serializar = (aparato: string, jornadas: readonly JornadaDelLector[]): string =>
  JSON.stringify({ aparato, jornadas: jornadas.map(aplanar) });

/** Lo guardado, de vuelta. `null` si no hay nada o si lo que hay no se entiende. */
export function deserializar(
  crudo: string | null,
): { aparato: string; jornadas: JornadaDelLector[] } | null {
  if (!crudo) return null;
  try {
    const leido = JSON.parse(crudo) as { aparato?: string; jornadas?: JornadaPlana[] };
    if (typeof leido?.aparato !== "string" || !Array.isArray(leido.jornadas)) return null;
    return { aparato: leido.aparato, jornadas: leido.jornadas.map(levantar) };
  } catch {
    /* Un aparato con la memoria revuelta arranca de cero, no se queda tildado. */
    return null;
  }
}

/** Lo mínimo que este módulo necesita de `localStorage`, para poder probarlo. */
export interface DondeSeGuarda {
  getItem(llave: string): string | null;
  setItem(llave: string, valor: string): void;
}

/**
 * Escribe, y **dice si no cupo**. Nunca tira nada para hacer lugar: quien
 * decide qué se guarda es `jornadasQueSeGuardan`, y su respuesta es «hasta que
 * esté entregado». Si el navegador dice que no cabe, lo aceptado sigue en la
 * memoria de la pantalla y ésta lo avisa.
 */
export function guardarEnElAparato(
  donde: DondeSeGuarda | null,
  aparato: string,
  jornadas: readonly JornadaDelLector[],
): "guardado" | "no_cabe" {
  if (!donde) return "no_cabe";
  try {
    donde.setItem(LLAVE, serializar(aparato, jornadas));
    return "guardado";
  } catch {
    return "no_cabe";
  }
}

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

/** Cambia la jornada de ese día por la nueva; si no estaba, la agrega. */
export function reemplazarPorDia(
  jornadas: readonly JornadaDelLector[],
  siguiente: JornadaDelLector,
): JornadaDelLector[] {
  const sinElla = jornadas.filter((j) => j.dia !== siguiente.dia);
  return [siguiente, ...sinElla];
}

export function useJornadaDelLector() {
  const [todas, setTodas] = useState<JornadaDelLector[] | null>(null);
  const [memoriaLlena, setMemoriaLlena] = useState(false);
  /* El día se fija al montar: el resto del lector cuenta sus topes contra él. */
  const hoy = useRef(diaDeHoy());
  const vivas = useRef<JornadaDelLector[]>([]);

  useEffect(() => {
    let leido: { aparato: string; jornadas: JornadaDelLector[] } | null = null;
    try {
      leido = deserializar(window.localStorage.getItem(LLAVE));
    } catch {
      /* sin dónde guardar: el lector sirve igual, sin memoria entre recargas */
    }
    const guardadas = leido?.jornadas ?? [];
    const nombre = leido?.aparato ?? aparatoDeEsteLector();
    const conHoy = guardadas.some((j) => j.dia === hoy.current)
      ? guardadas
      : [jornadaNueva(nombre, hoy.current), ...guardadas];
    const iniciales = jornadasQueSeGuardan(conHoy, hoy.current);
    vivas.current = iniciales;
    setTodas(iniciales);
  }, []);

  const guardar = useCallback((siguiente: JornadaDelLector) => {
    const proximas = jornadasQueSeGuardan(
      reemplazarPorDia(vivas.current, siguiente),
      hoy.current,
    );
    vivas.current = proximas;
    setTodas(proximas);
    /*
     * Si no cabe, **nada se tira**: lo de arriba ya quedó en la memoria de esta
     * pantalla, y la pantalla lo dice. Cuando una entrega acuse algo, las
     * jornadas viejas se sueltan solas y el siguiente guardado vuelve a caber.
     */
    let donde: DondeSeGuarda | null = null;
    try {
      donde = window.localStorage;
    } catch {
      /* ventana privada con el almacenamiento cerrado: leer la propiedad lanza */
    }
    setMemoriaLlena(guardarEnElAparato(donde, siguiente.aparato, proximas) === "no_cabe");
  }, []);

  const jornada = todas?.find((j) => j.dia === hoy.current) ?? null;
  const viejas = todas?.filter((j) => j.dia !== hoy.current) ?? [];

  return { jornada, viejas, todas: todas ?? [], guardar, memoriaLlena };
}
