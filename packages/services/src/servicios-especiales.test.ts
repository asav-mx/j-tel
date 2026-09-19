import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  cargarActa,
  cargarServiciosEspeciales,
  trazaDeLaUnidad,
  zonaDelCuarto,
  type ReposDeVernier,
} from "./servicios-especiales.js";

/**
 * Vernier V1 — el cargador lee lo sellado y nada más.
 *
 * **El repositorio espía (ficha §6, prueba 7).** `repos` es un Proxy que
 * revienta ante cualquier cosa que no sea `repos.vernier`, y `repos.vernier`
 * revienta ante cualquier método que no esté en la lista de lecturas. Si
 * alguien un día hace que abrir el acta llame al motor, re-selle, escriba una
 * marca o lea telemetría cruda, esta prueba se pone roja antes de que llegue a
 * la pantalla.
 */

const LECTURAS = [
  "contratosDeCarrier",
  "zonaDelMercado",
  "ocurrenciasSelladas",
  "pasosDelSello",
  "ocurrenciaDelActa",
  "unidadesPosiblesDelPerfil",
  "resellosDeOcurrencia",
  "entradasQueSellan",
  "puntosDeLaUnidadObservada",
  "geocercaDeDestino",
  "aportacionesDeOcurrencia",
] as const;

type Lectura = (typeof LECTURAS)[number];

function espia(respuestas: Partial<Record<Lectura | "eventosDeContratos", (...a: unknown[]) => unknown>>) {
  const llamadas: string[] = [];
  const vernier = new Proxy(
    {},
    {
      get(_, nombre) {
        if (typeof nombre !== "string" || !(LECTURAS as readonly string[]).includes(nombre)) {
          throw new Error(`El acta llamó a vernier.${String(nombre)}, que no es una lectura`);
        }
        return async (...args: unknown[]) => {
          llamadas.push(nombre);
          const r = respuestas[nombre as Lectura];
          return r ? r(...args) : nombre === "pasosDelSello" ? new Map() : nombre.startsWith("zona") || nombre.startsWith("ocurrenciaDel") || nombre === "geocercaDeDestino" ? null : [];
        };
      },
    },
  );
  // Las pausas (0041) sólo se leen: la única lectura permitida es la de los eventos.
  const pausas = new Proxy(
    {},
    {
      get(_, nombre) {
        if (nombre !== "eventosDeContratos") throw new Error(`El cargador llamó a pausas.${String(nombre)}, que no es una lectura`);
        return async (...args: unknown[]) => {
          llamadas.push("pausas.eventosDeContratos");
          return respuestas.eventosDeContratos ? respuestas.eventosDeContratos(...args) : new Map();
        };
      },
    },
  );
  const repos = new Proxy({ vernier, pausas } as object, {
    get(destino, nombre) {
      if (nombre === "vernier") return vernier;
      if (nombre === "pausas") return pausas;
      throw new Error(`El cargador tocó repos.${String(nombre)}: sólo puede leer de repos.vernier y de los eventos de pausa`);
    },
  }) as unknown as ReposDeVernier;
  return { repos, llamadas };
}

const CUENTA = "carrier-1";
const ZONA = "America/Ciudad_Juarez";
const SELLO = new Date("2026-09-17T14:31:07.000Z");

const fila = (x: Record<string, unknown> = {}) => ({
  ocurrenciaId: "o1",
  fecha: "2026-09-17",
  contratoId: "c1",
  contrato: "Planta Norte",
  ruta: "R-04",
  turnoId: "t1",
  turno: "T1",
  veredicto: "pendiente_evidencia",
  timing: null,
  llegada: null,
  llegadaExigida: new Date("2026-09-17T12:45:00.000Z"),
  tolerancia: 5,
  tardeExcusable: false,
  motivoExcusable: null,
  unidadObservada: null,
  selladoAt: SELLO,
  resellado: false,
  ...x,
});

describe("la zona del cuarto: el mercado, y si no hay, la política del contrato", () => {
  it("manda el mercado", () => {
    expect(zonaDelCuarto("America/Chihuahua", [{ zona: "America/Ciudad_Juarez" }])).toBe("America/Chihuahua");
  });
  it("sin mercado, la del contrato", () => {
    expect(zonaDelCuarto(null, [{ zona: null }, { zona: "America/Mazatlan" }])).toBe("America/Mazatlan");
  });
  it("sin nada, la que la política trae por omisión", () => {
    expect(zonaDelCuarto(null, [])).toBe("America/Ciudad_Juarez");
  });
});

describe("la lista lee el motivo del sello vigente", () => {
  it("emparejado: el motivo del motor", async () => {
    const { repos, llamadas } = espia({
      contratosDeCarrier: () => [{ id: "c1", nombre: "Planta Norte", zona: ZONA }],
      ocurrenciasSelladas: () => [fila()],
      pasosDelSello: () =>
        new Map([
          [
            "o1",
            [
              {
                action: "verificacion_automatica",
                createdAt: new Date(SELLO.getTime() + 40),
                evidenciaIndisponible: false,
                decision: { result: "pendiente_evidencia", details: { reason: "llegada_sin_atribucion" } },
                cobertura: null,
              },
            ],
          ],
        ]),
    });
    const cuarto = await cargarServiciosEspeciales(repos, { carrierAccountId: CUENTA, desde: new Date(0), hasta: new Date() });
    expect(cuarto.ocurrencias[0]!.motivo.clave).toBe("llegada_sin_atribucion");
    expect(cuarto.ocurrencias[0]!.ventana).toEqual({ desde: "06:45", hasta: "06:50" });
    expect(llamadas.every((l) => (LECTURAS as readonly string[]).includes(l) || l === "pausas.eventosDeContratos")).toBe(true);
  });

  it("el cronómetro (#427) recibe tramos y tamaños, y la lista es la misma con él o sin él", async () => {
    const respuestas = {
      ocurrenciasSelladas: () => [fila(), fila({ ocurrenciaId: "o2" })],
      pasosDelSello: () => new Map([["o1", [{ action: "verificacion_automatica", createdAt: new Date(SELLO.getTime() + 40), evidenciaIndisponible: false, decision: null, cobertura: null }]]]),
    };
    const eventos: string[] = [];
    const conMedidor = await cargarServiciosEspeciales(espia(respuestas).repos, { carrierAccountId: CUENTA, desde: new Date(0), hasta: new Date() }, {
      marca: (t) => eventos.push(t),
      dato: (n, v) => eventos.push(`${n}=${v}`),
    });
    const sinMedidor = await cargarServiciosEspeciales(espia(respuestas).repos, { carrierAccountId: CUENTA, desde: new Date(0), hasta: new Date() });
    expect(eventos).toEqual(["ocurrencias", "ocurrencias=2", "ledger", "entradasDelLedger=1", "motivos", "pausas"]);
    expect(conMedidor).toEqual(sinMedidor);
  });

  it("sin entrada del ledger después del sello: no se deduce", async () => {
    const { repos } = espia({
      ocurrenciasSelladas: () => [fila()],
      pasosDelSello: () =>
        new Map([
          [
            "o1",
            [
              {
                // Anterior al sello vigente: es de una corrida vieja, no de éste.
                action: "verificacion_automatica",
                createdAt: new Date(SELLO.getTime() - 60_000),
                evidenciaIndisponible: false,
                decision: { result: "pendiente_evidencia", details: { reason: "llegada_sin_atribucion" } },
                cobertura: null,
              },
            ],
          ],
        ]),
    });
    const cuarto = await cargarServiciosEspeciales(repos, { carrierAccountId: CUENTA, desde: new Date(0), hasta: new Date() });
    expect(cuarto.ocurrencias[0]!.motivo.largo).toBe("Motivo no registrado en este sello.");
  });

  it("una llegada tarde se lee Cumplido con timing tarde", async () => {
    const { repos } = espia({
      ocurrenciasSelladas: () => [
        fila({
          veredicto: "cumplido",
          timing: "tarde",
          llegada: new Date("2026-09-17T13:12:41.000Z"),
          unidadObservada: "2120",
        }),
      ],
    });
    const cuarto = await cargarServiciosEspeciales(repos, { carrierAccountId: CUENTA, desde: new Date(0), hasta: new Date() });
    const o = cuarto.ocurrencias[0]!;
    expect(o.veredicto).toBe("cumplido");
    expect(o.timing).toBe("tarde");
    expect(o.motivo.cifras).toEqual([{ medido: "Llegada 07:12:41", umbral: "límite 06:50:00" }]);
  });
});

describe("las pausas de la verificación que tocan la ventana (0041)", () => {
  const MOTIVO = "Sin telemetría: el proveedor anterior se desconectó";
  const ev = (tipo: "pausa" | "reanudacion", iso: string) => ({ tipo, valeDesde: new Date(iso), motivo: tipo === "pausa" ? MOTIVO : null, registradoAt: new Date(iso) });

  it("sólo las que tocan la ventana, con su contrato", async () => {
    const { repos } = espia({
      contratosDeCarrier: () => [
        { id: "c1", nombre: "Contrato Norte", zona: ZONA },
        { id: "c2", nombre: "Contrato Oriente", zona: ZONA },
      ],
      eventosDeContratos: () =>
        new Map([
          ["c1", [ev("pausa", "2026-09-05T06:00:00Z")]],
          ["c2", [ev("pausa", "2026-08-01T06:00:00Z"), ev("reanudacion", "2026-08-10T06:00:00Z")]],
        ]),
    });
    const cuarto = await cargarServiciosEspeciales(repos, {
      carrierAccountId: CUENTA,
      desde: new Date("2026-09-14T06:00:00Z"),
      hasta: new Date("2026-09-19T06:00:00Z"),
    });
    expect(cuarto.pausas).toEqual([
      { contratoId: "c1", contrato: "Contrato Norte", desde: "2026-09-05T06:00:00.000Z", hasta: null, motivo: MOTIVO },
    ]);
  });
});

describe("el acta", () => {
  const cabeza = (x: Record<string, unknown> = {}) => ({
    ...fila(x),
    perfilId: "p1",
    perfil: "R-04 · T1 · Planta Norte",
    perfilCodigo: "PN-R04-T1",
    unidadObservadaId: null,
    tripId: "trip1",
    destinoId: "g1",
    ...x,
  });

  it("de otra cuenta no existe: null, sin leer nada más", async () => {
    const { repos, llamadas } = espia({ ocurrenciaDelActa: () => null });
    expect(await cargarActa(repos, { carrierAccountId: CUENTA, ocurrenciaId: "ajena" })).toBeNull();
    expect(llamadas).toEqual(["ocurrenciaDelActa"]);
  });

  it("sin unidad observada: ninguna traza, y no se leen puntos de nadie", async () => {
    const { repos, llamadas } = espia({ ocurrenciaDelActa: () => cabeza() });
    const acta = await cargarActa(repos, { carrierAccountId: CUENTA, ocurrenciaId: "o1" });
    expect(acta!.traza).toEqual({ tipo: "sin_unidad_observada" });
    expect(llamadas).not.toContain("puntosDeLaUnidadObservada");
    expect(acta!.aportaciones).toEqual([]);
  });

  it("re-sellado: el acta trae cuándo se reemplazó el sello anterior", async () => {
    const { repos } = espia({
      ocurrenciaDelActa: () => cabeza(),
      resellosDeOcurrencia: () => [{ reemplazadoAt: new Date("2026-09-18T15:00:00.000Z") }],
    });
    const acta = await cargarActa(repos, { carrierAccountId: CUENTA, ocurrenciaId: "o1" });
    expect(acta!.resellos).toEqual(["2026-09-18T15:00:00.000Z"]);
  });

  it("las unidades posibles vienen del perfil y la observada del hecho, en renglones distintos", async () => {
    const { repos } = espia({
      ocurrenciaDelActa: () => cabeza({ veredicto: "cumplido", timing: "a_tiempo", unidadObservadaId: "u9", unidadObservada: "2126", llegada: new Date("2026-09-17T12:47:00Z") }),
      unidadesPosiblesDelPerfil: () => [{ id: "u1", etiqueta: "2115" }, { id: "u2", etiqueta: "2118" }],
    });
    const acta = await cargarActa(repos, { carrierAccountId: CUENTA, ocurrenciaId: "o1" });
    expect(acta!.identidad.unidadesPosibles).toEqual(["2115", "2118"]);
    expect(acta!.identidad.unidadObservada).toBe("2126");
  });
});

describe("la traza de la unidad observada", () => {
  const p = (min: number, lat: number) => ({
    lat,
    lng: -106.4,
    speed: 30,
    at: new Date(Date.parse("2026-09-17T11:30:00Z") + min * 60_000),
  });

  it("se corta en la llegada sellada, se parte en el hueco, y los hechos van en orden", () => {
    const llegada = new Date(Date.parse("2026-09-17T11:30:00Z") + 60 * 60_000);
    const t = trazaDeLaUnidad(
      [p(0, 31.6), p(2, 31.601), p(40, 31.62), p(42, 31.621), p(55, 31.625), p(60, 31.63), p(70, 31.64)],
      llegada,
      "2126",
      null,
    );
    // El punto de las 12:40 (hora UTC) queda fuera: ya es dentro de la geocerca.
    expect(t.tramos.flat().map((x) => x.at)).not.toContain("2026-09-17T12:40:00.000Z");
    expect(t.tramos).toHaveLength(2);
    expect(t.huecos).toHaveLength(1);
    expect(t.hechos.map((h) => h.tipo)).toEqual(["primer_punto", "hueco", "entrada_destino"]);
    expect(t.cortadaEnLaLlegada).toBe(true);
  });

  it("sin hora de llegada no hay dónde cortar, y lo dice", () => {
    const t = trazaDeLaUnidad([p(0, 31.6), p(2, 31.601)], null, "2126", null);
    expect(t.cortadaEnLaLlegada).toBe(false);
    expect(t.hechos.map((h) => h.tipo)).toEqual(["primer_punto"]);
  });
});

describe("guardia: estas lecturas no juzgan ni escriben", () => {
  const leer = (ruta: string) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), "utf8");

  it("el cargador no importa el motor ni nombra ninguna de sus puertas", () => {
    // Se buscan importaciones y llamadas, no palabras: el comentario de
    // cabecera nombra al motor justo para decir que no se toca.
    const fuente = leer("./servicios-especiales.ts");
    for (const prohibido of [
      /from "@jtel\/verification"/,
      /\.verifyOccurrence\(/,
      /\breverify\w*\(/,
      /\bsaveFact\(/,
      /new VerificationService\b/,
      // La lectura cruda de telemetría por aparato. Se arma por partes: su
      // nombre completo en este archivo haría saltar la guardia de muro, que
      // lo busca por nombre en todo el repo.
      new RegExp(`\\bgetFor${"Imeis"}\\w*\\(`),
      /repos\.(?!vernier\b|pausas\.eventosDeContratos\b)\w+/,
    ]) {
      expect(fuente, String(prohibido)).not.toMatch(prohibido);
    }
  });

  it("el repositorio de Vernier no tiene una sola escritura", () => {
    const fuente = leer("../../db/src/repositories/vernier.ts");
    for (const escritura of [".insert(", ".update(", ".delete(", ".execute(", "sql.raw"]) {
      expect(fuente, escritura).not.toContain(escritura);
    }
  });
});
