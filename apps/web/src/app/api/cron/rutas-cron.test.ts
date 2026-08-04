import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Las siete rutas de cron, medidas donde de verdad importa: **en la ruta**, no
 * en la guardia.
 *
 * `guardia-cron.test.ts` mide que la guardia decide bien. Esto mide otra cosa
 * —que las siete la llaman, y que la llaman antes de hacer nada—, que es
 * justamente lo que falló la primera vez: la lógica estaba bien escrita en un
 * lado y copiada mal en siete.
 *
 * Una prueba que solo ejercitara la guardia pasaría en verde con una ruta que
 * se olvidó de llamarla.
 */

const procesarPendientes = vi.fn();
const archivarTodo = vi.fn();
const correrBackfill = vi.fn();
const revisarLatido = vi.fn();
const renovarVentana = vi.fn();

vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    occurrences: { renewRollingWindow: (n: number) => renovarVentana(n) },
  }),
  isDatabaseConfigured: () => true,
}));

vi.mock("@/lib/umbrella-config", () => ({ getUmbrellaConfig: () => ({}) }));

vi.mock("@jtel/services", () => ({
  VerificationService: class {
    processPending = procesarPendientes;
  },
  ArchiverService: class {
    archiveAll = archivarTodo;
  },
  GapBackfillService: class {
    run = correrBackfill;
  },
  IngestHealthService: class {
    checkHeartbeat = revisarLatido;
  },
}));

/* La plomería de alertas: solo tiene que resolver el import. */
vi.mock("@/lib/alertas/datos", () => ({
  aplicarIncidentes: vi.fn(),
  detectarAvisos: vi.fn(),
  armarResumen: vi.fn(),
}));
vi.mock("@/lib/alertas/correo", () => ({
  renderAvisos: vi.fn(),
  renderResumen: vi.fn(),
}));
vi.mock("@/lib/alertas/canal", () => ({
  ErrorDeCanal: class extends Error {},
  resolverCanal: () => ({ ok: true, canal: { enviar: vi.fn() } }),
}));
vi.mock("@/lib/alertas/decision", () => ({
  INTERVALO_ALERTAS_MINUTOS: 5,
  cubetaDeCorrida: () => "cubeta",
}));

const RUTAS = [
  { nombre: "cron/verify", modulo: () => import("./verify/route") },
  { nombre: "cron/archive", modulo: () => import("./archive/route") },
  { nombre: "cron/gap-backfill", modulo: () => import("./gap-backfill/route") },
  { nombre: "cron/ingest-heartbeat", modulo: () => import("./ingest-heartbeat/route") },
  { nombre: "cron/renew-occurrences", modulo: () => import("./renew-occurrences/route") },
  { nombre: "cron/alertas", modulo: () => import("./alertas/route") },
  { nombre: "cron/alertas-resumen", modulo: () => import("./alertas-resumen/route") },
] as const;

/** El respaldo que se quitó — escrito en piezas para no volver a publicarlo. */
const RESPALDO_RETIRADO = "dev" + "-cron-" + "secret";

function peticion(autorizacion?: string): Request {
  return new Request("https://j-telemetry.com/api/cron/x", {
    headers: autorizacion ? { authorization: autorizacion } : {},
  });
}

/** Todo lo que una ruta podría hacer si la guardia la dejara pasar. */
const TRABAJO = [
  procesarPendientes,
  archivarTodo,
  correrBackfill,
  revisarLatido,
  renovarVentana,
];

beforeEach(() => {
  delete process.env.CRON_SECRET;
  TRABAJO.forEach((f) => f.mockReset());
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
});

describe("sin CRON_SECRET, las siete responden 503", () => {
  for (const ruta of RUTAS) {
    it(`${ruta.nombre} → 503`, async () => {
      const { GET } = await ruta.modulo();

      const r = await GET(peticion(`Bearer ${RESPALDO_RETIRADO}`));

      expect(r.status).toBe(503);
      expect((await r.json()).error).toContain("CRON_SECRET");
    });
  }

  it("ninguna de las siete llegó a trabajar", async () => {
    for (const ruta of RUTAS) {
      const { GET } = await ruta.modulo();
      await GET(peticion(`Bearer ${RESPALDO_RETIRADO}`));
    }

    for (const f of TRABAJO) expect(f).not.toHaveBeenCalled();
  });

  it("POST tampoco pasa — las siete lo delegan a GET", async () => {
    for (const ruta of RUTAS) {
      const { POST } = await ruta.modulo();
      const r = await POST(peticion(`Bearer ${RESPALDO_RETIRADO}`));
      expect(r.status, ruta.nombre).toBe(503);
    }
  });
});

describe("con CRON_SECRET, las siete siguen exigiendo el secreto correcto", () => {
  const SECRETO = "secreto-de-prueba-no-usado-en-ninguna-parte";

  beforeEach(() => {
    process.env.CRON_SECRET = SECRETO;
  });

  for (const ruta of RUTAS) {
    it(`${ruta.nombre} → 401 con el respaldo retirado`, async () => {
      const { GET } = await ruta.modulo();

      const r = await GET(peticion(`Bearer ${RESPALDO_RETIRADO}`));

      expect(r.status).toBe(401);
    });
  }

  it("ninguna trabajó tampoco al ser negada con 401", async () => {
    for (const ruta of RUTAS) {
      const { GET } = await ruta.modulo();
      await GET(peticion("Bearer equivocado"));
    }

    for (const f of TRABAJO) expect(f).not.toHaveBeenCalled();
  });

  /*
   * El contrapeso: si todo lo de arriba pasara porque las rutas niegan SIEMPRE,
   * estas pruebas serían decorativas. Esta comprueba que con el secreto bueno
   * la ruta sí corre.
   */
  it("con el secreto correcto la ruta trabaja", async () => {
    renovarVentana.mockResolvedValue({ creadas: 0 });
    const { GET } = await import("./renew-occurrences/route");

    const r = await GET(peticion(`Bearer ${SECRETO}`));

    expect(r.status).toBe(200);
    expect(renovarVentana).toHaveBeenCalledWith(30);
  });
});
