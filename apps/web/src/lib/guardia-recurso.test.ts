import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * La guardia de las pantallas que cuelgan de un recurso.
 *
 * Lo que se mide aquí, y no en las otras pruebas de guardia:
 *
 * 1. **Que la cuenta salga de la fila y no de la URL.** El id es lo único que
 *    aporta la petición, y un id no dice de quién es.
 * 2. **Que «no existe» y «no es tuyo» sean indistinguibles.** Si se vieran
 *    distinto, un extraño enumeraría ids y aprendería qué servicios existen sin
 *    ver ninguno.
 * 3. **Que no se lea el recurso antes de tener sesión.** Es el orden invertido:
 *    sin sesión no se toca la base.
 */

const getIdentidad = vi.fn();

vi.mock("@/lib/auth", () => ({ getIdentidad: () => getIdentidad() }));
vi.mock("@/lib/db", () => ({ getRepos: () => ({}) }));

const { decidirRecurso } = await import("./guardia-pagina");

const CUENTA_TECMA = "acc-tecma";
const CUENTA_OTRA = "acc-honeywell";

function conSesion(memberships: unknown[]) {
  return {
    userId: "user_x",
    origen: "clerk",
    memberships,
    clerkConfigurado: true,
    sesionActiva: true,
    encabezadoRechazado: false,
  };
}

const deTecma = [
  { accountId: CUENTA_TECMA, clerkUserId: "u", role: "admin_corporativo", scopeType: "account" },
];
const global = [
  { accountId: "acc-jstaff", clerkUserId: "u", role: "admin_plataforma", scopeType: "global" },
];

beforeEach(() => {
  getIdentidad.mockReset();
  // Un default sano: cada prueba sobrescribe lo que le toca. Sin esto, una
  // implementación que lanza sobrevive a la prueba que la puso.
  getIdentidad.mockResolvedValue(conSesion(deTecma));
});

describe("la cuenta sale de la fila", () => {
  it("deja pasar cuando el dueño del recurso es tu cuenta", async () => {
    getIdentidad.mockResolvedValue(conSesion(deTecma));

    const v = await decidirRecurso(async () => CUENTA_TECMA, { enProduccion: true });

    expect(v).toMatchObject({ ok: true, cuenta: CUENTA_TECMA });
  });

  it("el alcance global alcanza el recurso de cualquier cuenta", async () => {
    getIdentidad.mockResolvedValue(conSesion(global));

    const v = await decidirRecurso(async () => CUENTA_OTRA, { enProduccion: true });

    expect(v.ok).toBe(true);
  });
});

describe("«no existe» y «no es tuyo» son el mismo caso", () => {
  it("un recurso que no existe → inexistente-o-ajeno", async () => {
    getIdentidad.mockResolvedValue(conSesion(deTecma));

    const v = await decidirRecurso(async () => null, { enProduccion: true });

    expect(v).toMatchObject({ ok: false, motivo: "inexistente-o-ajeno" });
  });

  it("un recurso de otra cuenta → EL MISMO motivo, palabra por palabra", async () => {
    getIdentidad.mockResolvedValue(conSesion(deTecma));

    const inexistente = await decidirRecurso(async () => null, { enProduccion: true });
    const ajeno = await decidirRecurso(async () => CUENTA_OTRA, { enProduccion: true });

    // Si estos dos dejaran de ser idénticos, la forma de la negativa
    // empezaría a decir cuáles ids existen.
    expect(ajeno).toEqual(inexistente);
  });

  it("si la consulta de procedencia revienta, también falla cerrado y con la misma cara", async () => {
    getIdentidad.mockResolvedValue(conSesion(deTecma));

    const v = await decidirRecurso(async () => {
      throw new Error("la procedencia reventó");
    }, { enProduccion: true });

    expect(v).toMatchObject({ ok: false, motivo: "inexistente-o-ajeno" });
  });
});

describe("el orden: no se toca el recurso antes de tener sesión", () => {
  it("sin sesión no se consulta la procedencia ni una vez", async () => {
    getIdentidad.mockResolvedValue({ ...conSesion(deTecma), sesionActiva: false });
    const consultar = vi.fn(async () => CUENTA_TECMA);

    const v = await decidirRecurso(consultar, { enProduccion: true });

    expect(v).toMatchObject({ ok: false, motivo: "sin-sesion" });
    expect(consultar).not.toHaveBeenCalled();
  });

  it("si la identidad no se resuelve, tampoco se consulta", async () => {
    getIdentidad.mockImplementation(async () => {
      throw new Error("base caída");
    });
    const consultar = vi.fn(async () => CUENTA_TECMA);

    const v = await decidirRecurso(consultar, { enProduccion: true });

    expect(v).toMatchObject({ ok: false, motivo: "identidad-irresoluble" });
    expect(consultar).not.toHaveBeenCalled();
  });

  it("la falta de sesión gana sobre un recurso inexistente", async () => {
    // Si el orden estuviera invertido, la negativa por id inexistente llegaría
    // antes que la de sesión y diría —a un anónimo— que ese id no existe.
    getIdentidad.mockResolvedValue({ ...conSesion(deTecma), sesionActiva: false });

    const v = await decidirRecurso(async () => null, { enProduccion: true });

    expect(v).toMatchObject({ motivo: "sin-sesion" });
  });
});
