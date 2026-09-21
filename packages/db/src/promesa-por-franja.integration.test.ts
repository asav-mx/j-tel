import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDb, createRepositories, accounts, circuitPromiseTables, circuitPromiseBands } from "../src/index.js";
import type { FranjaCapturada } from "@jtel/domain";

/*
 * La promesa por franja horaria (Marco 9.1c, 0044), contra base de verdad.
 *
 * ESCRIBEN, así que van contra `DATABASE_URL_TEST` — una rama desechable de
 * Neon — y nunca contra producción. Mismo candado que el resto de la casa.
 *
 * Lo que no se puede ejercer con dobles: el índice único parcial
 * `circuit_promise_tables_una_vigente` y los dos CHECK de
 * `circuit_promise_bands` viven en la base. Una prueba en memoria los daría
 * por buenos sin haberlos tocado.
 *
 * ⚠ Requiere la migración 0044 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[promesa-por-franja] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[promesa-por-franja] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const marca = `f${Date.now().toString(36)}`;

let concesionId = "";
let circuitoId = ""; // horario 05:00–23:00, como Oasis–Centro
let circuitoNocturnoId = ""; // horario 22:00–06:00, para el caso que cruza medianoche

beforeAll(async () => {
  const { cuenta } = await repos.circuits.createConcession({
    name: `Concesión ${marca}`,
    slug: `concesion-${marca}`,
    legalName: `Concesión ${marca} SA de CV`,
  });
  concesionId = cuenta.id;

  const circuito = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Circuito ${marca}`,
    publicSlug: `circuito-${marca}`,
    serviceStartLocal: "05:00",
    serviceEndLocal: "23:00",
  });
  circuitoId = circuito!.id;

  const nocturno = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Nocturno ${marca}`,
    publicSlug: `nocturno-${marca}`,
    serviceStartLocal: "22:00",
    serviceEndLocal: "06:00",
  });
  circuitoNocturnoId = nocturno!.id;
});

afterAll(async () => {
  await db.delete(accounts).where(inArray(accounts.id, [concesionId].filter(Boolean)));
});

const FRANJAS_OASIS: FranjaCapturada[] = [
  { diaTipo: "entre_semana", sentido: null, desdeLocal: "06:00", hastaLocal: "09:00", frequencyMinutes: 10 },
  { diaTipo: "entre_semana", sentido: null, desdeLocal: "09:00", hastaLocal: "23:00", frequencyMinutes: 20 },
];

describe("savePromiseTable · guardar", () => {
  it("guarda el ejemplo del Marco: cada 10 de 6 a 9, cada 20 el resto del día", async () => {
    const r = await repos.circuits.savePromiseTable(circuitoId, FRANJAS_OASIS, { motivo: "captura inicial" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const promesa = await repos.circuits.getPromiseTableVigente(circuitoId);
    expect(promesa).not.toBeNull();
    expect(promesa!.bandas).toHaveLength(2);
    expect(promesa!.tabla.validTo).toBeNull();
  });

  it("TODO O NADA: una franja fuera del horario tumba el conjunto entero, sin guardar nada", async () => {
    const franjas: FranjaCapturada[] = [
      { diaTipo: "sabado", sentido: null, desdeLocal: "08:00", hastaLocal: "10:00", frequencyMinutes: 30 },
      // El circuito cierra a las 23:00 — ésta cae fuera.
      { diaTipo: "sabado", sentido: null, desdeLocal: "22:30", hastaLocal: "23:30", frequencyMinutes: 30 },
    ];
    const antes = await repos.circuits.getPromiseTableVigente(circuitoId);

    const r = await repos.circuits.savePromiseTable(circuitoId, franjas);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rechazadas).toHaveLength(1);
    expect(r.rechazadas[0]!.motivo).toBe("fuera_de_horario_de_servicio");

    // Nada cambió: sigue vigente exactamente lo de antes.
    const despues = await repos.circuits.getPromiseTableVigente(circuitoId);
    expect(despues!.tabla.id).toBe(antes!.tabla.id);
    expect(despues!.bandas).toHaveLength(antes!.bandas.length);
  });

  it("corregir la promesa CIERRA la vigente y abre otra — no pisa la franja, versiona el conjunto", async () => {
    const vigenteAntes = await repos.circuits.getPromiseTableVigente(circuitoId);
    const idAntes = vigenteAntes!.tabla.id;

    const nueva: FranjaCapturada[] = [
      { diaTipo: "entre_semana", sentido: null, desdeLocal: "06:00", hastaLocal: "22:00", frequencyMinutes: 15 },
    ];
    const r = await repos.circuits.savePromiseTable(circuitoId, nueva, { motivo: "se simplificó a una sola franja" });
    expect(r.ok).toBe(true);

    // La vieja sigue en la base, cerrada — no se borró.
    const [vieja] = await db
      .select()
      .from(circuitPromiseTables)
      .where(eq(circuitPromiseTables.id, idAntes));
    expect(vieja).toBeDefined();
    expect(vieja!.validTo).not.toBeNull();
    expect(vieja!.motivo).toBe("se simplificó a una sola franja");

    // La vigente ahora es una fila distinta, con una sola franja.
    const vigenteAhora = await repos.circuits.getPromiseTableVigente(circuitoId);
    expect(vigenteAhora!.tabla.id).not.toBe(idAntes);
    expect(vigenteAhora!.bandas).toHaveLength(1);
  });

  it("el candado de la base: nunca dos tablas vigentes del mismo circuito a la vez", async () => {
    const vigente = await repos.circuits.getPromiseTableVigente(circuitoId);
    // Intentar abrir una segunda vigente A MANO, sin pasar por el método que
    // cierra primero — así se ejerce el índice único, no el código de turno.
    await expect(
      db.insert(circuitPromiseTables).values({ circuitId: circuitoId }),
    ).rejects.toThrow();
    // La vigente sigue siendo la misma de antes del intento.
    const despues = await repos.circuits.getPromiseTableVigente(circuitoId);
    expect(despues!.tabla.id).toBe(vigente!.tabla.id);
  });

  it("horario nocturno: una franja de la madrugada se acepta, una del mediodía se rechaza", async () => {
    const franjas: FranjaCapturada[] = [
      { diaTipo: "entre_semana", sentido: null, desdeLocal: "23:00", hastaLocal: "23:59", frequencyMinutes: 20 },
      { diaTipo: "entre_semana", sentido: null, desdeLocal: "12:00", hastaLocal: "13:00", frequencyMinutes: 20 },
    ];
    const r = await repos.circuits.savePromiseTable(circuitoNocturnoId, franjas);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.rechazadas).toHaveLength(1);
    expect(r.rechazadas[0]!.franja.desdeLocal).toBe("12:00");
  });

  it("el CHECK de la base rechaza una frecuencia de cero, aunque el dominio la dejara pasar", async () => {
    // Ejerce el CHECK directo, no la validación de dominio (que ya exige >0
    // en su tipo, pero la base es la garantía última — igual que en circuits).
    // `validTo` ya CERRADO: no compite con el candado de «una vigente», que
    // es harina de otro costal y ya tiene su propia prueba.
    const [tabla] = await db
      .insert(circuitPromiseTables)
      .values({ circuitId: circuitoId, validFrom: new Date("2020-01-01"), validTo: new Date("2020-01-02") })
      .returning();
    await expect(
      db.insert(circuitPromiseBands).values({
        promiseTableId: tabla!.id,
        diaTipo: "domingo",
        desdeLocal: "06:00",
        hastaLocal: "07:00",
        frequencyMinutes: 0,
      }),
    ).rejects.toThrow();
  });

  it("el CHECK de la base rechaza una franja que ella misma cruza medianoche", async () => {
    const [tabla] = await db
      .insert(circuitPromiseTables)
      .values({ circuitId: circuitoId, validFrom: new Date("2020-01-01"), validTo: new Date("2020-01-02") })
      .returning();
    await expect(
      db.insert(circuitPromiseBands).values({
        promiseTableId: tabla!.id,
        diaTipo: "domingo",
        desdeLocal: "23:00",
        hastaLocal: "01:00",
        frequencyMinutes: 20,
      }),
    ).rejects.toThrow();
  });
});

describe("getPromiseTableAt · la promesa vigente en un instante pasado", () => {
  it("un circuito propio, sin tocar los de los otros tests: cierra dos promesas y pregunta por cada una", async () => {
    const propio = await repos.circuits.createCircuit({
      concessionAccountId: concesionId,
      name: `Historia ${marca}`,
      publicSlug: `historia-${marca}`,
      serviceStartLocal: "05:00",
      serviceEndLocal: "23:00",
    });
    const circuitId = propio!.id;

    const primera: FranjaCapturada[] = [
      { diaTipo: "entre_semana", sentido: null, desdeLocal: "06:00", hastaLocal: "09:00", frequencyMinutes: 10 },
    ];
    await repos.circuits.savePromiseTable(circuitId, primera);
    const instanteDeLaPrimera = new Date();
    await new Promise((r) => setTimeout(r, 5));

    const segunda: FranjaCapturada[] = [
      { diaTipo: "entre_semana", sentido: null, desdeLocal: "06:00", hastaLocal: "09:00", frequencyMinutes: 30 },
    ];
    await repos.circuits.savePromiseTable(circuitId, segunda, { motivo: "cambió la cadencia" });

    // Preguntando por el instante de la primera, se obtiene la primera —
    // aunque hoy la vigente sea otra. Es la ley de 9.1c: juzgar contra lo que
    // se prometía entonces, no contra lo de hoy.
    const enElPasado = await repos.circuits.getPromiseTableAt(circuitId, instanteDeLaPrimera);
    expect(enElPasado!.bandas[0]!.frequencyMinutes).toBe(10);

    const ahora = await repos.circuits.getPromiseTableAt(circuitId, new Date());
    expect(ahora!.bandas[0]!.frequencyMinutes).toBe(30);

    // Y antes de que existiera cualquiera de las dos, no hay ninguna.
    const antesDeTodo = await repos.circuits.getPromiseTableAt(circuitId, new Date("2020-01-01"));
    expect(antesDeTodo).toBeNull();
  });
});

describe("getPromesaEnInstante · la promesa para un instante, ya interpretada", () => {
  it("la hora pico y el valle dan cadencias distintas — nunca un promedio del día", async () => {
    const propio = await repos.circuits.createCircuit({
      concessionAccountId: concesionId,
      name: `Interpretada ${marca}`,
      publicSlug: `interpretada-${marca}`,
      serviceStartLocal: "05:00",
      serviceEndLocal: "23:00",
      timeZone: "America/Ciudad_Juarez",
    });
    const circuitId = propio!.id;

    // Insertada DIRECTO, con `validFrom` fijo en el pasado — no por
    // `savePromiseTable`, que la habría abierto en el instante real de la
    // corrida. Así los instantes de prueba (2026-09-15, un martes) no dependen
    // de en qué fecha real se ejecute esta prueba.
    const [tabla] = await db
      .insert(circuitPromiseTables)
      .values({ circuitId, validFrom: new Date("2020-01-01") })
      .returning();
    await db.insert(circuitPromiseBands).values(
      FRANJAS_OASIS.map((f) => ({
        promiseTableId: tabla!.id,
        diaTipo: f.diaTipo,
        sentido: f.sentido,
        desdeLocal: f.desdeLocal,
        hastaLocal: f.hastaLocal,
        frequencyMinutes: f.frequencyMinutes,
      })),
    );

    // 2026-09-15 es martes (entre semana) en Juárez.
    const pico = new Date("2026-09-15T13:00:00Z"); // 07:00 local (UTC-6)
    const valle = new Date("2026-09-15T20:00:00Z"); // 14:00 local

    await expect(
      repos.circuits.getPromesaEnInstante(circuitId, pico, "ida", "America/Ciudad_Juarez"),
    ).resolves.toMatchObject({ declarada: true, frequencyMinutes: 10 });

    await expect(
      repos.circuits.getPromesaEnInstante(circuitId, valle, "ida", "America/Ciudad_Juarez"),
    ).resolves.toMatchObject({ declarada: true, frequencyMinutes: 20 });
  });

  it("un circuito sin ninguna promesa capturada dice 'sin declarar', no inventa nada", async () => {
    const propio = await repos.circuits.createCircuit({
      concessionAccountId: concesionId,
      name: `Sin promesa ${marca}`,
      publicSlug: `sin-promesa-${marca}`,
    });
    const r = await repos.circuits.getPromesaEnInstante(
      propio!.id,
      new Date(),
      "ida",
      "America/Ciudad_Juarez",
    );
    expect(r).toEqual({ declarada: false });
  });
});

describe("listPromiseTables · la historia de la promesa", () => {
  it("cada versión con su vigencia, su motivo de cierre y SUS franjas contadas — la más reciente arriba", async () => {
    const propio = await repos.circuits.createCircuit({
      concessionAccountId: concesionId,
      name: `Historia ${marca}`,
      publicSlug: `versiones-${marca}`,
    });
    const circuitId = propio!.id;
    // Dos versiones con número de franjas distinto: si el conteo se cruzara con
    // el id de la franja en vez del de la versión, saldría otro número.
    await repos.circuits.savePromiseTable(circuitId, FRANJAS_OASIS);
    await repos.circuits.savePromiseTable(
      circuitId,
      [{ diaTipo: "entre_semana", sentido: null, desdeLocal: "06:00", hastaLocal: "20:00", frequencyMinutes: 15 }],
      { motivo: "se simplificó" },
    );

    const h = await repos.circuits.listPromiseTables(circuitId);
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ validTo: null, motivo: null, franjas: 1 });
    expect(h[1]).toMatchObject({ motivo: "se simplificó", franjas: FRANJAS_OASIS.length });
    expect(h[1]!.validTo).toBeInstanceOf(Date);
  });
});

describe("quién capturó la promesa (0049)", () => {
  it("cada versión queda firmada con quien la capturó; lo de antes, nulo", async () => {
    const propio = await repos.circuits.createCircuit({
      concessionAccountId: concesionId,
      name: `Autor ${marca}`,
      publicSlug: `autor-${marca}`,
    });
    const circuitId = propio!.id;
    await repos.circuits.savePromiseTable(circuitId, FRANJAS_OASIS);
    await repos.circuits.savePromiseTable(circuitId, FRANJAS_OASIS, { motivo: "otra", capturadaPor: "user_jstaff" });

    const h = await repos.circuits.listPromiseTables(circuitId);
    expect(h[0]).toMatchObject({ capturadaPor: "user_jstaff", validTo: null });
    // La primera no dijo quién: queda nula, no se inventa. Y quien la cerró es quien capturó la siguiente.
    expect(h[1]).toMatchObject({ capturadaPor: null, motivo: "otra" });
  });
});
