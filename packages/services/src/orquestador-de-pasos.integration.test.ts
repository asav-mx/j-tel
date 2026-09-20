import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray, sql } from "drizzle-orm";
import {
  createDb,
  createRepositories,
  accounts,
  telemetryPoints,
  circuitUnitAssignments,
} from "@jtel/db";
import { OrquestadorDePasosService, VERSION_DEL_DETECTOR } from "./orquestador-de-pasos.js";

/*
 * El orquestador contra base de verdad y DATOS SEMBRADOS: la transacción, el
 * marcador, el muro de cuenta y el candado — lo que con repositorios de mentira
 * no se puede medir (esos están en `orquestador-de-pasos.test.ts`).
 *
 * ESCRIBEN, así que van contra `DATABASE_URL_TEST` — una rama desechable de
 * Neon — y nunca contra producción. Mismo candado que el resto de la casa.
 *
 * ⚠ Requiere las migraciones 0025–0047 aplicadas en la rama de prueba (la 0047
 * es la del marcador: `docs/correcciones/2026-09-20-aplicar-0047-…sql`).
 *
 * **Hermética a propósito.** `correr()` procesa a TODAS las unidades elegibles
 * de la base, y la rama de prueba trae escenarios de otras pruebas. Aquí el
 * repositorio se envuelve para que la ronda sólo vea las unidades sembradas
 * por esta prueba; todo lo demás queda como estaba.
 *
 * Los pasos se leen sólo por `listarPasosDeParada` (la guardia del muro de
 * cuenta no deja que nadie más consulte esa tabla).
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[orquestador-de-pasos] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[orquestador-de-pasos] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);
const marca = `op${Date.now().toString(36)}`;

/** Ida recta de 803 m sobre la latitud 31.72. */
const TRAZADO_IDA: Array<[number, number]> = [
  [-106.46, 31.72],
  [-106.4515, 31.72],
];
const METROS_POR_GRADO_LON = 111_412.84 * Math.cos((31.72 * Math.PI) / 180);
const sobreElTrazado = (metros: number) => ({ lat: 31.72, lon: -106.46 + metros / METROS_POR_GRADO_LON });

const AHORA = new Date();
const T0 = new Date(AHORA.getTime() - 2 * 3_600_000);
const en = (minutos: number) => new Date(T0.getTime() + minutos * 60_000);

let concesionId = "";
let cuentaA = ""; // dueña de las unidades
let cuentaB = ""; // otra cuenta: el muro
let circuitoHistoria = "";
const paradas: Record<"A" | "B" | "C", string> = { A: "", B: "", C: "" };
const unidad: Record<"U" | "W" | "X" | "Y" | "Z", string> = { U: "", W: "", X: "", Y: "", Z: "" };
let circuitoAtomicidad = "";
let paradaAtomicidad = "";

async function sembrarPunto(cuenta: string, unitId: string, cuando: Date, metros: number, imei: string) {
  const { lat, lon } = sobreElTrazado(metros);
  await db.insert(telemetryPoints).values({
    carrierAccountId: cuenta,
    unitId,
    imei: `${imei}-${marca}`,
    latitude: lat,
    longitude: lon,
    recordedAt: cuando,
    source: "traccar",
  });
}

async function circuitoConTrazado(nombre: string) {
  const c = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `${nombre} ${marca}`,
    publicSlug: `${nombre.toLowerCase().replace(/\s+/g, "-")}-${marca}`,
    corridorToleranceMeters: 150,
    serviceStartLocal: "05:00",
    serviceEndLocal: "23:00",
    timeZone: "America/Ciudad_Juarez",
  });
  await repos.circuits.upsertPath({
    circuitId: c!.id,
    sentido: "ida",
    coordinates: TRAZADO_IDA,
    pointCount: 2,
    lengthMeters: 803,
  });
  return c!.id;
}

async function parada(circuitId: string, nombre: string, metros: number, sentido: "ida" | null) {
  const { lat, lon } = sobreElTrazado(metros);
  const p = await repos.circuits.createStop({
    circuitId,
    qrSlug: `${nombre}-${marca}`.toLowerCase(),
    name: nombre,
    orden: Math.round(metros),
    latitude: lat,
    longitude: lon,
    sentido,
  });
  return p.identidad.id;
}

async function asignar(circuitId: string, unitId: string, cuentaDeLaAsignacion = cuentaA) {
  await db.insert(circuitUnitAssignments).values({
    circuitId,
    unitId,
    carrierAccountId: cuentaDeLaAsignacion,
    validFrom: new Date(AHORA.getTime() - 3 * 24 * 3_600_000),
  });
}

beforeAll(async () => {
  concesionId = (
    await repos.circuits.createConcession({
      name: `Concesión ${marca}`,
      slug: `concesion-${marca}`,
      legalName: `Concesión ${marca} SA de CV`,
    })
  ).cuenta.id;
  cuentaA = (await repos.accounts.create({ type: "carrier", name: `Transportista A ${marca}`, slug: `ta-${marca}` })).id;
  cuentaB = (await repos.accounts.create({ type: "carrier", name: `Transportista B ${marca}`, slug: `tb-${marca}` })).id;
  for (const k of Object.keys(unidad) as Array<keyof typeof unidad>) {
    unidad[k] = (await repos.fleet.createUnit(cuentaA, `${k}-${marca}`)).id;
  }

  // La historia: tres paradas en fila sobre una ida, una unidad (U) que las va cruzando.
  circuitoHistoria = await circuitoConTrazado("Historia");
  paradas.A = await parada(circuitoHistoria, "A", 400, "ida");
  paradas.B = await parada(circuitoHistoria, "B", 600, "ida");
  paradas.C = await parada(circuitoHistoria, "C", 750, "ida");
  await asignar(circuitoHistoria, unidad.U);

  // Atomicidad y falla aislada: una parada, y una unidad (W) con un cruce.
  circuitoAtomicidad = await circuitoConTrazado("Atomicidad");
  paradaAtomicidad = await parada(circuitoAtomicidad, "P", 400, "ida");
  await asignar(circuitoAtomicidad, unidad.W);
  await sembrarPunto(cuentaA, unidad.W, en(0), 300, "w");
  await sembrarPunto(cuentaA, unidad.W, en(1), 500, "w");

  // Lo que se salta, cada una con su motivo:
  const sinParadas = await circuitoConTrazado("Sin paradas");
  await asignar(sinParadas, unidad.X);
  const sinVuelta = await circuitoConTrazado("Sin vuelta");
  await parada(sinVuelta, "S", 400, null); // sentido null: sirve a los dos, y sólo hay trazado de ida
  await asignar(sinVuelta, unidad.Z);
  const ajena = await circuitoConTrazado("Cuenta ajena");
  await parada(ajena, "J", 400, "ida");
  await asignar(ajena, unidad.Y, cuentaB); // la asignación dice B; la unidad es de A

  // Las lecturas de U (cuenta A) y, con el MISMO unit_id, un ping de la cuenta B: el muro.
  await sembrarPunto(cuentaA, unidad.U, en(0), 300, "u");
  await sembrarPunto(cuentaA, unidad.U, en(1), 500, "u");
  await sembrarPunto(cuentaB, unidad.U, new Date(en(0).getTime() + 30_000), 750, "u-ajeno");
});

afterAll(async () => {
  // Las cuentas arrastran por cascada circuitos, asignaciones, paradas, trazados, pasos, marcas y puntos.
  await db.delete(accounts).where(inArray(accounts.id, [concesionId, cuentaA, cuentaB].filter(Boolean)));
});

/**
 * Sólo las unidades de esta prueba. W —la de la atomicidad— queda fuera de la
 * historia, salvo en la ronda 1, donde entra para FALLAR a propósito.
 */
function servicioHermetico(reloj: Date, opts: { conWQueFalla?: boolean } = {}) {
  const mias = new Set(Object.values(unidad).filter((u) => opts.conWQueFalla || u !== unidad.W));
  const real = repos.pasosPorParada;
  const envuelto = {
    pasosPorParada: {
      unidadesParaDetectar: async (version: string) => {
        const r = await real.unidadesParaDetectar(version);
        return {
          elegibles: r.elegibles.filter((e) => mias.has(e.unitId)),
          saltadas: r.saltadas.filter((s) => mias.has(s.unitId)),
        };
      },
      detectarUnidadEnRonda: (input: Parameters<typeof real.detectarUnidadEnRonda>[0]) => {
        if (opts.conWQueFalla && input.unitId === unidad.W) {
          return Promise.reject(new Error("falla puesta a propósito"));
        }
        return real.detectarUnidadEnRonda(input);
      },
    },
  } as unknown as ConstructorParameters<typeof OrquestadorDePasosService>[0];
  return new OrquestadorDePasosService(envuelto, () => reloj);
}

const pasosDe = async (stopId: string) =>
  (await repos.pasosPorParada.listarPasosDeParada(concesionId, stopId)).filter(
    (p) => p.detectorVersion === VERSION_DEL_DETECTOR,
  );

async function marcaDe(unitId: string) {
  const { elegibles } = await repos.pasosPorParada.unidadesParaDetectar(VERSION_DEL_DETECTOR);
  return elegibles.find((e) => e.unitId === unitId)?.marcaLastPingAt ?? null;
}

describe("orquestador · la historia de una unidad, ronda por ronda", () => {
  it("1 · una unidad que falla no detiene a las demás; la buena detecta y ninguna cruza el muro", async () => {
    const err = console.error;
    console.error = () => {};
    let ronda;
    try {
      ronda = await servicioHermetico(AHORA, { conWQueFalla: true }).correr();
    } finally {
      console.error = err;
    }

    expect(ronda.fallidas.map((f) => f.unitId)).toEqual([unidad.W]);
    const deU = ronda.detalle.find((d) => d.unitId === unidad.U);
    expect(deU?.estado).toBe("detectada");

    // Sólo el cruce de A, entre los dos pings de la cuenta A. Si el ping ajeno (mismo unit_id,
    // cuenta B, a 750 m) se hubiera colado, A saldría con OTRO rango y B y C con pasos.
    const deA = await pasosDe(paradas.A);
    expect(deA).toHaveLength(1);
    expect(deA[0]!.pasoDesde.getTime()).toBe(en(0).getTime());
    expect(deA[0]!.pasoHasta.getTime()).toBe(en(1).getTime());
    expect(await pasosDe(paradas.B)).toHaveLength(0);
    expect(await pasosDe(paradas.C)).toHaveLength(0);

    expect((await marcaDe(unidad.U))?.getTime()).toBe(en(1).getTime());
    // La que falló no movió nada.
    expect(await marcaDe(unidad.W)).toBeNull();
    expect(await pasosDe(paradaAtomicidad)).toHaveLength(0);
  });

  it("2 · sin pings nuevos no hay nada que hacer, y nada se duplica", async () => {
    const ronda = await servicioHermetico(AHORA).correr();
    expect(ronda.detalle.find((d) => d.unitId === unidad.U)).toBeUndefined();
    expect(await pasosDe(paradas.A)).toHaveLength(1);
  });

  it("3 · el cruce que cae ENTRE dos rondas se detecta una vez: ni perdido ni repetido", async () => {
    // El ping anterior (500 m, ya consumido) y éste (700 m) encierran la parada B (600 m).
    await sembrarPunto(cuentaA, unidad.U, en(3), 700, "u");
    await servicioHermetico(AHORA).correr();

    const deB = await pasosDe(paradas.B);
    expect(deB).toHaveLength(1);
    expect(deB[0]!.pasoDesde.getTime()).toBe(en(1).getTime());
    expect(deB[0]!.pasoHasta.getTime()).toBe(en(3).getTime());
    expect(await pasosDe(paradas.A)).toHaveLength(1); // el de la ronda 1 no se repitió
    expect((await marcaDe(unidad.U))?.getTime()).toBe(en(3).getTime());
  });

  it("4 · un ping dentro del colchón todavía no cuenta, y el marcador no se mueve", async () => {
    // 790 m pasa la parada C (750 m) respecto al ping de 700 m — pero llegó hace 5 minutos.
    await sembrarPunto(cuentaA, unidad.U, new Date(AHORA.getTime() - 5 * 60_000), 790, "u");
    await servicioHermetico(AHORA).correr();

    expect(await pasosDe(paradas.C)).toHaveLength(0);
    expect((await marcaDe(unidad.U))?.getTime()).toBe(en(3).getTime());
  });

  it("5 · simular dice lo que escribiría y no deja nada", async () => {
    const despues = new Date(AHORA.getTime() + 20 * 60_000); // ya pasó el colchón
    const ronda = await servicioHermetico(despues).correr({ simular: true });

    const deU = ronda.detalle.find((d) => d.unitId === unidad.U)!;
    expect(ronda.simulado).toBe(true);
    expect(deU.pasosGuardados).toBe(1);
    expect(deU.muestra).toHaveLength(1);
    expect(deU.muestra![0]!.stopId).toBe(paradas.C);
    expect(new Date(deU.marcaNueva!).getTime()).toBe(AHORA.getTime() - 5 * 60_000);

    // ...y nada quedó: ni el paso, ni el marcador.
    expect(await pasosDe(paradas.C)).toHaveLength(0);
    expect((await marcaDe(unidad.U))?.getTime()).toBe(en(3).getTime());
  });

  it("6 · dos rondas a la vez no duplican: la segunda se va sin esperar o ya no encuentra nada", async () => {
    const despues = new Date(AHORA.getTime() + 20 * 60_000);
    const [r1, r2] = await Promise.all([
      servicioHermetico(despues).correr(),
      servicioHermetico(despues).correr(),
    ]);

    const escritos = [r1, r2].flatMap((r) => r.detalle).filter((d) => d.unitId === unidad.U);
    expect(escritos.reduce((n, d) => n + d.pasosGuardados, 0)).toBe(1);
    expect(await pasosDe(paradas.C)).toHaveLength(1);
    expect((await marcaDe(unidad.U))?.getTime()).toBe(AHORA.getTime() - 5 * 60_000);
  });

  it("7 · y una ronda más, sin novedad, tampoco repite", async () => {
    await servicioHermetico(new Date(AHORA.getTime() + 20 * 60_000)).correr();
    expect(await pasosDe(paradas.A)).toHaveLength(1);
    expect(await pasosDe(paradas.B)).toHaveLength(1);
    expect(await pasosDe(paradas.C)).toHaveLength(1);
  });
});

describe("orquestador · quién entra y quién se salta", () => {
  it("lo que no está capturado o no cuadra se salta, con su motivo, y no toca nada", async () => {
    const ronda = await servicioHermetico(AHORA).correr();
    const motivoDe = (u: string) => ronda.saltadas.find((s) => s.unitId === u)?.motivo;

    expect(motivoDe(unidad.X)).toMatch(/no tiene paradas capturadas/);
    expect(motivoDe(unidad.Z)).toMatch(/no tiene trazado de vuelta/);
    expect(motivoDe(unidad.Y)).toMatch(/la cuenta de la asignación no es la dueña de la unidad/);
    for (const u of [unidad.X, unidad.Y, unidad.Z]) expect(await marcaDe(u)).toBeNull();
  });
});

describe("orquestador · la transacción es de todo o nada", () => {
  it("si falla el segundo sentido, los pasos del primero se revierten y el marcador no se mueve", async () => {
    // El circuito sólo tiene trazado de ida: pedir ida Y vuelta hace fallar la vuelta DESPUÉS de
    // que la ida ya insertó su cruce. Sin transacción, ese paso quedaría escrito y la ronda
    // siguiente lo duplicaría.
    await expect(
      repos.pasosPorParada.detectarUnidadEnRonda({
        circuitId: circuitoAtomicidad,
        unitId: unidad.W,
        carrierAccountId: cuentaA,
        asignadaDesde: new Date(AHORA.getTime() - 3 * 24 * 3_600_000),
        corridorToleranceMeters: 150,
        sentidos: ["ida", "vuelta"],
        detectorVersion: VERSION_DEL_DETECTOR,
        arranque: new Date(AHORA.getTime() - 24 * 3_600_000),
        hastaMaximo: new Date(AHORA.getTime() - 15 * 60_000),
        simular: false,
      }),
    ).rejects.toThrow(/no tiene trazado de vuelta/);

    expect(await pasosDe(paradaAtomicidad)).toHaveLength(0);
    expect(await marcaDe(unidad.W)).toBeNull();
  });

  it("y la misma ronda, con los sentidos bien, sí escribe (el revés no era un falso verde)", async () => {
    const r = await repos.pasosPorParada.detectarUnidadEnRonda({
      circuitId: circuitoAtomicidad,
      unitId: unidad.W,
      carrierAccountId: cuentaA,
      asignadaDesde: new Date(AHORA.getTime() - 3 * 24 * 3_600_000),
      corridorToleranceMeters: 150,
      sentidos: ["ida"],
      detectorVersion: VERSION_DEL_DETECTOR,
      arranque: new Date(AHORA.getTime() - 24 * 3_600_000),
      hastaMaximo: new Date(AHORA.getTime() - 15 * 60_000),
      simular: false,
    });
    expect(r.estado).toBe("detectada");
    expect(await pasosDe(paradaAtomicidad)).toHaveLength(1);
    expect((await marcaDe(unidad.W))?.getTime()).toBe(en(1).getTime());
  });
});

describe("orquestador · el candado", () => {
  it("con la llave de la unidad tomada por otra conexión, la ronda se va sin esperar; al soltarla, sigue", async () => {
    // La prueba 6 pasa igual si la segunda ronda llega tarde y no encuentra nada, así que no demuestra
    // el candado. Ésta sí: otra transacción sostiene EXACTAMENTE la llave que usa el repositorio
    // (`pasos:<circuito>:<unidad>:<versión>`), y la ronda debe contestar «ocupada» sin escribir ni esperar.
    const llave = `pasos:${circuitoAtomicidad}:${unidad.W}:${VERSION_DEL_DETECTOR}`;
    const ronda = () =>
      repos.pasosPorParada.detectarUnidadEnRonda({
        circuitId: circuitoAtomicidad,
        unitId: unidad.W,
        carrierAccountId: cuentaA,
        asignadaDesde: new Date(AHORA.getTime() - 3 * 24 * 3_600_000),
        corridorToleranceMeters: 150,
        sentidos: ["ida"],
        detectorVersion: VERSION_DEL_DETECTOR,
        arranque: new Date(AHORA.getTime() - 24 * 3_600_000),
        hastaMaximo: new Date(AHORA.getTime() - 15 * 60_000),
        simular: false,
      });

    let durante: Awaited<ReturnType<typeof ronda>> | undefined;
    let milisegundos = Infinity;
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${llave}, 0))`);
      const inicio = Date.now();
      durante = await ronda();
      milisegundos = Date.now() - inicio;
    });

    expect(durante?.estado).toBe("ocupada");
    expect(durante?.pasosGuardados).toBe(0);
    expect(milisegundos).toBeLessThan(5_000); // `try`, no `wait`: no hizo cola detrás del candado

    // Soltada la llave, la misma ronda ya puede correr: W ya consumió sus dos pings.
    expect((await ronda()).estado).toBe("sin_novedad");
  });
});

