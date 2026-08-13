import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createDb,
  createRepositories,
  sembrarEscenarioDosCarriers,
  type EscenarioDosCarriers,
} from "@jtel/db";

/**
 * El camino de ESCRITURA de la aportación, contra la base de verdad.
 *
 * Existe porque el PR anterior lo declaró como hueco: **que la caja se vea no
 * dice que guarde**, y eso es justo lo que esta sesión lleva separando. Una
 * pantalla que renderiza y un `POST` que persiste son dos afirmaciones, y la
 * segunda no la prueba mirar la primera.
 *
 * Va contra `DATABASE_URL_TEST` —la rama desechable— y **nunca** contra
 * producción: el candado vive en `vitest.integration.config.ts` y compara las
 * dos URLs antes de cargar un solo archivo.
 *
 * ## Lo que vigila, en orden de importancia
 *
 *   1. Que guarde de verdad: la fila existe después, con su firma y su hora.
 *   2. Que **el hecho no se mueva**. Es la ley 1, y aquí se comprueba contra la
 *      base y no contra una promesa: se lee el veredicto antes y después.
 *   3. Que retirar sea un ESTADO — la fila sigue ahí.
 *   4. Que una aportación de un transportista no aparezca en el servicio de
 *      otro.
 */

let e: EscenarioDosCarriers;
let repos: ReturnType<typeof createRepositories>;
const creadas: string[] = [];

beforeAll(async () => {
  const url = process.env.DATABASE_URL_TEST!;
  e = await sembrarEscenarioDosCarriers(url);
  repos = createRepositories(createDb(url));
});

afterAll(async () => {
  /*
   * Limpieza por si otra prueba cuenta filas de esta tabla. NO es una red: si
   * el proceso muere a media corrida esto no corre, y por eso la base es
   * desechable en vez de "se limpia al final" — que es lo que el procedimiento
   * de migraciones ya dice sobre las pruebas que escriben.
   */
  for (const id of creadas) {
    await repos.aportaciones.retirar(id, e.carrierA.id).catch(() => null);
  }
});

describe("la aportación se guarda de verdad", () => {
  it("persiste con su firma y su hora, y se puede leer después", async () => {
    const fila = await repos.aportaciones.crear({
      serviceOccurrenceId: e.deA.ocurrenciaId,
      carrierAccountId: e.carrierA.id,
      motivo: null,
      nota: "El camión salió con la ruta cerrada por obra.",
      declaredUnitId: e.deA.unidadId,
      adjuntos: [{ nombre: "bitácora", url: "https://ejemplo/bitacora.pdf" }],
      actorKind: "human",
      actorId: "prueba_integracion",
    });
    creadas.push(fila.id);

    expect(fila.id).toBeTruthy();
    expect(fila.estado).toBe("enviada");
    expect(fila.actorKind).toBe("human");
    expect(fila.actorId).toBe("prueba_integracion");
    expect(fila.createdAt).toBeInstanceOf(Date);

    // Y se lee desde la base, no del objeto que devolvió el insert.
    const leidas = await repos.aportaciones.listarPorOcurrencia(e.deA.ocurrenciaId);
    const mia = leidas.find((a) => a.id === fila.id);
    expect(mia).toBeDefined();
    expect(mia!.nota).toContain("obra");
    expect(mia!.declaredUnitId).toBe(e.deA.unidadId);
    expect(mia!.adjuntos).toHaveLength(1);
  });

  it("guarda el motivo cuando viene, y lo deja nulo cuando no", async () => {
    const conMotivo = await repos.aportaciones.crear({
      serviceOccurrenceId: e.deA.ocurrenciaId,
      carrierAccountId: e.carrierA.id,
      motivo: "obra_sin_aviso",
      actorKind: "human",
    });
    creadas.push(conMotivo.id);
    expect(conMotivo.motivo).toBe("obra_sin_aviso");

    const sinMotivo = await repos.aportaciones.crear({
      serviceOccurrenceId: e.deA.ocurrenciaId,
      carrierAccountId: e.carrierA.id,
      nota: "Sin motivo del catálogo",
      actorKind: "human",
    });
    creadas.push(sinMotivo.id);
    expect(sinMotivo.motivo).toBeNull();
  });
});

describe("la ley 1, comprobada contra la base", () => {
  it("aportar NO mueve el veredicto del servicio", async () => {
    const antes = await repos.occurrences.findById(e.deA.ocurrenciaId);
    const hechoAntes = antes?.complianceFact;

    const fila = await repos.aportaciones.crear({
      serviceOccurrenceId: e.deA.ocurrenciaId,
      carrierAccountId: e.carrierA.id,
      nota: "Esto no puede mover nada.",
      actorKind: "human",
    });
    creadas.push(fila.id);

    const despues = await repos.occurrences.findById(e.deA.ocurrenciaId);
    const hechoDespues = despues?.complianceFact;

    /*
     * Se comparan los campos que un veredicto es, no el objeto entero: si
     * alguien agrega una columna informativa al hecho, esta prueba no tiene por
     * qué ponerse roja — pero si cambia el resultado, la unidad acreditada o la
     * llegada, sí.
     */
    expect(hechoDespues?.status).toBe(hechoAntes?.status);
    expect(hechoDespues?.observedUnitId ?? null).toBe(hechoAntes?.observedUnitId ?? null);
    expect(hechoDespues?.observedArrivalAt?.toISOString() ?? null).toBe(
      hechoAntes?.observedArrivalAt?.toISOString() ?? null,
    );
    expect(hechoDespues?.timing ?? null).toBe(hechoAntes?.timing ?? null);
  });
});

describe("retirar es un estado, no un borrado", () => {
  it("la fila sigue existiendo después de retirarla", async () => {
    const fila = await repos.aportaciones.crear({
      serviceOccurrenceId: e.deA.ocurrenciaId,
      carrierAccountId: e.carrierA.id,
      nota: "Me equivoqué de servicio.",
      actorKind: "human",
    });
    creadas.push(fila.id);

    const retirada = await repos.aportaciones.retirar(fila.id, e.carrierA.id);
    expect(retirada?.estado).toBe("retirada");

    // Lo que importa: SIGUE AHÍ. Lo que se dijo se dijo.
    const leidas = await repos.aportaciones.listarPorOcurrencia(e.deA.ocurrenciaId);
    const sigue = leidas.find((a) => a.id === fila.id);
    expect(sigue).toBeDefined();
    expect(sigue!.nota).toContain("equivoqué");
  });

  it("un transportista no puede retirar la aportación de otro", async () => {
    const fila = await repos.aportaciones.crear({
      serviceOccurrenceId: e.deA.ocurrenciaId,
      carrierAccountId: e.carrierA.id,
      nota: "De A.",
      actorKind: "human",
    });
    creadas.push(fila.id);

    const intento = await repos.aportaciones.retirar(fila.id, e.carrierB.id);
    expect(intento).toBeNull();

    const leidas = await repos.aportaciones.listarPorOcurrencia(e.deA.ocurrenciaId);
    expect(leidas.find((a) => a.id === fila.id)!.estado).toBe("enviada");
  });
});

describe("las aportaciones no se cruzan entre servicios", () => {
  it("la de un servicio no aparece en otro", async () => {
    const fila = await repos.aportaciones.crear({
      serviceOccurrenceId: e.deA.ocurrenciaId,
      carrierAccountId: e.carrierA.id,
      nota: "Solo de este servicio.",
      actorKind: "human",
    });
    creadas.push(fila.id);

    const otras = await repos.aportaciones.listarPorOcurrencia(e.deB.ocurrenciaId);
    expect(otras.find((a) => a.id === fila.id)).toBeUndefined();
  });
});
