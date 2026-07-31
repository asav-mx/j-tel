/**
 * Reunir lo que la oficina del contrato necesita — la parte que toca la base.
 *
 * La medición vive en `contrato-lectura.ts` y se prueba sin base de datos.
 * Aquí solo se consulta y se arma.
 *
 * Todo se lee de hechos YA sellados. Abrir esta pantalla no verifica nada de
 * nuevo: la ley 2 no se toca desde aquí.
 */

import { contractPolicySchema, type ContractPolicy } from "@jtel/domain";
import { routeWindowSizing, windowForOccurrence } from "@jtel/db";
import { getRepos } from "@/lib/db";
import { addDaysIso, todayIso } from "@/lib/date-range";
import type { HechoParaLectura } from "@/lib/contrato-lectura";

/**
 * Ventana de lectura de la operación.
 *
 * Sesenta días son suficientes para que una operación mensual muestre su
 * forma, y bastante menos que traerse la historia entera para dibujar cuatro
 * medianas. Se dice en pantalla — un dato sin su periodo es medio dato.
 */
export const DIAS_DE_LECTURA = 60;

export type TurnoDelContrato = {
  routeShiftId: string;
  routeId: string | null;
  ruta: string;
  turno: string;
  /** Hora de entrada declarada del turno. De aquí sale la hora límite. */
  horaEntrada: string | null;
  perfiles: number;
  /**
   * El ancho de ventana que esta ruta produce hoy, y de dónde salió.
   *
   * `basis` no se adivina: lo declara el dominio al derivar. Es la diferencia
   * entre un número medido, uno estimado de la geometría del trazado, y el
   * piso de política — y el usuario tiene derecho a saber cuál está viendo
   * antes de tocar nada.
   */
  ventana: {
    beforeMinutes: number;
    basis: import("@jtel/domain").ObservationWindowBasis;
    /** Duración de ruta con la que se dimensionó; null si mandó la política. */
    routeDurationMinutes: number | null;
    /** Cuántos recorridos medidos sostienen la duración. */
    muestras: number;
    /** El tope recortó lo que la duración pedía: la ventana sigue corta. */
    recortadaPorTope: boolean;
  } | null;
};

export type ContratoEnOficina = {
  id: string;
  nombre: string;
  estado: string;
  validFrom: string;
  validTo: string;
  carrier: string | null;
  alcance: string | null;
  policy: import("@jtel/domain").ContractPolicy;
  perfiles: number;
};

export type DatosDeOficina = {
  contrato: ContratoEnOficina;
  turnos: TurnoDelContrato[];
  hechos: HechoParaLectura[];
  /** Periodo que sostiene las lecturas. */
  periodo: { desde: string; hasta: string; dias: number };
};

/**
 * Un contrato del cliente, con su operación medida.
 *
 * La pertenencia al cliente se verifica aquí y no en la vista: un contrato de
 * otro cliente devuelve `null` y la página responde 404. La frontera de cuenta
 * la hace cumplir el código.
 */
export async function cargarOficinaDeContrato(entrada: {
  clientAccountId: string;
  contractId: string;
  dias?: number;
}): Promise<DatosDeOficina | null> {
  const repos = getRepos();
  const contratoCrudo = await repos.contracts.findById(entrada.contractId);
  if (!contratoCrudo || contratoCrudo.clientAccountId !== entrada.clientAccountId) return null;

  /*
   * La política se lee CON los defaults del esquema aplicados.
   *
   * La política vive como jsonb y los contratos viejos no traen las llaves que
   * se agregaron después. El motor las resuelve con su default al leerlas, así
   * que ese default ES el valor vigente. Enseñar el campo vacío haría creer
   * que la perilla está sin efecto, y peor con las casillas: una casilla
   * desmarcada por llave ausente invita a guardar `false` y apagar de verdad
   * algo que estaba encendido. Se muestra lo que el motor usa.
   *
   * Si la política guardada fuera inválida se usa tal cual: esta pantalla
   * informa, no repara — y esconder un dato corrupto sería peor.
   */
  const parsed = contractPolicySchema.safeParse(contratoCrudo.policy);
  const policy: ContractPolicy = parsed.success ? parsed.data : contratoCrudo.policy;
  const contrato = { ...contratoCrudo, policy };

  const dias = entrada.dias ?? DIAS_DE_LECTURA;
  const hasta = todayIso();
  const desde = addDaysIso(hasta, -dias);

  // `findById` no carga el carrier: se resuelve aparte en vez de asumirlo.
  const [perfiles, ocurrencias, carrier] = await Promise.all([
    repos.profiles.findForContract(contrato.id),
    repos.occurrences.findForContract(
      contrato.id,
      new Date(`${desde}T00:00:00.000Z`),
      new Date(`${hasta}T23:59:59.999Z`),
    ),
    repos.accounts.findById(contrato.carrierAccountId),
  ]);

  // Un turno por par ruta+turno, con cuántos perfiles cuelgan de él. La hora
  // de entrada viene del turno declarado: es el número del que sale la hora
  // límite, y por eso se muestra aquí junto a la operación real.
  const porRouteShift = new Map<string, TurnoDelContrato>();
  for (const p of perfiles) {
    const rs = p.routeShift;
    if (!rs) continue;
    const previo = porRouteShift.get(rs.id);
    if (previo) {
      previo.perfiles++;
      continue;
    }
    porRouteShift.set(rs.id, {
      routeShiftId: rs.id,
      routeId: rs.routeId ?? null,
      ruta: rs.route?.name ?? "—",
      turno: rs.shift?.name ?? "—",
      horaEntrada: rs.shift?.startTime ?? null,
      perfiles: 1,
      ventana: null,
    });
  }

  // El ancho de ventana de cada ruta, con la MISMA función que usa la
  // generación de ocurrencias. Recalcularlo aquí con otra fórmula sería
  // enseñarle al usuario un número que el motor no usa.
  await Promise.all(
    [...porRouteShift.values()].map(async (t) => {
      const [muestras, kml] = await Promise.all([
        repos.routeTraversals.recentSamples(t.routeShiftId),
        t.routeId ? repos.routes.getKmlVersionForDate(t.routeId, new Date()) : null,
      ]);

      const sizing = routeWindowSizing(kml?.waypoints, muestras, contrato.policy);
      // El deadline concreto no importa para el ANCHO: se usa uno cualquiera
      // y se lee `beforeMinutes`, que es lo que esta pantalla muestra.
      const derivada = windowForOccurrence(new Date(), contrato.policy, sizing);

      t.ventana = {
        beforeMinutes: derivada.beforeMinutes,
        basis: derivada.basis,
        routeDurationMinutes: derivada.routeDurationMinutes,
        muestras: muestras.length,
        recortadaPorTope: derivada.cappedByMax,
      };
    }),
  );

  const hechos: HechoParaLectura[] = [];
  for (const o of ocurrencias) {
    const f = o.complianceFact;
    if (!f) continue;
    hechos.push({
      estado: f.status,
      deadline: f.expectedDeadline,
      llegada: f.observedArrivalAt ?? null,
      coberturaRutaPct: f.observedRouteMatchPct ?? null,
      motivoExcusable: f.excusableReason ?? null,
    });
  }

  const alcance =
    contrato.plant?.name ??
    (contrato.plantGroup ? `Campus ${contrato.plantGroup.name}` : null);

  return {
    contrato: {
      id: contrato.id,
      nombre: contrato.name,
      estado: contrato.status,
      validFrom: contrato.validFrom,
      validTo: contrato.validTo,
      carrier: carrier?.name ?? null,
      alcance,
      policy: contrato.policy,
      perfiles: perfiles.length,
    },
    turnos: [...porRouteShift.values()].sort(
      (a, b) => (a.horaEntrada ?? "").localeCompare(b.horaEntrada ?? "") || a.ruta.localeCompare(b.ruta, "es"),
    ),
    hechos,
    periodo: { desde, hasta, dias },
  };
}
