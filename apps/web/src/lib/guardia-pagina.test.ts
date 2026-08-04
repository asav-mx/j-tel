import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * La guardia de páginas.
 *
 * Lo que se mide aquí y no en `guardia-api.test.ts`: que **en producción no
 * baste con tener identidad**. Mientras el bypass viva, `getIdentidad()`
 * siempre devuelve a alguien —en producción, `jstaff_admin` con sus
 * membresías—, así que una guardia que preguntara «¿hay identidad?» dejaría
 * pasar a un anónimo y se vería idéntica a una que funciona.
 */

const getIdentidad = vi.fn();
const findBySlug = vi.fn();

vi.mock("@/lib/auth", () => ({ getIdentidad: () => getIdentidad() }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({ accounts: { findBySlug: (s: string) => findBySlug(s) } }),
}));

const { decidirPagina } = await import("./guardia-pagina");

const CUENTA_JSTAFF = "cuenta-jstaff";

/** Lo que el bypass produce hoy en producción: identidad completa, sin sesión. */
function porElBypass(memberships: unknown[] = []) {
  return {
    userId: "jstaff_admin",
    origen: "variable-dev",
    memberships,
    clerkConfigurado: true,
    sesionActiva: false,
    encabezadoRechazado: false,
  };
}

/** Una sesión real de Clerk. */
function porClerk(memberships: unknown[] = []) {
  return {
    userId: "user_3HQuURm3OmMaJXub9RMpRMYHVkN",
    origen: "clerk",
    memberships,
    clerkConfigurado: true,
    sesionActiva: true,
    encabezadoRechazado: false,
  };
}

const MEMBRESIA_JSTAFF = [
  { accountId: CUENTA_JSTAFF, clerkUserId: "x", role: "admin_plataforma", scopeType: "global" },
];

beforeEach(() => {
  getIdentidad.mockReset();
  findBySlug.mockReset();
});

describe("en producción exige sesión de Clerk, no identidad", () => {
  it("niega al anónimo aunque el bypass le dé membresías de J-Staff", async () => {
    getIdentidad.mockResolvedValue(porElBypass(MEMBRESIA_JSTAFF));

    const v = await decidirPagina({ tipo: "jstaff" }, { enProduccion: true });

    expect(v.ok).toBe(false);
    expect(v).toMatchObject({ motivo: "sin-sesion" });
  });

  it("deja pasar la misma petición con sesión real", async () => {
    getIdentidad.mockResolvedValue(porClerk(MEMBRESIA_JSTAFF));

    const v = await decidirPagina({ tipo: "jstaff" }, { enProduccion: true });

    expect(v.ok).toBe(true);
  });

  it("fuera de producción acepta el bypass — o no se puede trabajar en local", async () => {
    getIdentidad.mockResolvedValue(porElBypass(MEMBRESIA_JSTAFF));

    const v = await decidirPagina({ tipo: "jstaff" }, { enProduccion: false });

    expect(v.ok).toBe(true);
  });

  it("la falta de sesión se comprueba ANTES que el alcance", async () => {
    // Sin membresías y sin sesión: el motivo tiene que ser la sesión, no el
    // alcance. Si saliera "sin-alcance", el orden estaría invertido y en un
    // despliegue sin llaves el diagnóstico apuntaría al lugar equivocado.
    getIdentidad.mockResolvedValue(porElBypass([]));

    const v = await decidirPagina({ tipo: "jstaff" }, { enProduccion: true });

    expect(v).toMatchObject({ motivo: "sin-sesion" });
  });
});

describe("el alcance se sigue midiendo con la regla de la API", () => {
  it("con sesión real pero sin membresía de J-Staff, no pasa", async () => {
    getIdentidad.mockResolvedValue(porClerk([]));

    const v = await decidirPagina({ tipo: "jstaff" }, { enProduccion: true });

    expect(v).toMatchObject({ ok: false, motivo: "sin-alcance" });
  });

  it("un usuario de carrier no abre una pantalla de cliente", async () => {
    getIdentidad.mockResolvedValue(
      porClerk([
        { accountId: "cuenta-carrier", clerkUserId: "x", role: "admin", scopeType: "account" },
      ]),
    );
    findBySlug.mockResolvedValue({ id: "cuenta-cliente", type: "client" });

    const v = await decidirPagina({ tipo: "cliente", slug: "tecma" }, { enProduccion: true });

    expect(v).toMatchObject({ ok: false, motivo: "sin-alcance" });
  });
});

describe("falla cerrado", () => {
  it("si la identidad no se puede resolver, no pasa", async () => {
    getIdentidad.mockRejectedValue(new Error("base caída"));

    const v = await decidirPagina({ tipo: "jstaff" }, { enProduccion: true });

    expect(v).toMatchObject({ ok: false, motivo: "identidad-irresoluble" });
  });

  it("si la membresía no se puede comprobar, no pasa", async () => {
    getIdentidad.mockResolvedValue(porClerk(MEMBRESIA_JSTAFF));
    findBySlug.mockRejectedValue(new Error("base caída"));

    const v = await decidirPagina({ tipo: "cliente", slug: "tecma" }, { enProduccion: true });

    expect(v).toMatchObject({ ok: false, motivo: "membresia-irresoluble" });
  });

  it("también falla cerrado fuera de producción", async () => {
    getIdentidad.mockRejectedValue(new Error("base caída"));

    const v = await decidirPagina({ tipo: "jstaff" }, { enProduccion: false });

    expect(v).toMatchObject({ ok: false, motivo: "identidad-irresoluble" });
  });
});

describe("el motivo que viaja en la URL", () => {
  it("no lleva la identidad ni el nombre de la cuenta", async () => {
    getIdentidad.mockResolvedValue(porClerk([]));

    const v = await decidirPagina({ tipo: "cliente", slug: "tecma" }, { enProduccion: true });
    findBySlug.mockResolvedValue({ id: "cuenta-cliente", type: "client" });

    expect(v.ok).toBe(false);
    const motivo = (v as { motivo: string }).motivo;
    // El destino lo ve cualquiera: un motivo detallado ahí filtraría justo lo
    // que la guardia protege.
    expect(motivo).not.toContain("tecma");
    expect(motivo).not.toContain("user_");
    expect(motivo).toMatch(/^[a-z-]+$/);
  });
});
