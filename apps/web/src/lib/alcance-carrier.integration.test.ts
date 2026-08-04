import { describe, it, expect, beforeAll } from "vitest";
import { sembrarEscenarioDosCarriers, type EscenarioDosCarriers } from "@jtel/db";

/**
 * El escenario feo: **dos carriers sirviendo la misma planta.**
 *
 * Hasta el 4 de agosto de 2026 la rama desechable tenía un solo transportista,
 * y con uno solo ninguna prueba puede distinguir una guardia que funciona de
 * una que no existe: todo lo que se pide es tuyo. Este archivo construye el
 * segundo y le pide, desde B, lo que es de A.
 *
 * ## Qué se mide, y qué NO
 *
 * Se miden los caminos por los que la cara del transportista acepta el id de
 * un recurso. De cada uno se comprueba una sola cosa: que pedirlo con la
 * identidad equivocada no devuelva la fila. Y de cada uno se comprueba también
 * el **control** —que B sí abra lo suyo—, porque una prueba que solo mira que
 * algo no salga pasa igual de verde cuando no sale nada.
 *
 * **Esto no demuestra un agujero.** Los caminos ya rechazan lo ajeno; lo hacen
 * en el CARGADOR, cada uno por su cuenta, en cinco archivos distintos. No hay
 * una guardia: hay una costumbre repetida cinco veces.
 *
 * Lo que estas pruebas fijan es la propiedad, para que la centralización que
 * viene después pueda mover esas comprobaciones de sitio sin que nadie tenga
 * que confiar en que se movieron bien. **Son la red del refactor, no la
 * denuncia de una fuga.**
 *
 * El riesgo que cubren no es el de hoy: es **la pantalla dieciséis** que
 * alguien escriba mañana y olvide filtrar. Hoy eso no rompe nada, no falla
 * ninguna prueba y filtra en silencio — la forma exacta del `[0]` del #222.
 */

let e: EscenarioDosCarriers;

/**
 * Cómo terminó una petición. Los cargadores tienen dos formas de negarse
 * —devolver `null` o llamar a `notFound()`, que lanza— y las dos cuentan
 * igual: la fila no salió.
 */
type Desenlace =
  | { tipo: "entregó"; valor: unknown }
  | { tipo: "null" }
  | { tipo: "404" }
  | { tipo: "error"; mensaje: string };

async function intentar(fn: () => Promise<unknown>): Promise<Desenlace> {
  try {
    const valor = await fn();
    return valor === null || valor === undefined ? { tipo: "null" } : { tipo: "entregó", valor };
  } catch (err) {
    const e = err as { digest?: string; message?: string };
    const digest = typeof e.digest === "string" ? e.digest : "";
    if (digest.includes("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND") {
      return { tipo: "404" };
    }
    return { tipo: "error", mensaje: e.message ?? String(err) };
  }
}

const negó = (d: Desenlace) => d.tipo === "null" || d.tipo === "404";

beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no llegó al proceso (la config debió ponerla)");

  e = await sembrarEscenarioDosCarriers(url);

  // Que el escenario sea el que se cree que es. Sin esto, una siembra a medias
  // deja todo en verde por la razón equivocada: pedir un recurso inexistente
  // también "no devuelve la fila".
  expect(e.carrierA.id).not.toBe(e.carrierB.id);
  expect(e.deA.unidadId).not.toBe(e.deB.unidadId);
  expect(e.deA.contratoId).not.toBe(e.deB.contratoId);
  expect(e.deA.ocurrenciaId).not.toBe(e.deB.ocurrenciaId);
});

describe("el escenario está armado", () => {
  it("los dos carriers sirven al MISMO cliente — si no, se mide la pared equivocada", async () => {
    const { getRepos } = await import("./db");
    const repos = getRepos();

    const contratoA = await repos.contracts.findById(e.deA.contratoId);
    const contratoB = await repos.contracts.findById(e.deB.contratoId);

    expect(contratoA!.clientAccountId).toBe(contratoB!.clientAccountId);
    expect(contratoA!.plantId).toBe(contratoB!.plantId);
    expect(contratoA!.carrierAccountId).not.toBe(contratoB!.carrierAccountId);
  });
});

describe("B no alcanza lo de A", () => {
  it("1 · expediente de unidad", async () => {
    const { loadExpedienteUnidad } = await import("./expediente-unidad-data");

    const suyo = await intentar(() => loadExpedienteUnidad(e.carrierB, e.deB.unidadId));
    const ajeno = await intentar(() => loadExpedienteUnidad(e.carrierB, e.deA.unidadId));

    expect(suyo.tipo, "B debe poder abrir SU unidad, o la prueba pasa por vacía").toBe("entregó");
    expect(negó(ajeno), `con la unidad de A devolvió: ${JSON.stringify(ajeno)}`).toBe(true);
  });

  it("2 · historial de unidad — la pertenencia se resuelve contra la flota", async () => {
    const { getRepos } = await import("./db");
    const flotaDeB = await getRepos().fleet.getUnitsForCarrier(e.carrierB.id);

    expect(flotaDeB.some((u) => u.id === e.deB.unidadId)).toBe(true);
    expect(flotaDeB.some((u) => u.id === e.deA.unidadId)).toBe(false);
  });

  it("3 · expediente de contrato", async () => {
    const { loadExpedienteContrato } = await import("./expediente-contrato-data");

    const suyo = await intentar(() => loadExpedienteContrato(e.carrierB, e.deB.contratoId));
    const ajeno = await intentar(() => loadExpedienteContrato(e.carrierB, e.deA.contratoId));

    expect(suyo.tipo, "B debe poder abrir SU contrato").toBe("entregó");
    expect(negó(ajeno), `con el contrato de A devolvió: ${JSON.stringify(ajeno)}`).toBe(true);
  });

  it("4 · detalle de servicio", async () => {
    const { loadServiceDetail } = await import("./service-detail-data");

    const suyo = await intentar(() =>
      loadServiceDetail(e.deB.ocurrenciaId, { carrierAccountId: e.carrierB.id }),
    );
    const ajeno = await intentar(() =>
      loadServiceDetail(e.deA.ocurrenciaId, { carrierAccountId: e.carrierB.id }),
    );

    expect(suyo.tipo, "B debe poder abrir SU servicio").toBe("entregó");
    expect(negó(ajeno), `con el servicio de A devolvió: ${JSON.stringify(ajeno)}`).toBe(true);
  });

  it("5 · el lienzo, con la unidad de A pedida por parámetro", async () => {
    const { loadWorkbench } = await import("./workbench-data");

    const d = (await loadWorkbench(e.carrierB, {
      unidad: [e.deB.unidadId, e.deA.unidadId],
      desde: "2026-07-30",
      hasta: "2026-07-31",
    })) as { unidades: Array<{ unitId: string }> };

    const ids = d.unidades.map((u) => u.unitId);
    expect(ids, "la unidad de A no debe entrar al lienzo de B").not.toContain(e.deA.unidadId);
  });

  it("6 · el lienzo, entrando por el servicio de A", async () => {
    const { getRepos } = await import("./db");
    const repos = getRepos();

    const suyo = await repos.occurrences.serviceDateForCarrier(e.deB.ocurrenciaId, e.carrierB.id);
    const ajeno = await repos.occurrences.serviceDateForCarrier(e.deA.ocurrenciaId, e.carrierB.id);

    expect(suyo, "B debe poder entrar por SU servicio").toBeTruthy();
    expect(ajeno, "el servicio de A no debe darle fecha a B").toBeFalsy();
  });
});
