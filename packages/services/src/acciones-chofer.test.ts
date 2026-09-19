import { describe, expect, it } from "vitest";
import { corregirChofer, darDeAltaChofer } from "./acciones-chofer.js";

type Chofer = { id: string; carrier: string; nombre: string; licencia: string };

const ACTOR = { kind: "human", id: "u-asav" };

/** Repos falsos: sólo lo que las acciones tocan, con registro de escrituras. */
function repos(choferes: Chofer[], opciones: { choque?: string; conLicencia?: boolean; sinMercado?: boolean } = {}) {
  const escrituras: Array<[string, unknown]> = [];
  const conLicencia = opciones.conLicencia ?? true;
  const r = {
    expedientes: {
      identidadesDeChoferes: async (carrier: string) =>
        choferes.filter((c) => c.carrier === carrier).map(({ id, nombre, licencia }) => ({ id, nombre, licencia })),
      mercadoDeCuenta: async () => (opciones.sinMercado ? null : { id: "chihuahua", timeZone: "America/Ciudad_Juarez" }),
      catalogo: async () =>
        conLicencia
          ? [
              { tipo: { id: "t-licencia", clave: "licencia", name: "Licencia" }, regla: null },
              { tipo: { id: "t-examen", clave: "examen_medico", name: "Examen médico" }, regla: null },
            ]
          : [{ tipo: { id: "t-examen", clave: "examen_medico", name: "Examen médico" }, regla: null }],
      darDeAltaChofer: async (datos: unknown) => {
        if (opciones.choque) throw Object.assign(new Error("duplicate key"), { code: "23505", constraint_name: opciones.choque });
        escrituras.push(["alta", datos]);
        return { id: "nuevo" };
      },
      corregirChofer: async (carrier: string, driverId: string, datos: unknown, papel: unknown) => {
        escrituras.push(["corregir", { carrier, driverId, datos, papel }]);
        return choferes.find((c) => c.id === driverId && c.carrier === carrier) ? { driverId } : null;
      },
    },
  };
  return { repos: r as never, escrituras };
}

const JUAREZ_BUS: Chofer[] = [
  { id: "c-medina", carrier: "jb", nombre: "Ramón Medina", licencia: "CHIH-12345" },
  // Otra cuenta, con un chofer del mismo nombre y la misma licencia.
  { id: "c-otra", carrier: "otra", nombre: "Luis Soto", licencia: "CHIH-99999" },
];

const alta = (r: never, datos: Partial<{ carrierId: string; nombre: string; licencia: string; venceEl: string }>) =>
  darDeAltaChofer(r, { carrierId: "jb", nombre: "", licencia: "", venceEl: "", actor: ACTOR, ...datos });

describe("dar de alta un chofer (ficha §1 y prueba 1)", () => {
  it("con nombre y licencia se crea, y su vencimiento va como papel «Licencia», no en las credenciales", async () => {
    const { repos: r, escrituras } = repos(JUAREZ_BUS);
    const res = await alta(r, { nombre: "  Ana   Ruiz ", licencia: "chih-555 01", venceEl: "2027-03-31" });
    expect(res).toEqual({ ok: true, driverId: "nuevo", nombre: "Ana Ruiz" });
    expect(escrituras).toEqual([
      [
        "alta",
        {
          carrierAccountId: "jb",
          nombre: "Ana Ruiz",
          licencia: "CHIH-555 01",
          papelDeLicencia: { documentTypeId: "t-licencia", venceEl: "2027-03-31" },
          actor: ACTOR,
        },
      ],
    ]);
  });

  it("sin vencimiento también nace su «Licencia»: el número es su folio, y la fecha falta", async () => {
    const { repos: r, escrituras } = repos(JUAREZ_BUS);
    await alta(r, { nombre: "Ana Ruiz", licencia: "CHIH-55501" });
    expect(escrituras[0]![1]).toMatchObject({ papelDeLicencia: { documentTypeId: "t-licencia", venceEl: null } });
  });

  it("sin «Licencia» en el catálogo el chofer nace igual, sin papel, y un vencimiento no se tira en silencio", async () => {
    const sin = repos(JUAREZ_BUS, { conLicencia: false });
    expect(await alta(sin.repos, { nombre: "Ana Ruiz", licencia: "X1" })).toMatchObject({ ok: true });
    expect(sin.escrituras[0]![1]).toMatchObject({ papelDeLicencia: null });
    const conFecha = repos(JUAREZ_BUS, { sinMercado: true });
    expect(await alta(conFecha.repos, { nombre: "Ana Ruiz", licencia: "X1", venceEl: "2027-01-01" })).toMatchObject({
      ok: false,
      error: "sin_papel_de_licencia",
    });
    expect(conFecha.escrituras).toEqual([]);
  });

  it("un nombre repetido en la cuenta se rechaza en palabras y sin escribir", async () => {
    const { repos: r, escrituras } = repos(JUAREZ_BUS);
    const res = await alta(r, { nombre: "ramón  MEDINA", licencia: "OTRA-1" });
    expect(res).toEqual({ ok: false, error: "nombre_repetido", mensaje: "Ya hay un chofer llamado «Ramón Medina» en esta cuenta." });
    expect(escrituras).toEqual([]);
  });

  it("una licencia repetida también, sin importar guiones, espacios ni mayúsculas", async () => {
    const { repos: r } = repos(JUAREZ_BUS);
    const res = await alta(r, { nombre: "Otro Nombre", licencia: "chih 12345" });
    expect(res).toMatchObject({ ok: false, error: "licencia_repetida" });
  });

  it("el mismo nombre y la misma licencia en OTRA cuenta no chocan: son únicos por cuenta", async () => {
    const { repos: r } = repos(JUAREZ_BUS);
    expect((await alta(r, { nombre: "Luis Soto", licencia: "CHIH-99999" })).ok).toBe(true);
  });

  it("sin nombre, sin licencia o con una fecha que no existe: el primer problema en palabras", async () => {
    const { repos: r } = repos(JUAREZ_BUS);
    expect(await alta(r, { licencia: "X1" })).toMatchObject({ error: "nombre_vacio" });
    expect(await alta(r, { nombre: "Ana" })).toMatchObject({ error: "licencia_vacia" });
    expect(await alta(r, { nombre: "Ana", licencia: " - " })).toMatchObject({ error: "licencia_vacia" });
    expect(await alta(r, { nombre: "Ana", licencia: "X1", venceEl: "2027-02-30" })).toMatchObject({ error: "fecha_invalida" });
  });

  it("si dos altas corren a la vez, el candado de la base lo dice en las mismas palabras", async () => {
    const nombre = repos(JUAREZ_BUS, { choque: "driver_credentials_nombre_unico_por_cuenta" });
    expect(await alta(nombre.repos, { nombre: "Ana Ruiz", licencia: "X1" })).toEqual({
      ok: false,
      error: "nombre_repetido",
      mensaje: "Ya hay un chofer llamado «Ana Ruiz» en esta cuenta.",
    });
    const licencia = repos(JUAREZ_BUS, { choque: "driver_credentials_licencia_unica_por_cuenta" });
    expect(await alta(licencia.repos, { nombre: "Ana Ruiz", licencia: "X1" })).toMatchObject({ error: "licencia_repetida" });
  });
});

describe("corregir un chofer", () => {
  it("corregir sin tocar el nombre no choca consigo mismo", async () => {
    const { repos: r, escrituras } = repos(JUAREZ_BUS);
    const res = await corregirChofer(r, { carrierId: "jb", driverId: "c-medina", nombre: "Ramón Medina", licencia: "CHIH-12346", actor: ACTOR });
    expect(res).toEqual({ ok: true, driverId: "c-medina", nombre: "Ramón Medina" });
    // El papel «Licencia» va con la corrección: si cambió el número, su folio también.
    expect(escrituras[0]![1]).toMatchObject({ papel: { documentTypeId: "t-licencia" } });
  });

  it("un chofer de otra cuenta responde igual que uno que no existe", async () => {
    const { repos: r, escrituras } = repos(JUAREZ_BUS);
    const res = await corregirChofer(r, { carrierId: "jb", driverId: "c-otra", nombre: "X", licencia: "Y", actor: ACTOR });
    expect(res).toEqual({ ok: false, error: "chofer_no_encontrado", mensaje: "Ese chofer no es de esta cuenta." });
    expect(escrituras).toEqual([]);
  });
});
