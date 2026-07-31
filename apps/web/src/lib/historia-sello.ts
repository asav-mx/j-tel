import type { ContractPolicy } from "@jtel/domain";
import type { EstadoServicio } from "@jtel/services";

/**
 * La historia del sello — las versiones de un resultado y la causa de cada una.
 *
 * Un resultado se calcula una vez y se congela (Ley 2). La única forma de que
 * cambie es una verificación nueva, explícita y firmada. Cuando eso pasa, el
 * hecho anterior no se borra: se archiva en `compliance_fact_history` con la
 * foto completa y con quién causó el reemplazo. Este archivo convierte esas
 * filas en lo que la pantalla necesita leer.
 *
 * Cómo se alinean las filas con las versiones — la parte que se presta a
 * error: `archiveAndDeleteFact` guarda la foto del hecho VIEJO junto con el
 * actor de la verificación NUEVA que lo está reemplazando. Entonces
 * `historia[i].actorKind` no firma a `historia[i]`, firma a la versión que
 * viene DESPUÉS. La versión más antigua no tiene fila que la firme — nadie la
 * pidió, es la primera verificación del árbitro.
 *
 *     historia[0].factSnapshot ─── versión 0 (la primera)     firma: el árbitro
 *     historia[1].factSnapshot ─── versión 1                  firma: historia[0]
 *     historia[2].factSnapshot ─── versión 2                  firma: historia[1]
 *     compliance_facts        ─── versión 3 (vigente)         firma: historia[2]
 *
 * Todo lo que sale de aquí es serializable (instantes en ISO), para que el
 * mismo payload sirva en componente de servidor y de cliente.
 */

/** Quién causó una versión, y si eso fue una decisión o el sistema cuadrando. */
export type IntencionSello = "primera" | "decision" | "consolidacion";

export type FirmaSello = {
  intencion: IntencionSello;
  /** El sello de la versión, dentro del cajón. Pre-auth es un rol o un proceso — jamás un nombre propio. */
  texto: string;
  /** La misma autoría dicha como frase, para colgarla de la marca en una línea. */
  marca: string;
};

/**
 * Una cifra de la versión, con la referencia que la vuelve legible al lado.
 *
 * Va tipada y no formateada porque el texto final depende de la zona horaria
 * del contrato, que la conoce la pantalla y no esta capa.
 */
export type LecturaVersion =
  | { tipo: "llegada"; llegadaIso: string; limiteIso: string; toleranciaMinutos: number }
  | { tipo: "cobertura"; medidoPct: number; umbralPct: number | null }
  | { tipo: "excusa"; motivo: string };

export type VersionSello = {
  /** Cuándo se selló ESTA versión. `null` si la foto archivada no lo trae. */
  selladoEnIso: string | null;
  estado: EstadoServicio;
  timing: string | null;
  vigente: boolean;
  firma: FirmaSello;
  /** Las cifras de esta versión, cada una junto a su umbral. */
  lectura: LecturaVersion[];
  /** El resultado quedó idéntico al de la versión anterior. */
  sinCambio: boolean;
};

export type HistoriaSello = {
  /** Vigente primero, la más antigua al final — como se lee en pantalla. */
  versiones: VersionSello[];
  total: number;
  /** La firma de la última versión: lo que gobierna el color de la marca. */
  ultimaFirma: FirmaSello | null;
};

/**
 * De `actor_kind` a la firma que se imprime.
 *
 * PARCHE DECLARADO, no diseño. El skill es tajante: la pantalla lee la
 * intención guardada y NUNCA la adivina del nombre del actor — un script que
 * corre un operador a mano es nombre de proceso con intención de decisión, y
 * deducir del prefijo `system:` lo pintaría como rutina cuando fue una
 * decisión.
 *
 * El motor sí distingue las dos: `verifyOccurrence` recibe
 * `actorIntent: "decision" | "maintenance"`. Pero esa intención NO se
 * persiste — `archiveAndDeleteFact` solo recibe `(occurrenceId, actorKind,
 * actorId)`, y `compliance_fact_history` no tiene columna para ella.
 *
 * Esta tabla no infiere del texto: transcribe lo que cada punto de llamada
 * declara hoy (`reverify-day.ts` y el endpoint de J-Staff pasan `"decision"`;
 * los pases de exclusividad y eliminación pasan `"maintenance"`). Es correcta
 * mientras eso no cambie, y frágil justo ahí — un llamador nuevo que use
 * `system:cli` con intención de mantenimiento haría mentir a la pantalla.
 *
 * El arreglo verdadero es una columna `actor_intent` en
 * `compliance_fact_history` poblada por `archiveAndDeleteFact`. Vive en
 * `packages/db`, fuera del alcance de este carril.
 */
const FIRMAS: Record<string, FirmaSello> = {
  human: {
    intencion: "decision",
    texto: "A petición de J-Staff",
    marca: "a petición de J-Staff",
  },
  "system:cli": {
    intencion: "decision",
    texto: "Re-verificación manual · CLI",
    marca: "re-verificación manual · CLI",
  },
  "system:exclusivity-pass": {
    intencion: "consolidacion",
    texto: "Consolidación · exclusividad de unidad",
    marca: "consolidado por exclusividad de unidad",
  },
  "system:elimination-pass": {
    intencion: "consolidacion",
    texto: "Consolidación · eliminación de candidatas",
    marca: "consolidado por eliminación de candidatas",
  },
  "system:cron": {
    intencion: "consolidacion",
    texto: "Consolidación · verificación programada",
    marca: "consolidado por la verificación programada",
  },
  "system:e2e": {
    intencion: "consolidacion",
    texto: "Consolidación · prueba de extremo a extremo",
    marca: "consolidado por una prueba de extremo a extremo",
  },
};

const PRIMERA: FirmaSello = {
  intencion: "primera",
  texto: "Primera verificación · árbitro",
  marca: "primera verificación",
};

/**
 * `actor_id` existe en la tabla pero hoy siempre llega vacío: los tres puntos
 * de entrada humanos lo pasan `null` esperando auth-rbac. Y aunque se llenara,
 * traería un id crudo del proveedor de identidad, no un nombre — imprimirlo
 * sería un campo que finge precisión. Hasta que auth-rbac resuelva el nombre
 * real, la firma honesta es el rol.
 */
function firmaDe(actorKind: string): FirmaSello {
  return (
    FIRMAS[actorKind] ?? {
      intencion: "consolidacion",
      texto: `Consolidación · ${actorKind}`,
      marca: `consolidado por ${actorKind}`,
    }
  );
}

/** La foto archivada. Se lee a la defensiva: viene de jsonb, no del tipo. */
type FotoHecho = {
  materializedAt?: string | null;
  status?: string | null;
  timing?: string | null;
  observedArrivalAt?: string | null;
  expectedDeadline?: string | null;
  observedRouteMatchPct?: number | null;
  excusableReason?: string | null;
  contractPolicySnapshot?: Partial<ContractPolicy> | null;
};

export type FilaHistoria = {
  status: string;
  timing: string | null;
  factSnapshot: unknown;
  actorKind: string;
  replacedAt: Date | string;
};

/** El hecho vigente, en la forma mínima que esta lectura necesita. */
export type HechoVigente = {
  materializedAt: Date | string | null;
  status: string;
  timing: string | null;
  observedArrivalAt: Date | string | null;
  expectedDeadline: Date | string | null;
  observedRouteMatchPct: number | null;
  excusableReason: string | null;
  contractPolicySnapshot: unknown;
};

function iso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function comoFoto(snapshot: unknown): FotoHecho {
  return snapshot && typeof snapshot === "object" ? (snapshot as FotoHecho) : {};
}

/**
 * Las cifras de una versión, cada una con la referencia que la vuelve legible.
 *
 * "Densa, sí. Cruda, jamás": una llegada sola obliga a calcular; la llegada
 * junto a su límite se lee. Lo que no esté en la foto no se inventa — se
 * omite la línea.
 */
function lecturaDe(f: FotoHecho): LecturaVersion[] {
  const lineas: LecturaVersion[] = [];
  const politica = f.contractPolicySnapshot ?? {};

  const llegadaIso = iso(f.observedArrivalAt);
  const deadlineIso = iso(f.expectedDeadline);
  if (llegadaIso && deadlineIso) {
    // El límite que gobierna es el deadline congelado MÁS la tolerancia que
    // regía en ese momento — la de la foto, no la del contrato de hoy.
    const toleranciaMinutos = politica.toleranceMinutes ?? 0;
    const limite = new Date(new Date(deadlineIso).getTime() + toleranciaMinutos * 60_000);
    lineas.push({
      tipo: "llegada",
      llegadaIso,
      limiteIso: limite.toISOString(),
      toleranciaMinutos,
    });
  }

  if (f.observedRouteMatchPct != null) {
    lineas.push({
      tipo: "cobertura",
      medidoPct: f.observedRouteMatchPct,
      umbralPct: politica.kmlMatchMinPct ?? null,
    });
  }

  if (f.excusableReason) {
    lineas.push({ tipo: "excusa", motivo: f.excusableReason });
  }

  return lineas;
}

function mismoResultado(a: VersionSello, b: VersionSello): boolean {
  return a.estado === b.estado && a.timing === b.timing;
}

/**
 * Arma la historia completa a partir del hecho vigente y sus filas archivadas.
 *
 * `fact` puede ser `null` (ocurrencia sin hecho sellado todavía); en ese caso
 * la historia queda vacía y la pantalla no dibuja marca.
 */
export function construirHistoriaSello(
  fact: HechoVigente | null,
  historia: FilaHistoria[],
): HistoriaSello {
  if (!fact) return { versiones: [], total: 0, ultimaFirma: null };

  // Orden cronológico por `replaced_at` — el eje de la cadena. `replaced_by_fact_id`
  // NO sirve para caminarla: se pone en null cuando el sucesor también se re-juzga.
  const filas = [...historia].sort(
    (a, b) => new Date(a.replacedAt).getTime() - new Date(b.replacedAt).getTime(),
  );

  const versiones: VersionSello[] = [];

  filas.forEach((fila, i) => {
    const foto = comoFoto(fila.factSnapshot);
    versiones.push({
      // Las columnas reales mandan sobre la foto: son la verdad consultable.
      estado: (fila.status ?? foto.status ?? null) as EstadoServicio,
      timing: fila.timing ?? foto.timing ?? null,
      selladoEnIso: iso(foto.materializedAt),
      vigente: false,
      // La primera versión no la pidió nadie. Las demás las firma la fila anterior.
      firma: i === 0 ? PRIMERA : firmaDe(filas[i - 1]!.actorKind),
      lectura: lecturaDe(foto),
      sinCambio: false,
    });
  });

  const ultimaFila = filas[filas.length - 1];
  versiones.push({
    estado: fact.status as EstadoServicio,
    timing: fact.timing,
    selladoEnIso: iso(fact.materializedAt),
    vigente: true,
    firma: ultimaFila ? firmaDe(ultimaFila.actorKind) : PRIMERA,
    lectura: lecturaDe({
      materializedAt: iso(fact.materializedAt),
      status: fact.status,
      timing: fact.timing,
      observedArrivalAt: iso(fact.observedArrivalAt),
      expectedDeadline: iso(fact.expectedDeadline),
      observedRouteMatchPct: fact.observedRouteMatchPct,
      excusableReason: fact.excusableReason,
      contractPolicySnapshot: (fact.contractPolicySnapshot ?? {}) as Partial<ContractPolicy>,
    }),
    sinCambio: false,
  });

  // Una verificación deliberada archiva aunque el resultado no cambie —
  // alguien decidió revisarlo, y eso es información. Decirlo evita que el
  // lector busque la diferencia que no existe.
  for (let i = 1; i < versiones.length; i++) {
    versiones[i]!.sinCambio = mismoResultado(versiones[i]!, versiones[i - 1]!);
  }

  return {
    // Vigente arriba: es lo que gobierna hoy.
    versiones: versiones.reverse(),
    total: versiones.length,
    ultimaFirma: ultimaFila ? firmaDe(ultimaFila.actorKind) : null,
  };
}
