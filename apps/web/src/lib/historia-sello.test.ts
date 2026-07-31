import { describe, it, expect } from "vitest";
import {
  construirHistoriaSello,
  type FilaHistoria,
  type HechoVigente,
} from "./historia-sello";

/**
 * La historia del sello — que las versiones queden en su orden y que cada una
 * lleve la firma de quien de verdad la causó.
 *
 * El error que estas pruebas existen para atrapar: `archiveAndDeleteFact`
 * guarda la foto del hecho VIEJO junto con el actor de la verificación NUEVA.
 * Firmar cada foto con el actor de su propia fila es el corrimiento fácil de
 * escribir y el más difícil de ver — y pondría el nombre de quien pidió un
 * re-juicio sobre la versión que ese re-juicio reemplazó.
 */

const POLITICA = { toleranceMinutes: 5, kmlMatchMinPct: 60 };

function hecho(over: Partial<HechoVigente> = {}): HechoVigente {
  return {
    materializedAt: new Date("2026-07-24T15:14:22Z"),
    status: "cumplido",
    timing: "a_tiempo",
    observedArrivalAt: new Date("2026-07-24T12:44:00Z"),
    expectedDeadline: new Date("2026-07-24T12:45:00Z"),
    observedRouteMatchPct: 94.2,
    excusableReason: null,
    contractPolicySnapshot: POLITICA,
    ...over,
  };
}

/** Una fila archivada: la foto del hecho viejo + quién causó el reemplazo. */
function fila(over: {
  status: string;
  timing?: string | null;
  actorKind: string;
  replacedAt: string;
  selladoEn: string;
  matchPct?: number | null;
}): FilaHistoria {
  return {
    status: over.status,
    timing: over.timing ?? null,
    actorKind: over.actorKind,
    replacedAt: new Date(over.replacedAt),
    factSnapshot: {
      materializedAt: over.selladoEn,
      status: over.status,
      timing: over.timing ?? null,
      observedArrivalAt: "2026-07-24T12:56:41Z",
      expectedDeadline: "2026-07-24T12:45:00Z",
      observedRouteMatchPct: over.matchPct ?? 71.3,
      excusableReason: null,
      contractPolicySnapshot: POLITICA,
    },
  };
}

describe("sin historia, el silencio es el mensaje", () => {
  it("un hecho verificado una sola vez es una versión, vigente, firmada por el árbitro", () => {
    const h = construirHistoriaSello(hecho(), []);

    expect(h.total).toBe(1);
    expect(h.versiones[0]!.vigente).toBe(true);
    expect(h.versiones[0]!.firma.intencion).toBe("primera");
    // Sin fila que lo firme, nadie lo pidió: la marca no puede ponerse azul.
    expect(h.ultimaFirma).toBeNull();
  });

  it("una ocurrencia sin hecho sellado no dibuja historia", () => {
    expect(construirHistoriaSello(null, [])).toEqual({
      versiones: [],
      total: 0,
      ultimaFirma: null,
    });
  });
});

describe("la firma corre una fila: cada versión la firma quien la causó", () => {
  it("la más antigua es del árbitro; la vigente lleva el actor de la última fila", () => {
    const h = construirHistoriaSello(hecho(), [
      fila({
        status: "cumplido",
        timing: "tarde",
        actorKind: "human",
        replacedAt: "2026-07-24T15:14:22Z",
        selladoEn: "2026-07-24T12:50:00Z",
      }),
    ]);

    expect(h.total).toBe(2);
    // versiones[0] es la vigente — la más nueva arriba.
    expect(h.versiones[0]!.vigente).toBe(true);
    expect(h.versiones[0]!.firma.texto).toBe("A petición de J-Staff");
    expect(h.versiones[0]!.firma.intencion).toBe("decision");

    // La versión que ese re-juicio reemplazó NO lleva su nombre.
    expect(h.versiones[1]!.vigente).toBe(false);
    expect(h.versiones[1]!.firma.intencion).toBe("primera");
  });

  it("con tres reemplazos, cada versión intermedia hereda la fila anterior", () => {
    const h = construirHistoriaSello(hecho(), [
      fila({
        status: "pendiente_evidencia",
        actorKind: "system:exclusivity-pass",
        replacedAt: "2026-07-24T10:00:00Z",
        selladoEn: "2026-07-24T06:00:00Z",
      }),
      fila({
        status: "no_cumplido",
        actorKind: "human",
        replacedAt: "2026-07-24T15:14:22Z",
        selladoEn: "2026-07-24T10:00:00Z",
      }),
    ]);

    expect(h.total).toBe(3);
    // De la más nueva a la más vieja.
    expect(h.versiones.map((v) => v.firma.intencion)).toEqual([
      "decision", // vigente: la causó el humano de la última fila
      "consolidacion", // intermedia: la causó el pase de exclusividad
      "primera", // la original: no la pidió nadie
    ]);
  });

  it("ordena por replaced_at aunque las filas lleguen revueltas", () => {
    const vieja = fila({
      status: "pendiente_evidencia",
      actorKind: "system:elimination-pass",
      replacedAt: "2026-07-24T10:00:00Z",
      selladoEn: "2026-07-24T06:00:00Z",
    });
    const nueva = fila({
      status: "no_cumplido",
      actorKind: "human",
      replacedAt: "2026-07-24T15:14:22Z",
      selladoEn: "2026-07-24T10:00:00Z",
    });

    const revuelto = construirHistoriaSello(hecho(), [nueva, vieja]);
    const enOrden = construirHistoriaSello(hecho(), [vieja, nueva]);

    expect(revuelto).toEqual(enOrden);
  });
});

describe("decidió contra mantuvo — el eje no es humano contra máquina", () => {
  it("un script corrido a mano es proceso con intención de decisión", () => {
    const h = construirHistoriaSello(hecho(), [
      fila({
        status: "no_cumplido",
        actorKind: "system:cli",
        replacedAt: "2026-07-24T15:14:22Z",
        selladoEn: "2026-07-24T12:50:00Z",
      }),
    ]);

    // Deducir del prefijo `system:` lo pintaría gris. Es una decisión.
    expect(h.ultimaFirma!.intencion).toBe("decision");
    expect(h.ultimaFirma!.texto).toBe("Re-verificación manual · CLI");
  });

  it("la firma tiene dos voces: chip en el cajón, frase en la marca", () => {
    const h = construirHistoriaSello(hecho(), [
      fila({
        status: "pendiente_evidencia",
        actorKind: "system:exclusivity-pass",
        replacedAt: "2026-07-24T15:14:22Z",
        selladoEn: "2026-07-24T12:50:00Z",
      }),
    ]);

    expect(h.ultimaFirma!.texto).toBe("Consolidación · exclusividad de unidad");
    // En la marca se cuelga de una línea, en minúscula y como frase.
    expect(h.ultimaFirma!.marca).toBe("consolidado por exclusividad de unidad");
  });

  it("los pases automáticos son consolidación, sin alarma", () => {
    for (const kind of ["system:exclusivity-pass", "system:elimination-pass", "system:cron"]) {
      const h = construirHistoriaSello(hecho(), [
        fila({
          status: "no_cumplido",
          actorKind: kind,
          replacedAt: "2026-07-24T15:14:22Z",
          selladoEn: "2026-07-24T12:50:00Z",
        }),
      ]);
      expect(h.ultimaFirma!.intencion).toBe("consolidacion");
    }
  });

  it("un actor desconocido cae en consolidación — nunca finge una decisión", () => {
    const h = construirHistoriaSello(hecho(), [
      fila({
        status: "no_cumplido",
        actorKind: "system:algo-que-todavia-no-existe",
        replacedAt: "2026-07-24T15:14:22Z",
        selladoEn: "2026-07-24T12:50:00Z",
      }),
    ]);

    expect(h.ultimaFirma!.intencion).toBe("consolidacion");
  });
});

describe("el resultado que no cambió se dice, para que nadie busque la diferencia", () => {
  it("una decisión que deja el mismo resultado marca sinCambio en la vigente", () => {
    const h = construirHistoriaSello(hecho({ status: "cumplido", timing: "a_tiempo" }), [
      fila({
        status: "cumplido",
        timing: "a_tiempo",
        actorKind: "human",
        replacedAt: "2026-07-24T15:14:22Z",
        selladoEn: "2026-07-24T12:50:00Z",
      }),
    ]);

    expect(h.versiones[0]!.sinCambio).toBe(true);
    // La primera versión no tiene contra qué compararse.
    expect(h.versiones[1]!.sinCambio).toBe(false);
  });

  it("un timing distinto con el mismo estado sí es un cambio", () => {
    const h = construirHistoriaSello(hecho({ status: "cumplido", timing: "a_tiempo" }), [
      fila({
        status: "cumplido",
        timing: "tarde",
        actorKind: "human",
        replacedAt: "2026-07-24T15:14:22Z",
        selladoEn: "2026-07-24T12:50:00Z",
      }),
    ]);

    expect(h.versiones[0]!.sinCambio).toBe(false);
  });
});

describe("la lectura sale de la foto de esa versión, no del contrato de hoy", () => {
  it("el límite usa la tolerancia congelada en el snapshot", () => {
    const h = construirHistoriaSello(hecho(), [
      fila({
        status: "cumplido",
        timing: "tarde",
        actorKind: "human",
        replacedAt: "2026-07-24T15:14:22Z",
        selladoEn: "2026-07-24T12:50:00Z",
      }),
    ]);

    const anterior = h.versiones[1]!;
    const llegada = anterior.lectura.find((l) => l.tipo === "llegada")!;
    expect(llegada).toMatchObject({
      tipo: "llegada",
      // deadline 12:45 + 5 min de tolerancia de la foto.
      limiteIso: "2026-07-24T12:50:00.000Z",
      toleranciaMinutos: 5,
    });

    const cobertura = anterior.lectura.find((l) => l.tipo === "cobertura")!;
    expect(cobertura).toMatchObject({ tipo: "cobertura", medidoPct: 71.3, umbralPct: 60 });
  });

  it("lo que la foto no trae no se inventa: se omite la línea", () => {
    const h = construirHistoriaSello(
      hecho({ observedArrivalAt: null, observedRouteMatchPct: null }),
      [],
    );

    expect(h.versiones[0]!.lectura).toEqual([]);
  });

  it("una foto vacía o corrupta no tumba la lectura", () => {
    const h = construirHistoriaSello(hecho(), [
      {
        status: "no_cumplido",
        timing: null,
        actorKind: "human",
        replacedAt: new Date("2026-07-24T15:14:22Z"),
        factSnapshot: null,
      },
    ]);

    expect(h.total).toBe(2);
    // Las columnas reales sostienen la versión aunque la foto no sirva.
    expect(h.versiones[1]!.estado).toBe("no_cumplido");
    expect(h.versiones[1]!.selladoEnIso).toBeNull();
    expect(h.versiones[1]!.lectura).toEqual([]);
  });
});
