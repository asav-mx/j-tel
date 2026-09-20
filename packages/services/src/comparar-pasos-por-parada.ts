/**
 * Compara los pasos ya detectados de una parada contra la promesa por
 * franja — la tercera parte de la decisión C del Marco 9.2, que
 * `detectarPasosEnRecorrido` deja pendiente a propósito (ver
 * `docs/Ficha-Construccion-Pasos-Por-Parada.md`, §3).
 *
 * **Vive en `services`, no en un repositorio.** Cruza `PasoPorParadaRepository`
 * y `CircuitRepository` —dos repositorios que no se llaman entre sí en esta
 * casa—, igual que `VerificationService` cruza los suyos. Aquí es donde va
 * la composición, no dentro de una clase de `@jtel/db`.
 *
 * Decisiones de Asav, 20-sep-2026:
 *
 * 1. **La ventana se ancla al paso ANTERIOR**, no a la hora del reloj: lo que
 *    importa es cuánto esperó el pasajero, no en qué hora del día llegó el
 *    camión.
 * 2. **La tolerancia es porcentaje de la frecuencia**, no segundos fijos —
 *    vive en `circuits.arrival_tolerance_pct`, por circuito.
 * 3. **El primer paso del día se compara contra la apertura declarada**, no
 *    contra nada — y si ni eso alcanza, es `sin_datos`, nunca inventado.
 */
import { aperturaDeclaradaEnFecha } from "@jtel/domain/publico";
import { localDateIso, compararPaso, type VeredictoDePaso } from "@jtel/domain";
import type { Repositories } from "@jtel/db";

export interface PasoConVeredicto {
  pasoId: string;
  pasoDesde: Date;
  pasoHasta: Date;
  veredicto: VeredictoDePaso;
}

export async function compararPasosDeParada(
  repos: Repositories,
  input: {
    concessionAccountId: string;
    circuitId: string;
    stopId: string;
    sentido: "ida" | "vuelta";
    detectorVersion: string;
  },
): Promise<PasoConVeredicto[]> {
  const circuito = await repos.circuits.getCircuit(input.circuitId);
  // El circuito de otra cuenta responde igual que uno que no existe (el muro).
  if (!circuito || circuito.concessionAccountId !== input.concessionAccountId) {
    throw new Error(`No existe el circuito ${input.circuitId}`);
  }

  const todos = await repos.pasosPorParada.listarPasosDeParada(input.concessionAccountId, input.stopId);
  const pasos = todos
    .filter((p) => p.sentido === input.sentido && p.detectorVersion === input.detectorVersion)
    .sort((a, b) => a.pasoDesde.getTime() - b.pasoDesde.getTime());

  const resultados: PasoConVeredicto[] = [];
  let anteriorHasta: Date | null = null;
  let anteriorFechaCivil: string | null = null;

  for (const paso of pasos) {
    const fechaCivil = localDateIso(paso.pasoDesde, circuito.timeZone);

    /*
     * El paso anterior sólo cuenta como ancla si fue el MISMO día civil — un
     * paso de ayer a las 22:58 no es "el anterior" del primero de hoy a las
     * 05:03; eso es exactamente el caso de la decisión de Asav.
     */
    const pasoAnteriorHasta = anteriorFechaCivil === fechaCivil ? anteriorHasta : null;
    const aperturaDeclarada = pasoAnteriorHasta
      ? null
      : aperturaDeclaradaEnFecha(circuito.serviceStartLocal, fechaCivil, circuito.timeZone);

    const promesa = await repos.circuits.getPromesaEnInstante(
      input.circuitId,
      paso.pasoDesde,
      input.sentido,
      circuito.timeZone,
    );

    const veredicto = compararPaso(
      { pasoDesde: paso.pasoDesde, pasoHasta: paso.pasoHasta },
      {
        pasoAnteriorHasta,
        aperturaDeclarada,
        frequencyMinutes: promesa.declarada ? promesa.frequencyMinutes : null,
        toleranciaPct: circuito.arrivalTolerancePct,
      },
    );

    resultados.push({ pasoId: paso.id, pasoDesde: paso.pasoDesde, pasoHasta: paso.pasoHasta, veredicto });

    anteriorHasta = paso.pasoHasta;
    anteriorFechaCivil = fechaCivil;
  }

  return resultados;
}
