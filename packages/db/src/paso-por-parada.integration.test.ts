import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDb,
  createRepositories,
  accounts,
  telemetryPoints,
  circuitStopPasses,
  circuitUnitAssignments,
} from "../src/index.js";

/*
 * El detector de pasos por parada, contra base de verdad y DATOS SEMBRADOS —
 * no contra la captura real de Oasis–Centro, que Asav todavía no hace (pidió
 * expresamente construir sin esperarla, 20-sep).
 *
 * ESCRIBEN, así que van contra `DATABASE_URL_TEST` — una rama desechable de
 * Neon — y nunca contra producción. Mismo candado que el resto de la casa.
 *
 * ⚠ Requiere las migraciones 0025–0045 aplicadas en la rama de prueba.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[paso-por-parada] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[paso-por-parada] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);

const marca = `pp${Date.now().toString(36)}`;

/*
 * El trazado sembrado: una recta de ~1 km sobre Juárez — no hace falta un
 * trazado real para probar la geometría, sólo uno con longitud y dirección
 * conocidas, como ya hace `franja-horaria.test.ts` con las horas.
 */
const TRAZADO: Array<[number, number]> = [
  [-106.46, 31.72],
  [-106.4515, 31.72], // ~803 m más al este, en el paralelo 31.72 (~93.5 m por 0.001° de lon)
];

/** Un punto sobre el trazado, a X metros del inicio, avanzando hacia el este. */
function puntoSobreElTrazado(metros: number): { lat: number; lon: number } {
  const metrosPorGradoLon = 111_412.84 * Math.cos((31.72 * Math.PI) / 180);
  return { lat: 31.72, lon: -106.46 + metros / metrosPorGradoLon };
}

let concesionId = "";
let carrierId = "";
let circuitoId = "";
let unidadId = "";
let stopA = { stopId: "", stopVersionId: "" };
let stopB = { stopId: "", stopVersionId: "" };
const imeiSembrado = `imei-${marca}`;
const idsDePuntosSembrados: string[] = [];

beforeAll(async () => {
  const { cuenta } = await repos.circuits.createConcession({
    name: `Concesión ${marca}`,
    slug: `concesion-${marca}`,
    legalName: `Concesión ${marca} SA de CV`,
  });
  concesionId = cuenta.id;

  const carrier = await repos.accounts.create({
    type: "carrier",
    name: `Transportista ${marca}`,
    slug: `transportista-${marca}`,
  });
  carrierId = carrier.id;

  const circuito = await repos.circuits.createCircuit({
    concessionAccountId: concesionId,
    name: `Circuito ${marca}`,
    publicSlug: `circuito-${marca}`,
    corridorToleranceMeters: 150,
  });
  circuitoId = circuito!.id;

  await repos.circuits.upsertPath({
    circuitId: circuitoId,
    sentido: "ida",
    coordinates: TRAZADO,
    pointCount: TRAZADO.length,
    lengthMeters: 803,
  });

  const a = await repos.circuits.createStop({
    circuitId: circuitoId,
    qrSlug: `stop-a-${marca}`,
    name: "Parada A",
    orden: 1,
    latitude: 31.72,
    longitude: puntoSobreElTrazado(200).lon,
  });
  stopA = { stopId: a.identidad.id, stopVersionId: a.version.id };

  const b = await repos.circuits.createStop({
    circuitId: circuitoId,
    qrSlug: `stop-b-${marca}`,
    name: "Parada B",
    orden: 2,
    latitude: 31.72,
    longitude: puntoSobreElTrazado(600).lon,
  });
  stopB = { stopId: b.identidad.id, stopVersionId: b.version.id };

  unidadId = (await repos.fleet.createUnit(carrierId, `U-${marca}`)).id;

  /*
   * El recorrido sembrado, con la trampa a propósito: un hueco de 40 minutos
   * entre el km 100 y el km 700 — que se traga la Parada A (200 m) Y la
   * Parada B (600 m) en un solo intervalo. Es la prueba central del Marco:
   * el cruce no se las salta, aunque el hueco sea enorme.
   */
  const base = new Date("2026-09-20T13:00:00Z"); // 07:00 local Juárez, entre semana.
  const puntosASembrar = [
    { metros: 0, minutos: 0 },
    { metros: 100, minutos: 1 },
    { metros: 700, minutos: 41 }, // el hueco de 40 minutos.
    { metros: 803, minutos: 42 },
  ];

  for (const p of puntosASembrar) {
    const { lat, lon } = puntoSobreElTrazado(p.metros);
    const [fila] = await db
      .insert(telemetryPoints)
      .values({
        carrierAccountId: carrierId,
        unitId: unidadId,
        imei: imeiSembrado,
        latitude: lat,
        longitude: lon,
        recordedAt: new Date(base.getTime() + p.minutos * 60_000),
        source: "traccar",
      })
      .returning();
    idsDePuntosSembrados.push(fila!.id);
  }
});

afterAll(async () => {
  await db.delete(telemetryPoints).where(inArray(telemetryPoints.id, idsDePuntosSembrados));
  await db.delete(accounts).where(inArray(accounts.id, [concesionId, carrierId].filter(Boolean)));
});

describe("detectarYGuardar · el detector completo, contra datos sembrados", () => {
  it("detecta las dos paradas aunque un solo hueco de 40 min se las trague enteras", async () => {
    const guardados = await repos.pasosPorParada.detectarYGuardar({
      carrierAccountId: carrierId,
      circuitId: circuitoId,
      unitId: unidadId,
      sentido: "ida",
      trazado: TRAZADO,
      corridorToleranceMeters: 150,
      desde: new Date("2026-09-20T12:59:00Z"),
      hasta: new Date("2026-09-20T13:50:00Z"),
      detectorVersion: "v1-cruce",
    });

    expect(guardados).toHaveLength(2);

    const porParada = new Map(guardados.map((g) => [g.stopId, g]));
    const pasoA = porParada.get(stopA.stopId)!;
    const pasoB = porParada.get(stopB.stopId)!;

    expect(pasoA).toBeDefined();
    expect(pasoB).toBeDefined();

    // Las dos vienen del MISMO intervalo — el del hueco de 40 min — porque
    // las dos caen entre el punto de los 100 m y el de los 700 m.
    expect(pasoA.pasoDesde).toEqual(new Date("2026-09-20T13:01:00Z"));
    expect(pasoA.pasoHasta).toEqual(new Date("2026-09-20T13:41:00Z"));
    expect(pasoA.huecoSegundos).toBe(40 * 60);
    expect(pasoB.pasoDesde).toEqual(pasoA.pasoDesde);
    expect(pasoB.pasoHasta).toEqual(pasoA.pasoHasta);

    expect(pasoA.stopVersionId).toBe(stopA.stopVersionId);
    expect(pasoA.detectorVersion).toBe("v1-cruce");
    expect(pasoA.pingPrevioId).not.toBeNull();
    expect(pasoA.pingSiguienteId).not.toBeNull();
  });

  it("listarPasosDeParada devuelve lo guardado, ordenado por paso_desde", async () => {
    const pasos = await repos.pasosPorParada.listarPasosDeParada(concesionId, stopA.stopId);
    expect(pasos.length).toBeGreaterThanOrEqual(1);
    expect(pasos[0]!.stopId).toBe(stopA.stopId);
  });

  it("el muro: una cuenta que no es la dueña del circuito no lee los pasos — responde como si no existieran", async () => {
    // Hay pasos guardados (la prueba de arriba), así que la lista vacía no es «aún no hay»: es el muro.
    const propios = await repos.pasosPorParada.listarPasosDeParada(concesionId, stopA.stopId);
    expect(propios.length).toBeGreaterThanOrEqual(1);

    const ajenos = await repos.pasosPorParada.listarPasosDeParada(carrierId, stopA.stopId);
    expect(ajenos).toEqual([]);
  });

  it("apilar, no pisar: una segunda corrida con otra detectorVersion no borra la primera", async () => {
    const antes = await repos.pasosPorParada.listarPasosDeParada(concesionId, stopA.stopId);

    await repos.pasosPorParada.detectarYGuardar({
      carrierAccountId: carrierId,
      circuitId: circuitoId,
      unitId: unidadId,
      sentido: "ida",
      trazado: TRAZADO,
      corridorToleranceMeters: 150,
      desde: new Date("2026-09-20T12:59:00Z"),
      hasta: new Date("2026-09-20T13:50:00Z"),
      detectorVersion: "v2-corregido",
    });

    const despues = await repos.pasosPorParada.listarPasosDeParada(concesionId, stopA.stopId);
    expect(despues.length).toBe(antes.length + 1);
    expect(despues.map((p) => p.detectorVersion).sort()).toEqual(["v1-cruce", "v2-corregido"]);

    // limpieza de lo que insertó esta prueba, para no ensuciar la corrida anterior
    await db.delete(circuitStopPasses).where(eq(circuitStopPasses.detectorVersion, "v2-corregido"));
  });

  it("una ventana sin ningún punto no detecta nada, y no truena", async () => {
    const guardados = await repos.pasosPorParada.detectarYGuardar({
      carrierAccountId: carrierId,
      circuitId: circuitoId,
      unitId: unidadId,
      sentido: "ida",
      trazado: TRAZADO,
      corridorToleranceMeters: 150,
      desde: new Date("2020-01-01T00:00:00Z"),
      hasta: new Date("2020-01-01T01:00:00Z"),
      detectorVersion: "v1-cruce",
    });
    expect(guardados).toHaveLength(0);
  });

  it("el CHECK de la base rechaza un rango invertido (paso_hasta < paso_desde)", async () => {
    await expect(
      db.insert(circuitStopPasses).values({
        circuitId: circuitoId,
        stopId: stopA.stopId,
        stopVersionId: stopA.stopVersionId,
        unitId: unidadId,
        sentido: "ida",
        pasoDesde: new Date("2026-09-20T13:10:00Z"),
        pasoHasta: new Date("2026-09-20T13:00:00Z"),
        huecoSegundos: -600,
        detectorVersion: "prueba-del-check",
      }),
    ).rejects.toThrow();
  });
});

/*
 * EL MURO DE LOS PASOS POR UNIDAD — dos carriers en el mismo circuito
 * (Enmiendas de la Pieza 9, 9.14).
 *
 * La lectura tiene DOS entradas: la concesión dueña del circuito ve todos los
 * pasos; un carrier ve los de SUS unidades y nada más. Esta matriz siembra el
 * peor caso —dos carriers en el mismo circuito, más las filas que no cuadran— y
 * mide, cuenta por cuenta, qué lee cada una. La valla estática
 * (`guardia-muro-cuenta.test.ts`) corre sin base y no puede sembrar; exige que
 * ESTA matriz exista, y aquí es donde se mide el comportamiento.
 *
 * Los pasos se insertan a mano (este archivo es de los tres que pueden tocar la
 * tabla) y se leen SÓLO por el repositorio.
 */
describe("el muro por unidad — dos carriers en el mismo circuito", () => {
  const m = `mu${Date.now().toString(36)}`;
  const DIA = 24 * 3_600_000;
  const hace = (dias: number) => new Date(Date.now() - dias * DIA);
  /** Dos fixes con orden conocido: es el desempate de «una sola fila por unidad». */
  const FIX_VIEJO = new Date(Date.now() - 20 * 60_000);
  const FIX_NUEVO = new Date(Date.now() - 2 * 60_000);

  const cuentas = {} as Record<"C1" | "C2" | "A" | "B" | "F" | "G" | "K" | "J", string>;
  const circuito = {} as Record<"K1" | "K2", string>;
  const parada = {} as Record<"S1" | "S2", { stopId: string; stopVersionId: string }>;
  const unidad = {} as Record<"uA" | "uB" | "uD" | "uH" | "uM" | "uO" | "uS" | "uX", string>;

  async function circuitoConParada(concesion: string, nombre: string) {
    const c = await repos.circuits.createCircuit({
      concessionAccountId: concesion,
      name: `${nombre} ${m}`,
      publicSlug: `${nombre.toLowerCase()}-${m}`,
      corridorToleranceMeters: 150,
    });
    const p = await repos.circuits.createStop({
      circuitId: c!.id,
      qrSlug: `p-${nombre.toLowerCase()}-${m}`,
      name: `Parada ${nombre}`,
      orden: 1,
      latitude: 31.72,
      longitude: -106.455,
      sentido: "ida",
    });
    return { circuitId: c!.id, parada: { stopId: p.identidad.id, stopVersionId: p.version.id } };
  }

  async function asignar(circuitId: string, unitId: string, carrierAccountId: string, validFrom: Date, validTo: Date | null = null) {
    await db.insert(circuitUnitAssignments).values({ circuitId, unitId, carrierAccountId, validFrom, validTo });
  }

  /** Un paso, sin pings de evidencia (son NULLables): aquí sólo importa quién lo puede leer. */
  async function paso(circuitId: string, p: { stopId: string; stopVersionId: string }, unitId: string, minuto: number) {
    const desde = new Date(hace(1).getTime() + minuto * 60_000);
    await db.insert(circuitStopPasses).values({
      circuitId,
      stopId: p.stopId,
      stopVersionId: p.stopVersionId,
      unitId,
      sentido: "ida",
      pasoDesde: desde,
      pasoHasta: new Date(desde.getTime() + 30_000),
      huecoSegundos: 30,
      detectorVersion: `muro-${m}`,
    });
  }

  /** Las unidades que cada cuenta lee de una parada, en claro. */
  async function lee(cuenta: keyof typeof cuentas, stopId: string): Promise<string[]> {
    const nombreDe = new Map(Object.entries(unidad).map(([nombre, id]) => [id, nombre]));
    const pasos = await repos.pasosPorParada.listarPasosDeParada(cuentas[cuenta], stopId);
    return pasos.map((p) => nombreDe.get(p.unitId)!).sort();
  }

  beforeAll(async () => {
    cuentas.C1 = (await repos.circuits.createConcession({ name: `Concesión 1 ${m}`, slug: `c1-${m}`, legalName: `C1 ${m} SA` })).cuenta.id;
    cuentas.C2 = (await repos.circuits.createConcession({ name: `Concesión 2 ${m}`, slug: `c2-${m}`, legalName: `C2 ${m} SA` })).cuenta.id;
    for (const [k, type] of [["A", "carrier"], ["B", "carrier"], ["F", "carrier"], ["G", "carrier"], ["K", "client"], ["J", "jstaff"]] as const) {
      cuentas[k] = (await repos.accounts.create({ type, name: `Cuenta ${k} ${m}`, slug: `${k.toLowerCase()}-${m}` })).id;
    }

    const k1 = await circuitoConParada(cuentas.C1, "K1");
    const k2 = await circuitoConParada(cuentas.C1, "K2");
    circuito.K1 = k1.circuitId;
    circuito.K2 = k2.circuitId;
    parada.S1 = k1.parada;
    parada.S2 = k2.parada;

    unidad.uA = (await repos.fleet.createUnit(cuentas.A, `uA-${m}`)).id; // de A, asignada por A a K1
    unidad.uB = (await repos.fleet.createUnit(cuentas.B, `uB-${m}`)).id; // de B, asignada por B a K1
    unidad.uH = (await repos.fleet.createUnit(cuentas.A, `uH-${m}`)).id; // de A, asignación de K1 YA CERRADA (historial)
    unidad.uM = (await repos.fleet.createUnit(cuentas.A, `uM-${m}`)).id; // de A, pero la asignación de K1 dice B (no cuadra)
    unidad.uO = (await repos.fleet.createUnit(cuentas.A, `uO-${m}`)).id; // de A, sin asignación alguna a K2
    unidad.uX = (await repos.fleet.createUnit(cuentas.B, `uX-${m}`)).id; // de B, pero la asignación de K2 dice G (no cuadra)
    unidad.uS = (await repos.fleet.createUnit(cuentas.A, `uS-${m}`)).id; // de A, asignada por A a K1, SIN aparato
    unidad.uD = (await repos.fleet.createUnit(cuentas.A, `uD-${m}`)).id; // de A, asignada por A a K1, con DOS aparatos vigentes

    await asignar(circuito.K1, unidad.uA, cuentas.A, hace(10));
    await asignar(circuito.K1, unidad.uB, cuentas.B, hace(10));
    await asignar(circuito.K1, unidad.uH, cuentas.A, hace(20), hace(5));
    await asignar(circuito.K1, unidad.uM, cuentas.B, hace(10));
    await asignar(circuito.K2, unidad.uX, cuentas.G, hace(10));
    await asignar(circuito.K1, unidad.uS, cuentas.A, hace(10));
    await asignar(circuito.K1, unidad.uD, cuentas.A, hace(10));

    // Todas pasaron por su parada: el muro decide quién lo puede leer.
    await paso(circuito.K1, parada.S1, unidad.uA, 0);
    await paso(circuito.K1, parada.S1, unidad.uB, 10);
    await paso(circuito.K1, parada.S1, unidad.uH, 20);
    await paso(circuito.K1, parada.S1, unidad.uM, 30);
    await paso(circuito.K2, parada.S2, unidad.uO, 0);
    await paso(circuito.K2, parada.S2, unidad.uX, 10);

    /*
     * Aparatos y posiciones vivas — el insumo de la puerta de posiciones.
     *
     * La posición se cuelga del APARATO (`live_positions.device_id`), no de la
     * unidad: en producción `live_positions.unit_id` viene vacío, así que
     * sembrarlo aquí haría pasar una consulta que allá devuelve cero filas.
     * Por eso se deja en null a propósito.
     */
    const aparatoConFix = async (unitId: string, imei: string, cuenta: string, fix: Date) => {
      const d = await repos.fleet.createDevice(cuenta, imei, `dev ${imei}`);
      await repos.fleet.assignDevice(unitId, d.id, hace(10));
      const p = puntoSobreElTrazado(400);
      await repos.livePositions.upsertMany([
        { imei, carrierAccountId: cuenta, deviceId: d.id, latitude: p.lat, longitude: p.lon, recordedAt: fix },
      ]);
      return d;
    };

    await aparatoConFix(unidad.uA, `10${m}a`, cuentas.A, FIX_NUEVO);
    await aparatoConFix(unidad.uB, `10${m}b`, cuentas.B, FIX_NUEVO);
    await aparatoConFix(unidad.uM, `10${m}m`, cuentas.A, FIX_NUEVO);
    // uH tiene aparato y fix fresco: su ausencia del plan es por la asignación
    // cerrada del circuito, no por falta de señal. Si no, la prueba pasaría
    // verde por la razón equivocada.
    await aparatoConFix(unidad.uH, `10${m}h`, cuentas.A, FIX_NUEVO);
    // uS no tiene aparato: su renglón se enuncia con la posición en null.

    /*
     * uD con DOS posiciones vivas colgadas del MISMO aparato.
     *
     * **No con dos aparatos**: desde la 0039 la base no deja dos asignaciones
     * vigentes sobre una unidad, y esta matriz lo comprobó chocando de frente
     * con `device_assignments_unidad_una_vigente` al intentar sembrarlo. La
     * puerta por donde el duplicado SÍ entra es `live_positions`, que se lleva
     * por IMEI y no tiene candado por `device_id`: un aparato reregistrado deja
     * su fila vieja apuntando al mismo aparato, y la unidad saldría dos veces
     * —«4 de 3 en el plan»— si la consulta no desempatara.
     */
    const aparatoD = await aparatoConFix(unidad.uD, `10${m}d1`, cuentas.A, FIX_VIEJO);
    const pD = puntoSobreElTrazado(500);
    await repos.livePositions.upsertMany([
      { imei: `10${m}d2`, carrierAccountId: cuentas.A, deviceId: aparatoD.id, latitude: pD.lat, longitude: pD.lon, recordedAt: FIX_NUEVO },
    ]);
  });

  afterAll(async () => {
    // Las cuentas arrastran por cascada circuitos, unidades, asignaciones y pasos.
    await db.delete(accounts).where(inArray(accounts.id, Object.values(cuentas).filter(Boolean)));
  });

  it("la concesión dueña ve TODOS los pasos de sus circuitos, como hoy", async () => {
    expect(await lee("C1", parada.S1.stopId)).toEqual(["uA", "uB", "uH", "uM"]);
    expect(await lee("C1", parada.S2.stopId)).toEqual(["uO", "uX"]);
  });

  it("cada carrier ve los pasos de SUS unidades y ninguno del otro, en el mismo circuito", async () => {
    // A: sus dos unidades bien asignadas (uA, y uH de historial). No uB, y no uM (la asignación no cuadra).
    expect(await lee("A", parada.S1.stopId)).toEqual(["uA", "uH"]);
    // B: sólo la suya. No uA ni uH, y no uM (es de A aunque la asignación diga B).
    expect(await lee("B", parada.S1.stopId)).toEqual(["uB"]);
  });

  it("el historial cuenta: una asignación ya cerrada sigue dejando a su carrier ver esos pasos", async () => {
    expect(await lee("A", parada.S1.stopId)).toContain("uH");
  });

  it("una fila que no cuadra (unidad de A, asignación a nombre de B) no se la abre a ningún carrier", async () => {
    expect(await lee("A", parada.S1.stopId)).not.toContain("uM"); // falla la cerradura 2
    expect(await lee("B", parada.S1.stopId)).not.toContain("uM"); // falla la cerradura 1
    expect(await lee("C1", parada.S1.stopId)).toContain("uM"); // sólo la concesión la ve
  });

  it("una unidad sin asignación a ESE circuito no lo abre: sus pasos ahí no los lee su dueño", async () => {
    expect(await lee("A", parada.S2.stopId)).toEqual([]); // uO es de A, sin asignación a K2
    expect(await lee("B", parada.S2.stopId)).toEqual([]); // uX es de B, pero la asignación dice G
    expect(await lee("G", parada.S2.stopId)).toEqual([]); // G reclama a uX, pero uX no es de G
  });

  it("cualquier otra cuenta lee lo mismo que si no hubiera pasos", async () => {
    for (const cuenta of ["F", "G", "K", "J", "C2"] as const) {
      expect(await lee(cuenta, parada.S1.stopId), `cuenta ${cuenta} en S1`).toEqual([]);
    }
    for (const cuenta of ["F", "K", "J", "C2"] as const) {
      expect(await lee(cuenta, parada.S2.stopId), `cuenta ${cuenta} en S2`).toEqual([]);
    }
  });

  it("el circuito existe sólo para la concesión dueña y para el carrier con unidades suyas ahí; para todos los demás, no existe", async () => {
    const ve = async (cuenta: keyof typeof cuentas, c: "K1" | "K2") =>
      (await repos.circuits.getCircuitVisibleParaCuenta(cuentas[cuenta], circuito[c])) !== null;

    // K1: la concesión, y los dos carriers con unidades suyas asignadas por ellos.
    expect([await ve("C1", "K1"), await ve("A", "K1"), await ve("B", "K1")]).toEqual([true, true, true]);
    for (const cuenta of ["F", "G", "K", "J", "C2"] as const) expect(await ve(cuenta, "K1"), `${cuenta} en K1`).toBe(false);

    // K2: sólo la concesión. A, B y G tienen un rastro ahí (uO sin asignación, uX de B a nombre de G) y ninguno cuadra.
    expect(await ve("C1", "K2")).toBe(true);
    for (const cuenta of ["A", "B", "F", "G", "K", "J", "C2"] as const) expect(await ve(cuenta, "K2"), `${cuenta} en K2`).toBe(false);
  });

  it("un circuito que no existe responde igual que uno ajeno: null", async () => {
    expect(await repos.circuits.getCircuitVisibleParaCuenta(cuentas.C1, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  /*
   * LA PUERTA DE POSICIONES — el plan del circuito con muro (Paso 1.A).
   *
   * Misma matriz, otra puerta. `planDelCircuitoParaCuenta` comparte las dos
   * cerraduras con la lectura de pasos, así que se mide sobre el mismo peor
   * caso ya sembrado: sembrarlo aparte sería la segunda copia que se separa de
   * la primera en el primer cambio.
   *
   * Lo que esta puerta NO comparte con la de pasos, y por eso se mide aquí:
   * **el plan es lo vigente**. Una asignación cerrada le sigue abriendo al
   * carrier sus pasos de entonces y NO lo pone en el plan de hoy (`uH`).
   */
  describe("la puerta de posiciones del circuito", () => {
    const nombreDe = () => new Map(Object.entries(unidad).map(([n, id]) => [id, n]));

    /** Las unidades que una cuenta lee del plan, en claro, con su alcance. */
    async function plan(cuenta: keyof typeof cuentas, c: "K1" | "K2") {
      const r = await repos.circuits.planDelCircuitoParaCuenta(cuentas[cuenta], circuito[c]);
      const nombres = nombreDe();
      return { alcance: r.alcance, unidades: r.unidades.map((u) => nombres.get(u.unitId)!).sort() };
    }

    it("la concesión dueña ve el plan completo de su circuito, con transportista", async () => {
      const r = await repos.circuits.planDelCircuitoParaCuenta(cuentas.C1, circuito.K1);
      expect(r.alcance).toBe("concesion");
      const nombres = nombreDe();
      expect(r.unidades.map((u) => nombres.get(u.unitId)!).sort()).toEqual(["uA", "uB", "uD", "uM", "uS"]);
      // El transportista viene, y distingue: K1 lo corren dos.
      if (r.alcance !== "concesion") throw new Error("alcance inesperado");
      const deA = r.unidades.find((u) => u.unitId === unidad.uA)!;
      const deB = r.unidades.find((u) => u.unitId === unidad.uB)!;
      expect(deA.carrierAccountId).toBe(cuentas.A);
      expect(deB.carrierAccountId).toBe(cuentas.B);
      expect(deA.carrierName).not.toBe(deB.carrierName);
    });

    it("cada carrier ve SUS unidades del plan y ninguna del otro, en el mismo circuito", async () => {
      expect(await plan("A", "K1")).toEqual({ alcance: "carrier", unidades: ["uA", "uD", "uS"] });
      expect(await plan("B", "K1")).toEqual({ alcance: "carrier", unidades: ["uB"] });
    });

    it("el carrier no recibe columna de transportista: no hay dónde se cuele el nombre de otro", async () => {
      const r = await repos.circuits.planDelCircuitoParaCuenta(cuentas.A, circuito.K1);
      expect(r.alcance).toBe("carrier");
      for (const u of r.unidades) {
        expect(Object.keys(u)).not.toContain("carrierName");
        expect(Object.keys(u)).not.toContain("carrierAccountId");
      }
    });

    it("una fila que no cuadra (unidad de A, asignación a nombre de B) no entra al plan de ningún carrier", async () => {
      expect((await plan("A", "K1")).unidades).not.toContain("uM"); // falla la cerradura de la asignación
      expect((await plan("B", "K1")).unidades).not.toContain("uM"); // falla la cerradura del alta
      expect((await plan("C1", "K1")).unidades).toContain("uM"); // sólo la concesión la ve
    });

    it("EL PLAN ES LO VIGENTE, el historial es otra pregunta: uH lee sus pasos y no sale en el plan", async () => {
      // La misma unidad, la misma cuenta, las dos puertas — y contestan distinto a propósito.
      expect(await lee("A", parada.S1.stopId)).toContain("uH");
      expect((await plan("A", "K1")).unidades).not.toContain("uH");
      expect((await plan("C1", "K1")).unidades).not.toContain("uH");
    });

    it("la asignación manda y la posición es opcional: una unidad sin aparato sale con null, no desaparece", async () => {
      const r = await repos.circuits.planDelCircuitoParaCuenta(cuentas.A, circuito.K1);
      const sinAparato = r.unidades.find((u) => u.unitId === unidad.uS);
      expect(sinAparato, "uS se perdió del plan: sin aparato no es sin asignación").toBeDefined();
      expect(sinAparato!.recordedAt).toBeNull();
      expect(sinAparato!.latitude).toBeNull();
      expect(sinAparato!.longitude).toBeNull();
    });

    it("una sola fila por unidad aunque traiga dos posiciones vivas, y gana el fix más reciente", async () => {
      const r = await repos.circuits.planDelCircuitoParaCuenta(cuentas.A, circuito.K1);
      const filas = r.unidades.filter((u) => u.unitId === unidad.uD);
      expect(filas, "dos filas de la misma unidad envenenan el conteo del plan").toHaveLength(1);
      expect(filas[0]!.recordedAt?.getTime()).toBe(FIX_NUEVO.getTime());
    });

    it("cualquier otra cuenta no recibe plan, y no distingue el circuito ajeno del inexistente", async () => {
      for (const cuenta of ["F", "G", "K", "J", "C2"] as const) {
        expect(await plan(cuenta, "K1"), `cuenta ${cuenta}`).toEqual({ alcance: "ninguno", unidades: [] });
      }
      // A y B corren K1, pero en K2 no tienen nada que cuadre: ahí tampoco existen.
      expect(await plan("A", "K2")).toEqual({ alcance: "ninguno", unidades: [] });
      expect(await plan("B", "K2")).toEqual({ alcance: "ninguno", unidades: [] });
      // Y un uuid que nunca existió responde exactamente igual.
      expect(
        await repos.circuits.planDelCircuitoParaCuenta(cuentas.A, "00000000-0000-4000-8000-000000000000"),
      ).toEqual({ alcance: "ninguno", unidades: [] });
    });
  });
});

