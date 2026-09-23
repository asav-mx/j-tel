"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  marcarEntregados,
  marcarRechazadoPorJTel,
  porSincronizar,
  type JornadaDelLector,
} from "@jtel/domain/validador";
import { firmarLote, type LoteDelLector, type PasoEntregado } from "@jtel/domain/sincronizacion";
import { deHex, type IdentidadDelLector } from "./identidad-del-lector";

/**
 * **La entrega del lector** — Ontoy 3.0 · PR P3.5.
 *
 * Oportunista (opción A1, decidida por Asav el 23-sep-2026): en cuanto hay
 * señal y algo que contar, se entrega. Si falla, se reintenta con esperas cada
 * vez más largas hasta un minuto, y ahí se queda.
 *
 * ## Por qué también late cuando no hay nada que entregar
 *
 * **Un camión vacío no es un lector mudo** (Asav). Sin latido, el servidor no
 * puede distinguir «nadie se subió en toda la tarde» de «este aparato se
 * apagó», y las dos cosas piden cosas distintas: una no es nada y la otra es ir
 * a ver el camión. El latido es un lote de cero renglones, firmado igual.
 *
 * ## Lo que se entrega, y lo que se guarda de vuelta
 *
 * Van los pasos **sin acuse**. De lo que J-Tel contesta, el aparato guarda dos
 * cosas: cuáles quedaron asentados —dejan de contar para el tope— y cuáles no
 * aceptó, con su motivo. **Los rechazados también se marcan**: un renglón que
 * J-Tel rechaza hoy lo rechazará siempre, y reintentarlo sería un lazo que no
 * cierra.
 *
 * ## Una jornada por lote, y la más vieja primero
 *
 * Un lote lleva **un día** —así lo firma y así lo recibe el libro—, y el
 * aparato puede estar cargando varias jornadas si pasó días sin señal (ver
 * `jornadasQueSeGuardan`). Cada vuelta entrega **la jornada más vieja que
 * todavía deba algo**: lo que más tiempo lleva esperando sale primero, y es
 * también lo que primero libera lugar en la memoria del aparato.
 *
 * Cuando no queda nada que deber, el latido sale con la jornada de hoy.
 *
 * ## Lo que esto NO hace
 *
 * No decide nada del boleto. Cuando este módulo corre, el veredicto ya lo dio
 * el aparato solo y sin red: aquí sólo se cuenta lo que pasó.
 */

/** Qué tan seguido late un lector que no tiene nada que entregar. */
export const LATIDO_MS = 5 * 60_000;

/**
 * Las esperas entre reintentos, en milisegundos. La última se repite.
 *
 * Crecen porque la causa de un fallo casi siempre es la señal, y machacar cada
 * dos segundos en un túnel gasta batería sin entregar nada. El tope de un
 * minuto no es arbitrario: por encima de eso, un lector que recupera señal al
 * salir de un puente tardaría en darse cuenta.
 */
export const ESPERAS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

export type EstadoDeLaEntrega =
  | { readonly que: "reposo"; readonly ultima: number | null }
  | { readonly que: "entregando" }
  | { readonly que: "sin_registrar" }
  | { readonly que: "falla"; readonly motivo: string; readonly reintentoEn: number };

interface Respuesta {
  acusados?: string[];
  rechazados?: Array<{ paso: string; motivo: string }>;
  hallazgos?: number;
  error?: string;
}

/**
 * Cuál de las jornadas del aparato toca entregar: **la más vieja que deba
 * algo**, y si ninguna debe, la de hoy —que es la que late—.
 */
export function laQueToca(
  jornadas: readonly JornadaDelLector[],
  hoy: string,
): JornadaDelLector | null {
  const deudoras = jornadas
    .filter((j) => porSincronizar(j) > 0)
    .sort((a, b) => a.dia.localeCompare(b.dia));
  return deudoras[0] ?? jornadas.find((j) => j.dia === hoy) ?? null;
}

export function useEntregaDelLector(args: {
  jornadas: readonly JornadaDelLector[];
  hoy: string;
  identidad: IdentidadDelLector | null;
  haySenal: boolean;
  guardar: (j: JornadaDelLector) => void;
}) {
  const { jornadas, hoy, identidad, haySenal, guardar } = args;
  const [estado, setEstado] = useState<EstadoDeLaEntrega>({ que: "reposo", ultima: null });

  /* Los vivos: el temporizador no puede quedarse con la jornada de hace rato. */
  const jornadaViva = useRef<JornadaDelLector | null>(null);
  const identidadViva = useRef<IdentidadDelLector | null>(null);
  const entregando = useRef(false);
  const intentos = useRef(0);
  jornadaViva.current = laQueToca(jornadas, hoy);
  identidadViva.current = identidad;

  /** Lo que el aparato debe entre TODAS sus jornadas. */
  const debe = jornadas.reduce((n, j) => n + porSincronizar(j), 0);

  const entregar = useCallback(async () => {
    const actual = jornadaViva.current;
    const quienEs = identidadViva.current;
    if (!actual || !quienEs || entregando.current) return;
    if (!quienEs.lectorId) {
      setEstado({ que: "sin_registrar" });
      return;
    }

    entregando.current = true;
    setEstado({ que: "entregando" });
    try {
      const pendientes = actual.pasos.filter((p) => !p.entregadoEn);
      const lote: LoteDelLector = {
        lector: quienEs.lectorId,
        dia: actual.dia,
        armadoEn: Date.now(),
        pasos: pendientes.map(
          (p): PasoEntregado => ({
            paso: p.id,
            folio: p.folio,
            via: p.via,
            cuando: p.cuando,
            conSenal: p.conSenal,
            /* El boleto entero viaja para que el servidor re-verifique la firma
               de J-Tel. La vía dictada no lo trae: no hay firma que comprobar. */
            ...(p.via === "qr" && p.boleto ? { boleto: p.boleto } : {}),
          }),
        ),
      };
      const firma = firmarLote(lote, deHex(quienEs.privada));

      const r = await fetch("/api/boletos/sincronizar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lote, firma }),
      });
      const dicho = (await r.json().catch(() => ({}))) as Respuesta;

      if (!r.ok) {
        intentos.current += 1;
        const espera = ESPERAS_MS[Math.min(intentos.current - 1, ESPERAS_MS.length - 1)]!;
        setEstado({
          que: "falla",
          motivo: dicho?.error ?? `${r.status}`,
          reintentoEn: Date.now() + espera,
        });
        return;
      }

      intentos.current = 0;
      const ahora = Date.now();
      let siguiente = marcarEntregados(actual, dicho.acusados ?? [], ahora);
      siguiente = marcarRechazadoPorJTel(
        siguiente,
        (dicho.rechazados ?? []).map((x) => ({ id: x.paso, motivo: x.motivo })),
        ahora,
      );
      if (siguiente !== actual) guardar(siguiente);
      setEstado({ que: "reposo", ultima: ahora });
    } catch (e) {
      intentos.current += 1;
      const espera = ESPERAS_MS[Math.min(intentos.current - 1, ESPERAS_MS.length - 1)]!;
      setEstado({
        que: "falla",
        motivo: e instanceof Error ? e.message : "no se pudo entregar",
        reintentoEn: Date.now() + espera,
      });
    } finally {
      entregando.current = false;
    }
  }, [guardar]);

  /* En cuanto hay señal y hay algo que contar, en cualquiera de sus jornadas. */
  useEffect(() => {
    if (!haySenal || debe === 0 || !identidad?.lectorId) return;
    const t = setTimeout(() => void entregar(), 0);
    return () => clearTimeout(t);
  }, [haySenal, debe, identidad?.lectorId, entregar]);

  /* El reintento, y el latido: un solo reloj que se pregunta qué toca. */
  useEffect(() => {
    if (!haySenal) return;
    const reloj = setInterval(() => {
      const actual = jornadaViva.current;
      if (!actual || !identidadViva.current?.lectorId) return;
      if (estado.que === "falla" && Date.now() < estado.reintentoEn) return;
      if (estado.que === "entregando") return;
      const hayQueContar = porSincronizar(actual) > 0;
      const tocaLatir =
        estado.que === "reposo" && (estado.ultima === null || Date.now() - estado.ultima >= LATIDO_MS);
      if (hayQueContar || tocaLatir || estado.que === "falla") void entregar();
    }, 2_000);
    return () => clearInterval(reloj);
  }, [haySenal, estado, entregar]);

  return { estado, entregarAhora: entregar };
}
