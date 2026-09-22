import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { createDb, createRepositories, accounts, circuits } from "../src/index.js";

/*
 * Que los CHECK de `circuits` MUERDAN.
 *
 * ## Por qué esto vive aquí y no en el runbook
 *
 * Los runbooks de producción traían «pruebas negativas»: un UPDATE que debía
 * fallar, envuelto en SAVEPOINT, para demostrar que el candado rechaza el valor
 * malo. En una terminal de psql funcionan. **En la consola SQL de Neon, no**: se
 * detiene en la primera sentencia que falla y marca la transacción como fallida,
 * así que el `ROLLBACK TO SAVEPOINT` nunca corre y la aplicación entera muere a
 * media migración. Pasó el 27 de agosto de 2026 con la 0029.
 *
 * La lección —escrita en `docs/Procedimiento-Migraciones.md`— es que **una
 * prueba que no corre en el mismo entorno que el runbook no prueba el runbook**.
 * El entorno de producción es la consola de Neon, no una terminal.
 *
 * Así que el runbook solo LEE, y lo que hay que ejercer de verdad se ejerce
 * aquí: contra la rama desechable, automatizado, y en un entorno que sí aguanta
 * que una sentencia falle a propósito.
 *
 * ⚠ Requiere la 0029 aplicada en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) throw new Error("[circuits-constraints] DATABASE_URL_TEST no está definida.");
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error("[circuits-constraints] DATABASE_URL_TEST es producción. Estas pruebas escriben.");
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const marca = `k${Date.now().toString(36)}`;
let concesionId = "";
let circuitoId = "";

/*
 * Desde la 0051 las escrituras del circuito se firman (A4b). Estas pruebas
 * miden los CHECK y los valores de origen, no el registro — que tiene las
 * suyas abajo —, así que firman con un motivo de prueba.
 */
const FIRMA = { motivo: "prueba de integración", por: "prueba" };
async function cambiar(id: string, c: Parameters<typeof repos.circuits.cambiarCircuito>[1]) {
  const r = await repos.circuits.cambiarCircuito(id, c, FIRMA);
  return r.ok ? r.circuito : null;
}
async function rango(id: string, activo: boolean) {
  const r = await repos.circuits.cambiarRangoDeLlegada(id, activo, FIRMA);
  return r.ok ? r.circuito : null;
}

beforeAll(async () => {
  const { cuenta } = await repos.circuits.createConcession({
    name: `Concesión ${marca}`,
    slug: `concesion-${marca}`,
    legalName: `Concesión ${marca} SA`,
  });
  concesionId = cuenta.id;
  const c = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Circuito ${marca}`,
    publicSlug: `circuito-${marca}`,
  });
  circuitoId = c.id;
});

afterAll(async () => {
  await db.delete(accounts).where(inArray(accounts.id, [concesionId].filter(Boolean)));
});

/** Qué constraint rechazó la escritura. No basta con que fallara. */
async function violacion(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    const causa = (e as { cause?: { code?: string; constraint_name?: string } })?.cause;
    return causa?.code === "23514" ? (causa.constraint_name ?? "sin nombre") : `otro: ${causa?.code}`;
  }
}

describe("los defaults de la 0029", () => {
  it("un circuito nuevo nace con la velocidad medida y un color válido", async () => {
    const c = await repos.circuits.getCircuit(circuitoId);
    expect(c?.avgSpeedKmh).toBe(20.5);
    expect(c?.colorHex).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("circuits_velocidad_positiva", () => {
  it("rechaza el cero: dividiría entre cero al calcular la llegada", async () => {
    const quien = await violacion(() =>
      db.update(circuits).set({ avgSpeedKmh: 0 }).where(inArray(circuits.id, [circuitoId])),
    );
    expect(quien).toBe("circuits_velocidad_positiva");
  });

  it("rechaza una velocidad negativa", async () => {
    const quien = await violacion(() =>
      db.update(circuits).set({ avgSpeedKmh: -5 }).where(inArray(circuits.id, [circuitoId])),
    );
    expect(quien).toBe("circuits_velocidad_positiva");
  });

  it("deja pasar un valor calibrado con decimales", async () => {
    const c = await cambiar(circuitoId, { avgSpeedKmh: 17.3 });
    expect(c?.avgSpeedKmh).toBeCloseTo(17.3, 2);
  });
});

describe("circuits_corredor_positivo", () => {
  it("rechaza el cero: con corredor cero no se publicaría jamás una unidad", async () => {
    const quien = await violacion(() =>
      db.update(circuits).set({ corridorToleranceMeters: 0 }).where(inArray(circuits.id, [circuitoId])),
    );
    expect(quien).toBe("circuits_corredor_positivo");
  });

  it("rechaza el negativo", async () => {
    const quien = await violacion(() =>
      db.update(circuits).set({ corridorToleranceMeters: -1 }).where(inArray(circuits.id, [circuitoId])),
    );
    expect(quien).toBe("circuits_corredor_positivo");
  });

  it("deja pasar un corredor ancho para un trazado burdo", async () => {
    const c = await cambiar(circuitoId, { corridorToleranceMeters: 250 });
    expect(c?.corridorToleranceMeters).toBe(250);
  });

  it("es independiente de la tolerancia de pegado: son dos conceptos", async () => {
    const c = await cambiar(circuitoId, {
      corridorToleranceMeters: 150,
      stopSnapToleranceMeters: 25,
    });
    expect(c?.corridorToleranceMeters).toBe(150);
    expect(c?.stopSnapToleranceMeters).toBe(25);
  });
});

describe("circuits_color_valido", () => {
  it("rechaza un color que no es hexadecimal", async () => {
    const quien = await violacion(() =>
      db.update(circuits).set({ colorHex: "morado" }).where(inArray(circuits.id, [circuitoId])),
    );
    expect(quien).toBe("circuits_color_valido");
  });

  it("rechaza el hex corto, que el navegador sí aceptaría", async () => {
    // `#5B3` es válido en CSS y no aquí: el color viaja en JSON a la app y una
    // forma sola es una forma menos que mantener.
    const quien = await violacion(() =>
      db.update(circuits).set({ colorHex: "#5B3" }).where(inArray(circuits.id, [circuitoId])),
    );
    expect(quien).toBe("circuits_color_valido");
  });

  it("rechaza el hex sin gato", async () => {
    const quien = await violacion(() =>
      db.update(circuits).set({ colorHex: "5B3EA6" }).where(inArray(circuits.id, [circuitoId])),
    );
    expect(quien).toBe("circuits_color_valido");
  });

  it("deja pasar el hex de siete, en mayúsculas o minúsculas", async () => {
    expect((await cambiar(circuitoId, { colorHex: "#5B3EA6" }))?.colorHex).toBe(
      "#5B3EA6",
    );
    expect((await cambiar(circuitoId, { colorHex: "#a78bfa" }))?.colorHex).toBe(
      "#a78bfa",
    );
  });
});

/*
 * «La frecuencia declarada, desde la 0031» vivía aquí. La columna y su CHECK
 * (`circuits_frecuencia_positiva`) se borraron en la 0050: la promesa tiene una
 * sola fuente, las franjas, con sus propios CHECK (0044) y sus pruebas en
 * `promesa-por-franja.integration.test.ts`.
 */

describe("la fecha de arranque, desde la 0032", () => {
  it("un circuito nuevo NACE SIN FECHA: ya opera, no «arranca hoy»", async () => {
    /*
     * La columna no tiene default a propósito, por lo mismo que la frecuencia
     * perdió el suyo: la app la dice en voz alta. Un default aquí, además,
     * habría hecho que todo circuito naciera con el servicio apagado hasta la
     * medianoche.
     */
    const nuevo = await repos.circuits.createCircuit({
      concessionAccountId: concesionId,
      name: `Sin arranque ${Date.now()}`,
      publicSlug: `sin-arranque-${Date.now()}`,
    });
    expect(nuevo.serviceLaunchDate).toBeNull();
  });

  it("se guarda como día civil y regresa igual — sin corrimiento de zona", async () => {
    const c = await cambiar(circuitoId, { serviceLaunchDate: "2026-09-15" });
    expect(c?.serviceLaunchDate).toBe("2026-09-15");
  });

  it("se puede vaciar: si el circuito ya arrancó, deja de anunciarse", async () => {
    await cambiar(circuitoId, { serviceLaunchDate: "2026-09-15" });
    const limpio = await cambiar(circuitoId, { serviceLaunchDate: null });
    expect(limpio?.serviceLaunchDate).toBeNull();
  });

  it("acepta una fecha pasada: es el registro de cuándo arrancó, no un error", async () => {
    const c = await cambiar(circuitoId, { serviceLaunchDate: "2020-01-01" });
    expect(c?.serviceLaunchDate).toBe("2020-01-01");
  });
});

describe("el contador de aperturas, desde la 0033", () => {
  const hoy = "2026-09-05";
  const huella = () => `h-${Math.random().toString(16).slice(2)}`;

  it("EL MISMO APARATO DOS VECES ES UNA FILA, y el crudo sube", async () => {
    /*
     * Es la definición entera del contador: «aparatos distinguibles» = filas.
     * La deduplicación vive en el índice único de la base y no en el código que
     * inserta, porque entre un SELECT y un INSERT cabe la otra petición del
     * mismo aparato — dos pestañas, un reintento de red.
     */
    const h = huella();
    await repos.circuits.registrarApertura({ circuitId: circuitoId, localDate: hoy, fingerprint: h });
    await repos.circuits.registrarApertura({ circuitId: circuitoId, localDate: hoy, fingerprint: h });
    await repos.circuits.registrarApertura({ circuitId: circuitoId, localDate: hoy, fingerprint: h });

    const resumen = await repos.circuits.resumenDeAperturas(circuitoId, hoy);
    const dia = resumen.find((r) => r.localDate === hoy);
    expect(dia?.aparatos).toBe(1);
    // El crudo se guarda y no se enseña: es la señal de raspado.
    expect(dia?.crudo).toBe(3);
  });

  it("dos aparatos distintos el mismo día son dos filas", async () => {
    const dia = "2026-09-06";
    await repos.circuits.registrarApertura({ circuitId: circuitoId, localDate: dia, fingerprint: huella() });
    await repos.circuits.registrarApertura({ circuitId: circuitoId, localDate: dia, fingerprint: huella() });
    const resumen = await repos.circuits.resumenDeAperturas(circuitoId, dia);
    expect(resumen.find((r) => r.localDate === dia)?.aparatos).toBe(2);
  });

  it("la misma huella en DÍAS distintos son dos filas — el día es parte de la llave", async () => {
    /*
     * En la vida real esto no pasa —la huella lleva el día adentro y rota con
     * él—, y la llave lo sostiene igual: si algún día alguien quitara el día del
     * HMAC, los dos días seguirían contándose por separado en vez de fundirse.
     */
    const h = huella();
    await repos.circuits.registrarApertura({ circuitId: circuitoId, localDate: "2026-09-07", fingerprint: h });
    await repos.circuits.registrarApertura({ circuitId: circuitoId, localDate: "2026-09-08", fingerprint: h });
    const resumen = await repos.circuits.resumenDeAperturas(circuitoId, "2026-09-07");
    expect(resumen.filter((r) => r.aparatos === 1).length).toBeGreaterThanOrEqual(2);
  });

  it("el primer día con registro es el que separa un cero de un hueco", async () => {
    const primero = await repos.circuits.primerDiaConAperturas(circuitoId);
    expect(primero).toBe(hoy);
  });

  it("un circuito sin ninguna apertura devuelve null, nunca una fecha inventada", async () => {
    const nuevo = await repos.circuits.createCircuit({
      concessionAccountId: concesionId,
      name: `Sin aperturas ${Date.now()}`,
      publicSlug: `sin-aperturas-${Date.now()}`,
    });
    expect(await repos.circuits.primerDiaConAperturas(nuevo.id)).toBeNull();
    expect(await repos.circuits.resumenDeAperturas(nuevo.id, "2026-01-01")).toEqual([]);
  });
});

describe("circuits_confianza_positiva", () => {
  it("rechaza el cero: sin ventana, POR HORARIO no existiría nunca", async () => {
    const quien = await violacion(() =>
      db.update(circuits).set({ serviceConfidenceMinutes: 0 }).where(inArray(circuits.id, [circuitoId])),
    );
    expect(quien).toBe("circuits_confianza_positiva");
  });

  it("nace en 15 minutos y se puede afinar", async () => {
    const c = await cambiar(circuitoId, { serviceConfidenceMinutes: 25 });
    expect(c?.serviceConfidenceMinutes).toBe(25);
  });
});

describe("el interruptor del rango", () => {
  it("nace apagado, y prenderlo deja fecha", async () => {
    const nuevo = await repos.circuits.createCircuit({
      concessionAccountId: concesionId,
      name: `Rango ${Date.now()}`,
      publicSlug: `rango-${Date.now()}`,
    });
    expect(nuevo.arrivalRangeEnabledAt).toBeNull();

    const prendido = await rango(nuevo.id, true);
    expect(prendido?.arrivalRangeEnabledAt).toBeInstanceOf(Date);

    const apagado = await rango(nuevo.id, false);
    expect(apagado?.arrivalRangeEnabledAt).toBeNull();
  });

  it("apagar el rango NO despublica: son dos decisiones", async () => {
    await repos.circuits.setCircuitPublished(circuitoId, true);
    await rango(circuitoId, false);
    const c = await repos.circuits.getCircuit(circuitoId);
    expect(c?.publishedAt).not.toBeNull();
    expect(c?.arrivalRangeEnabledAt).toBeNull();
  });
});

/*
 * El registro de las reglas de la medición (0051, A4b). Lo que se prueba es la
 * ley de ASAV: el «antes» sale de la base, sin motivo no se escribe nada, y
 * mandar el valor de hoy no deja renglón.
 */
describe("cambiarCircuito · el registro de las reglas de la medición", () => {
  it("una regla que cambia queda con su antes (de la base), su después, quién y por qué", async () => {
    const antes = (await repos.circuits.getCircuit(circuitoId))!.corridorToleranceMeters;
    const r = await repos.circuits.cambiarCircuito(circuitoId, { corridorToleranceMeters: antes + 7 }, { motivo: "calibración", por: "user_asav" });
    expect(r).toMatchObject({ ok: true, registrados: 1 });
    const [ultimo] = await repos.circuits.listRuleChanges(circuitoId);
    expect(ultimo).toMatchObject({
      regla: "corridor_tolerance_meters",
      valorAntes: String(antes),
      valorDespues: String(antes + 7),
      motivo: "calibración",
      cambiadoPor: "user_asav",
    });
  });

  it("sin motivo NO se escribe nada — ni la regla ni el nombre que venía junto", async () => {
    const c = (await repos.circuits.getCircuit(circuitoId))!;
    const r = await repos.circuits.cambiarCircuito(
      circuitoId,
      { name: "No debe quedar", staleAfterSeconds: c.staleAfterSeconds + 1 },
      { motivo: "   ", por: "user_asav" },
    );
    expect(r).toEqual({ ok: false, error: "falta_motivo" });
    const despues = (await repos.circuits.getCircuit(circuitoId))!;
    expect(despues.name).toBe(c.name);
    expect(despues.staleAfterSeconds).toBe(c.staleAfterSeconds);
  });

  it("mandar el valor de hoy no es un cambio: no pide motivo ni deja renglón (la hora «05:00» es la «05:00:00» de la base)", async () => {
    const c = (await repos.circuits.getCircuit(circuitoId))!;
    const n = (await repos.circuits.listRuleChanges(circuitoId)).length;
    const r = await repos.circuits.cambiarCircuito(
      circuitoId,
      { serviceStartLocal: c.serviceStartLocal.slice(0, 5), avgSpeedKmh: c.avgSpeedKmh },
      { motivo: null, por: null },
    );
    expect(r).toMatchObject({ ok: true, registrados: 0 });
    expect((await repos.circuits.listRuleChanges(circuitoId)).length).toBe(n);
  });

  it("el nombre y el color no son reglas: se guardan sin motivo y sin renglón", async () => {
    const n = (await repos.circuits.listRuleChanges(circuitoId)).length;
    const r = await repos.circuits.cambiarCircuito(circuitoId, { colorHex: "#2E6A4E" }, { motivo: null, por: null });
    expect(r).toMatchObject({ ok: true, registrados: 0 });
    expect((await repos.circuits.listRuleChanges(circuitoId)).length).toBe(n);
  });

  it("el horario y la fecha de arranque SÍ son reglas", async () => {
    const r = await repos.circuits.cambiarCircuito(
      circuitoId,
      { serviceEndLocal: "21:45", serviceLaunchDate: "2026-10-01" },
      { motivo: "arranque de Oasis", por: "user_asav" },
    );
    expect(r).toMatchObject({ ok: true, registrados: 2 });
    const reglas = (await repos.circuits.listRuleChanges(circuitoId)).slice(0, 2).map((x) => x.regla).sort();
    expect(reglas).toEqual(["service_end_local", "service_launch_date"]);
  });

  it("la tolerancia de llegada y los minutos fuera del corredor tienen escritura, y la base los cuida", async () => {
    const r = await repos.circuits.cambiarCircuito(
      circuitoId,
      { arrivalTolerancePct: 35, corridorExitMinutes: 4 },
      { motivo: "calibración", por: "user_asav" },
    );
    expect(r).toMatchObject({ ok: true, registrados: 2 });
    await expect(
      repos.circuits.cambiarCircuito(circuitoId, { arrivalTolerancePct: 150 }, { motivo: "x", por: "user_asav" }),
    ).rejects.toThrow();
    await expect(
      repos.circuits.cambiarCircuito(circuitoId, { corridorExitMinutes: 0 }, { motivo: "x", por: "user_asav" }),
    ).rejects.toThrow();
  });

  it("el tiempo estimado se firma; pedir el estado que ya tiene no deja renglón ni mueve su fecha", async () => {
    await rango(circuitoId, false);
    const n = (await repos.circuits.listRuleChanges(circuitoId)).length;
    expect(await repos.circuits.cambiarRangoDeLlegada(circuitoId, true, { motivo: null, por: "user_asav" })).toEqual({
      ok: false,
      error: "falta_motivo",
    });
    const r = await repos.circuits.cambiarRangoDeLlegada(circuitoId, true, { motivo: "velocidad calibrada", por: "user_asav" });
    expect(r).toMatchObject({ ok: true, registrados: 1 });
    const fecha = r.ok ? r.circuito.arrivalRangeEnabledAt : null;
    const otra = await repos.circuits.cambiarRangoDeLlegada(circuitoId, true, { motivo: null, por: null });
    expect(otra).toMatchObject({ ok: true, registrados: 0 });
    expect(otra.ok ? otra.circuito.arrivalRangeEnabledAt : null).toEqual(fecha);
    const [ultimo] = await repos.circuits.listRuleChanges(circuitoId);
    expect(ultimo).toMatchObject({ regla: "arrival_range_enabled_at", valorAntes: "apagado", valorDespues: "encendido" });
    expect((await repos.circuits.listRuleChanges(circuitoId)).length).toBe(n + 1);
  });

  it("la columna nueva nace en 3 para un circuito nuevo — el mismo número de antes", async () => {
    const nuevo = await repos.circuits.createCircuit({
      concessionAccountId: concesionId,
      name: `Minutos ${Date.now()}`,
      publicSlug: `minutos-${Date.now()}`,
    });
    expect(nuevo.corridorExitMinutes).toBe(3);
  });
});
