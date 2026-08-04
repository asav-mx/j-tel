import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exigirCron } from "./guardia-cron";

/**
 * La guardia de cron — lo que se mide aquí es que **no exista un camino a 200
 * sin la variable**.
 *
 * El defecto que cierra esto no era que la comparación estuviera mal: era que
 * cuando faltaba `CRON_SECRET` había un secreto de repuesto escrito en el
 * código y publicado en el README. Así que la prueba que importa no es "niega
 * un secreto incorrecto" —eso ya funcionaba— sino "sin variable no sirve a
 * nadie, ni siquiera al que trae el secreto que solía funcionar".
 */

const SECRETO = "secreto-de-prueba-no-usado-en-ninguna-parte";

/** El respaldo que se quitó. Sigue nombrado aquí para probar que ya no abre. */
const RESPALDO_RETIRADO = "dev" + "-cron-" + "secret";

function peticion(autorizacion?: string): Request {
  return new Request("https://j-telemetry.com/api/cron/verify", {
    headers: autorizacion ? { authorization: autorizacion } : {},
  });
}

let errores: unknown[][];

beforeEach(() => {
  delete process.env.CRON_SECRET;
  errores = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    errores.push(a);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
});

describe("sin CRON_SECRET en el entorno", () => {
  it("responde 503, no 401 — el roto es el servidor, no quien llama", async () => {
    const r = exigirCron(peticion(`Bearer ${SECRETO}`), "cron/verify");

    expect(r).not.toBeNull();
    expect(r!.status).toBe(503);
    expect((await r!.json()).error).toContain("CRON_SECRET");
  });

  it("deja registro del fallo, y como error", () => {
    exigirCron(peticion(), "cron/verify");

    expect(errores).toHaveLength(1);
    expect(String(errores[0]!.join(" "))).toContain("CRON_SECRET");
    expect(String(errores[0]!.join(" "))).toContain("cron/verify");
  });

  /*
   * El corazón del arreglo. Antes esta llamada devolvía `null` —pasaba— porque
   * el `??` entregaba el respaldo y el encabezado coincidía con él.
   */
  it("NIEGA el respaldo retirado — el secreto publicado ya no abre nada", () => {
    const r = exigirCron(peticion(`Bearer ${RESPALDO_RETIRADO}`), "cron/verify");

    expect(r).not.toBeNull();
    expect(r!.status).toBe(503);
  });

  it("una variable vacía o en blanco es una variable que falta", () => {
    for (const vacia of ["", "   "]) {
      process.env.CRON_SECRET = vacia;
      const r = exigirCron(peticion(`Bearer ${vacia}`), "cron/verify");
      expect(r).not.toBeNull();
      expect(r!.status).toBe(503);
    }
  });

  it("el 503 gana al 401 — el orden de las dos comprobaciones importa", () => {
    // Sin encabezado Y sin variable. Si la guardia mirara primero el
    // encabezado, contestaría 401 y la mala configuración quedaría escondida
    // detrás de una respuesta que parece normal.
    const r = exigirCron(peticion(), "cron/verify");

    expect(r!.status).toBe(503);
  });
});

describe("con CRON_SECRET configurada", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRETO;
  });

  it("deja pasar el secreto correcto", () => {
    expect(exigirCron(peticion(`Bearer ${SECRETO}`), "cron/verify")).toBeNull();
  });

  it("niega con 401 el secreto equivocado", () => {
    const r = exigirCron(peticion("Bearer otra-cosa"), "cron/verify");

    expect(r).not.toBeNull();
    expect(r!.status).toBe(401);
  });

  it("niega el respaldo retirado", () => {
    const r = exigirCron(peticion(`Bearer ${RESPALDO_RETIRADO}`), "cron/verify");

    expect(r!.status).toBe(401);
  });

  it("niega la falta de encabezado", () => {
    expect(exigirCron(peticion(), "cron/verify")!.status).toBe(401);
  });

  it("niega el secreto correcto sin el prefijo Bearer", () => {
    expect(exigirCron(peticion(SECRETO), "cron/verify")!.status).toBe(401);
  });

  /*
   * Largos distintos no pueden lanzar. `timingSafeEqual` exige búferes del
   * mismo tamaño; comparar los digests es lo que lo evita, y si alguien
   * revirtiera eso a una comparación directa, esto revienta en vez de pasar.
   */
  it("no lanza cuando el encabezado tiene otro largo", () => {
    expect(() => exigirCron(peticion("Bearer x"), "cron/verify")).not.toThrow();
    expect(() =>
      exigirCron(peticion(`Bearer ${SECRETO}${SECRETO}${SECRETO}`), "cron/verify"),
    ).not.toThrow();
  });
});
