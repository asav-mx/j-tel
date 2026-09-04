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
    const c = await repos.circuits.updateCircuit(circuitoId, { avgSpeedKmh: 17.3 });
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
    const c = await repos.circuits.updateCircuit(circuitoId, { corridorToleranceMeters: 250 });
    expect(c?.corridorToleranceMeters).toBe(250);
  });

  it("es independiente de la tolerancia de pegado: son dos conceptos", async () => {
    const c = await repos.circuits.updateCircuit(circuitoId, {
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
    expect((await repos.circuits.updateCircuit(circuitoId, { colorHex: "#5B3EA6" }))?.colorHex).toBe(
      "#5B3EA6",
    );
    expect((await repos.circuits.updateCircuit(circuitoId, { colorHex: "#a78bfa" }))?.colorHex).toBe(
      "#a78bfa",
    );
  });
});

describe("la frecuencia declarada, desde la 0031", () => {
  it("acepta el vacío: no declarada es un estado legítimo", async () => {
    const c = await repos.circuits.updateCircuit(circuitoId, { declaredFrequencyMinutes: null });
    expect(c?.declaredFrequencyMinutes).toBeNull();
  });

  it("el CHECK sigue mordiendo cuando SÍ hay valor", async () => {
    const quien = await violacion(() =>
      db.update(circuits).set({ declaredFrequencyMinutes: 0 }).where(inArray(circuits.id, [circuitoId])),
    );
    expect(quien).toBe("circuits_frecuencia_positiva");
  });

  it("un circuito nuevo NO hereda frecuencia: nace sin declarar", async () => {
    /*
     * Es la mitad que importa de la 0031. Antes nacía con 20 por default y la
     * app afirmaba «cada 20 minutos» sin que nadie lo hubiera dicho.
     */
    const nuevo = await repos.circuits.createCircuit({
      concessionAccountId: concesionId,
      name: `Sin frecuencia ${Date.now()}`,
      publicSlug: `sin-frec-${Date.now()}`,
    });
    expect(nuevo.declaredFrequencyMinutes).toBeNull();
  });
});

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
    const c = await repos.circuits.updateCircuit(circuitoId, { serviceLaunchDate: "2026-09-15" });
    expect(c?.serviceLaunchDate).toBe("2026-09-15");
  });

  it("se puede vaciar: si el circuito ya arrancó, deja de anunciarse", async () => {
    await repos.circuits.updateCircuit(circuitoId, { serviceLaunchDate: "2026-09-15" });
    const limpio = await repos.circuits.updateCircuit(circuitoId, { serviceLaunchDate: null });
    expect(limpio?.serviceLaunchDate).toBeNull();
  });

  it("acepta una fecha pasada: es el registro de cuándo arrancó, no un error", async () => {
    const c = await repos.circuits.updateCircuit(circuitoId, { serviceLaunchDate: "2020-01-01" });
    expect(c?.serviceLaunchDate).toBe("2020-01-01");
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
    const c = await repos.circuits.updateCircuit(circuitoId, { serviceConfidenceMinutes: 25 });
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

    const prendido = await repos.circuits.setArrivalRangeEnabled(nuevo.id, true);
    expect(prendido?.arrivalRangeEnabledAt).toBeInstanceOf(Date);

    const apagado = await repos.circuits.setArrivalRangeEnabled(nuevo.id, false);
    expect(apagado?.arrivalRangeEnabledAt).toBeNull();
  });

  it("apagar el rango NO despublica: son dos decisiones", async () => {
    await repos.circuits.setCircuitPublished(circuitoId, true);
    await repos.circuits.setArrivalRangeEnabled(circuitoId, false);
    const c = await repos.circuits.getCircuit(circuitoId);
    expect(c?.publishedAt).not.toBeNull();
    expect(c?.arrivalRangeEnabledAt).toBeNull();
  });
});
