import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { eq, inArray } from "drizzle-orm";
import { addDaysIso, localDateIso } from "@jtel/domain";
import { conexionesDelAmbiente, revisarDesechable } from "./candado-desechable.js";
import { createDb } from "./index.js";
import {
  accounts,
  deviceAssignments,
  devices,
  documentTypeRules,
  documentTypes,
  driverCredentials,
  drivers,
  documentVersions,
  documents,
  livePositions,
  markets,
  units,
} from "./schema/index.js";

/**
 * El escenario del cuarto de Expedientes: un papel en cada estado, para mirarlo.
 *
 *   pnpm --filter @jtel/db escenario-expedientes               # siembra, con reglas
 *   pnpm --filter @jtel/db escenario-expedientes --sin-reglas  # el catálogo sin reglas
 *   pnpm --filter @jtel/db escenario-expedientes --flota       # y la flota del archivero
 *   pnpm --filter @jtel/db escenario-expedientes --choferes    # y los choferes (Choferes V1)
 *   pnpm --filter @jtel/db escenario-expedientes --limpiar     # borra
 *
 * Luego se abre `/casa/transportista/expedientes?account=escenario-expedientes`.
 *
 * ## Por qué su propio mercado
 *
 * Las reglas son del catálogo de un mercado, y el de Chihuahua de la desechable
 * lo usan las pruebas de integración. Sembrarle reglas cambiaría lo que esas
 * pruebas leen. Así que el escenario trae su mercado de prueba —«Escenario»,
 * `MX · ESC`— con sus tipos y sus reglas, y se lleva todo al limpiar.
 *
 * Las fechas se siembran **relativas a hoy en Ciudad Juárez**: los días que
 * faltan valen para el día en que se sembró. Se re-siembra antes de mirar.
 *
 * Vive sólo en la rama desechable (candado de abajo), lo mira quien lo sembró y
 * se borra con `--limpiar`: no le produce a nadie una afirmación que el sistema
 * no midió (Marco §F).
 *
 * ## Lo que siembra
 *
 *   UNIDADES
 *   10254  póliza vencida hace 3 d (corregida una vez, y una foja anterior del año
 *          pasado) · verificación por vencer en 12 d, calculada · permiso FALTA ·
 *          tarjeta vigente · el seguro opcional sin capturar · en línea
 *   10288  verificación capturada SIN FECHA · lo demás vigente · sin señal
 *   10261  verificación por vencer en 6 d · lo demás vigente · desconectada
 *   10118  todo vigente · sin dispositivo
 *   10099  inactiva, sin papeles
 *
 *   DISPOSITIVOS
 *   TK-EXP-001  en 10254, hace 14 s   · TK-EXP-002  en 10288, hace 3.8 h
 *   TK-EXP-003  en 10261, hace 3 d    · TK-EXP-004  en bodega, nunca reportó
 *   TK-EXP-005  de baja
 *
 *   CON --flota (el archivero, ficha V2 §8: «con las 84 unidades sembradas»)
 *   79 unidades más, 10300 a 10378, hasta sumar 84 con sus cuatro papeles
 *   vigentes. Las que terminan en 5 traen además el «Seguro de equipaje
 *   (escenario)», un tipo optativo que vence y **no tiene días de aviso**: su
 *   papel no se puede declarar vigente ni por vencer, y la unidad queda «sin
 *   juzgar» junto a las que están al día. Es lo único que deja ver las tres
 *   secciones del cajón en una misma cuenta.
 *   TK-EXP-006  en bodega, reportó hace 9 d (espera camión: no pide nada)
 *   TK-EXP-007  en 10300, hace 40 s
 *   La 10254 lleva VIN, para buscarla por él.
 *
 *   CON --choferes (Choferes V1, ficha §6)
 *   El mercado gana sus papeles de chofer: «Licencia» (vence, aviso de 30 d),
 *   «Examen médico» y «Antidoping» (obligatorios: esperan al abogado y no
 *   deben contar).
 *   Ana Ruiz     licencia vigente                  → al día
 *   Beto Luna    licencia vencida hace 4 d          → pide algo
 *   Carlos Paz   licencia por vencer en 10 d        → pide algo
 *   Dora Vela    licencia capturada sin fecha       → pide algo (falta la fecha)
 *   Y una segunda cuenta, `escenario-expedientes-sin-catalogo`, SIN mercado,
 *   con Eva Soto: sin catálogo no hay contra qué juzgar sus papeles.
 */

function archivosDeAmbiente(): string[] {
  const base = ["../../.env", ".env"];
  try {
    const comun = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    base.push(join(dirname(comun), ".env"));
  } catch {
    /* fuera de un repo, los dos de arriba tienen que bastar */
  }
  return base;
}

for (const p of archivosDeAmbiente()) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      if (process.env.DATABASE_URL_TEST) break;
    } catch {
      /* ignore */
    }
  }
}

/** Ids fijos: es lo que hace la siembra repetible en vez de acumulativa. */
const SLUG = "escenario-expedientes";
const id = (n: number) => `e5000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CARRIER = id(1);
const MERCADO = id(2);
/** La cuenta sin mercado de `--choferes`: el chofer «sin catálogo cargado». */
const SIN_CATALOGO = id(3);
const imei = (n: number) => `FIXTURE-EXP-${String(n).padStart(3, "0")}`;
const ACTOR = { actorKind: "escenario", actorId: SLUG };

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

async function limpiar(db: ReturnType<typeof createDb>) {
  const imeis = Array.from({ length: 7 }, (_, i) => imei(i + 1));
  await db.delete(livePositions).where(inArray(livePositions.imei, imeis));
  // Fojas, versiones, unidades, dispositivos y asignaciones caen con la cuenta.
  await db.delete(accounts).where(inArray(accounts.id, [CARRIER, SIN_CATALOGO]));
  // El catálogo de prueba no cuelga de ninguna cuenta: reglas, tipos y mercado, en ese orden.
  const tipos = await db.select({ id: documentTypes.id }).from(documentTypes).where(eq(documentTypes.marketId, MERCADO));
  if (tipos.length) await db.delete(documentTypeRules).where(inArray(documentTypeRules.documentTypeId, tipos.map((t) => t.id)));
  await db.delete(documentTypes).where(eq(documentTypes.marketId, MERCADO));
  await db.delete(markets).where(eq(markets.id, MERCADO));
  console.log(`[${SLUG}] borrado.`);
}

async function sembrar(db: ReturnType<typeof createDb>, conReglas: boolean, conFlota: boolean, conChoferes: boolean) {
  await limpiar(db);
  const ahora = Date.now();
  const hace = (ms: number) => new Date(ahora - ms);
  const hoy = localDateIso(new Date(ahora), "America/Ciudad_Juarez");
  const dia = (n: number) => addDaysIso(hoy, n);

  await db.insert(markets).values({
    id: MERCADO,
    countryCode: "MX",
    stateCode: "ESC",
    municipality: null,
    name: "Escenario",
    timeZone: "America/Ciudad_Juarez",
  });
  await db.insert(accounts).values({ id: CARRIER, type: "carrier", name: "Escenario expedientes", slug: SLUG, marketId: MERCADO });

  const T = { poliza: id(11), tarjeta: id(12), permiso: id(13), verificacion: id(14), seguro: id(15) };
  await db.insert(documentTypes).values([
    { id: T.poliza, marketId: MERCADO, subject: "unidad", clave: "poliza_de_seguro", name: "Póliza de seguro" },
    { id: T.tarjeta, marketId: MERCADO, subject: "unidad", clave: "tarjeta_de_circulacion", name: "Tarjeta de circulación" },
    { id: T.permiso, marketId: MERCADO, subject: "unidad", clave: "permiso_transporte_personal", name: "Permiso de transporte de personal" },
    { id: T.verificacion, marketId: MERCADO, subject: "unidad", clave: "verificacion_vehicular", name: "Verificación vehicular" },
    { id: T.seguro, marketId: MERCADO, subject: "unidad", clave: "seguro_de_pasajeros", name: "Seguro de pasajeros (escenario)" },
  ]);
  if (conReglas) {
    await db.insert(documentTypeRules).values([
      { documentTypeId: T.poliza, required: true, expires: true, warningDays: 30, ...ACTOR },
      { documentTypeId: T.tarjeta, required: true, expires: true, warningDays: 30, ...ACTOR },
      { documentTypeId: T.permiso, required: true, expires: true, warningDays: 60, ...ACTOR },
      { documentTypeId: T.verificacion, required: true, expires: true, warningDays: 15, periodicityMonths: 6, ...ACTOR },
      { documentTypeId: T.seguro, required: false, expires: true, warningDays: 30, ...ACTOR },
    ]);
  }

  await db.insert(units).values([
    { id: id(101), carrierAccountId: CARRIER, label: "10254", plateNumber: "ETD-41-92" },
    { id: id(102), carrierAccountId: CARRIER, label: "10288", plateNumber: "ETD-40-55" },
    { id: id(103), carrierAccountId: CARRIER, label: "10261", plateNumber: "ETD-41-97" },
    { id: id(104), carrierAccountId: CARRIER, label: "10118", plateNumber: "ETD-40-12" },
    { id: id(105), carrierAccountId: CARRIER, label: "10099", plateNumber: null, active: false },
  ]);

  let n = 300;
  /** Una foja con sus versiones: la última del arreglo es la vigente. */
  const foja = async (
    unidad: number,
    tipo: string,
    versiones: Array<{ folio: string | null; emitido: string | null; vence: string | null; calculado?: boolean; nota?: string; hace: number }>,
  ) => {
    const docId = id(++n);
    await db.insert(documents).values({ id: docId, carrierAccountId: CARRIER, documentTypeId: tipo, unitId: id(unidad), ...ACTOR, createdAt: hace(versiones[0]!.hace) });
    for (const v of versiones) {
      await db.insert(documentVersions).values({
        documentId: docId,
        folio: v.folio,
        issuedOn: v.emitido,
        expiresOn: v.vence,
        expiryCalculated: v.calculado ?? false,
        note: v.nota ?? null,
        ...ACTOR,
        createdAt: hace(v.hace),
      });
    }
  };

  // 10254 — un papel en cada estado.
  await foja(101, T.poliza, [{ folio: "GNP-71120", emitido: dia(-733), vence: dia(-368), hace: 735 * DIA }]);
  await foja(101, T.poliza, [
    { folio: "GNP-882131", emitido: dia(-368), vence: dia(-3), hace: 15 * DIA },
    { folio: "GNP-88213", emitido: dia(-368), vence: dia(-3), nota: "el folio venía con un dígito de más", hace: 4 * DIA },
  ]);
  await foja(101, T.verificacion, [{ folio: "V-2026-2", emitido: addDaysIso(dia(12), -182), vence: dia(12), calculado: true, hace: 20 * DIA }]);
  await foja(101, T.tarjeta, [{ folio: "CHH-4471", emitido: dia(-151), vence: dia(214), hace: 60 * DIA }]);

  // 10288 — la verificación se capturó sin fecha.
  await foja(102, T.verificacion, [{ folio: "V-2026-9", emitido: null, vence: null, hace: 2 * DIA }]);
  await foja(102, T.poliza, [{ folio: "GNP-90021", emitido: dia(-245), vence: dia(120), hace: 30 * DIA }]);
  await foja(102, T.permiso, [{ folio: "SCT-11", emitido: dia(-165), vence: dia(200), hace: 30 * DIA }]);
  await foja(102, T.tarjeta, [{ folio: "CHH-5510", emitido: dia(-275), vence: dia(90), hace: 30 * DIA }]);

  // 10261 — la verificación por vencer.
  await foja(103, T.verificacion, [{ folio: "V-2026-4", emitido: dia(-176), vence: dia(6), hace: 40 * DIA }]);
  await foja(103, T.poliza, [{ folio: "GNP-90550", emitido: dia(-205), vence: dia(160), hace: 40 * DIA }]);
  await foja(103, T.permiso, [{ folio: "SCT-12", emitido: dia(-65), vence: dia(300), hace: 40 * DIA }]);
  await foja(103, T.tarjeta, [{ folio: "CHH-5611", emitido: dia(-320), vence: dia(45), hace: 40 * DIA }]);

  // 10118 — al día.
  await foja(104, T.verificacion, [{ folio: "V-2026-7", emitido: dia(-102), vence: dia(80), hace: 50 * DIA }]);
  await foja(104, T.poliza, [{ folio: "GNP-91000", emitido: dia(-215), vence: dia(150), hace: 50 * DIA }]);
  await foja(104, T.permiso, [{ folio: "SCT-13", emitido: dia(-55), vence: dia(310), hace: 50 * DIA }]);
  await foja(104, T.tarjeta, [{ folio: "CHH-5720", emitido: dia(-270), vence: dia(95), hace: 50 * DIA }]);
  await foja(104, T.seguro, [{ folio: "SP-3", emitido: dia(-100), vence: dia(265), hace: 50 * DIA }]);

  await db.insert(devices).values([
    { id: id(201), carrierAccountId: CARRIER, imei: imei(1), label: "TK-EXP-001" },
    { id: id(202), carrierAccountId: CARRIER, imei: imei(2), label: "TK-EXP-002" },
    { id: id(203), carrierAccountId: CARRIER, imei: imei(3), label: "TK-EXP-003" },
    { id: id(204), carrierAccountId: CARRIER, imei: imei(4), label: "TK-EXP-004" },
    { id: id(205), carrierAccountId: CARRIER, imei: imei(5), label: "TK-EXP-005", retiredAt: hace(10 * DIA), retiredReason: "Escenario: fin de servicio" },
  ]);
  await db.insert(deviceAssignments).values([
    { unitId: id(101), deviceId: id(201), validFrom: hace(30 * DIA) },
    { unitId: id(102), deviceId: id(202), validFrom: hace(30 * DIA) },
    { unitId: id(103), deviceId: id(203), validFrom: hace(30 * DIA) },
    { unitId: id(104), deviceId: id(205), validFrom: hace(90 * DIA), validTo: hace(10 * DIA) },
  ]);
  const viva = (k: number, recordedAt: Date, speed: number, heading: number) => ({
    imei: imei(k), carrierAccountId: CARRIER, deviceId: id(200 + k), latitude: 31.7, longitude: -106.45, speed, heading, recordedAt, collectedAt: recordedAt,
  });
  await db.insert(livePositions).values([viva(1, hace(14_000), 42.7, 135), viva(2, hace(3.8 * HORA), 0, 0), viva(3, hace(3 * DIA), 0, 0)]);

  if (conFlota) {
    const EQUIPAJE = id(16);
    await db.insert(documentTypes).values({ id: EQUIPAJE, marketId: MERCADO, subject: "unidad", clave: "seguro_de_equipaje", name: "Seguro de equipaje (escenario)" });
    if (conReglas) {
      // Optativo y vence, pero sin días de aviso: lo capturado queda sin juzgar.
      await db.insert(documentTypeRules).values({ documentTypeId: EQUIPAJE, required: false, expires: true, warningDays: null, ...ACTOR });
    }
    await db.update(units).set({ vin: "3HGCM82633A004352" }).where(eq(units.id, id(101)));

    const extra = Array.from({ length: 79 }, (_, i) => ({
      id: id(1000 + i),
      carrierAccountId: CARRIER,
      label: String(10300 + i),
      plateNumber: i % 9 === 4 ? null : `ETD-${50 + Math.floor(i / 10)}-${String(10 + i).padStart(2, "0")}`,
    }));
    await db.insert(units).values(extra);

    // Las fojas de golpe: 79 unidades × 4 papeles son cientos de filas.
    const docs: Array<typeof documents.$inferInsert> = [];
    const vers: Array<typeof documentVersions.$inferInsert> = [];
    let k = 5000;
    const papel = (unidadId: string, tipo: string, folio: string, vence: number) => {
      const docId = id(++k);
      docs.push({ id: docId, carrierAccountId: CARRIER, documentTypeId: tipo, unitId: unidadId, ...ACTOR, createdAt: hace(40 * DIA) });
      vers.push({ documentId: docId, folio, issuedOn: dia(vence - 365), expiresOn: dia(vence), expiryCalculated: false, note: null, ...ACTOR, createdAt: hace(40 * DIA) });
    };
    extra.forEach((u, i) => {
      papel(u.id, T.poliza, `GNP-7${i}`, 100 + (i % 200));
      papel(u.id, T.tarjeta, `CHH-7${i}`, 90 + (i % 150));
      papel(u.id, T.permiso, `SCT-7${i}`, 120 + (i % 180));
      papel(u.id, T.verificacion, `V-7${i}`, 40 + (i % 120));
      if (u.label.endsWith("5")) papel(u.id, EQUIPAJE, `EQ-7${i}`, 200);
    });
    await db.insert(documents).values(docs);
    await db.insert(documentVersions).values(vers);

    await db.insert(devices).values([
      { id: id(206), carrierAccountId: CARRIER, imei: imei(6), label: "TK-EXP-006" },
      { id: id(207), carrierAccountId: CARRIER, imei: imei(7), label: "TK-EXP-007" },
    ]);
    await db.insert(deviceAssignments).values({ unitId: id(1000), deviceId: id(207), validFrom: hace(20 * DIA) });
    await db.insert(livePositions).values([viva(6, hace(9 * DIA), 0, 0), viva(7, hace(40_000), 31.2, 90)]);
  }

  if (conChoferes) {
    const C = { licencia: id(21), examen: id(22), antidoping: id(23) };
    await db.insert(documentTypes).values([
      { id: C.licencia, marketId: MERCADO, subject: "chofer", clave: "licencia", name: "Licencia" },
      { id: C.examen, marketId: MERCADO, subject: "chofer", clave: "examen_medico", name: "Examen médico" },
      { id: C.antidoping, marketId: MERCADO, subject: "chofer", clave: "antidoping", name: "Antidoping" },
    ]);
    if (conReglas) {
      await db.insert(documentTypeRules).values([
        { documentTypeId: C.licencia, required: true, expires: true, warningDays: 30, ...ACTOR },
        { documentTypeId: C.examen, required: true, expires: true, warningDays: 30, ...ACTOR },
        { documentTypeId: C.antidoping, required: true, expires: true, warningDays: 30, ...ACTOR },
      ]);
    }
    const chofer = async (n: number, cuenta: string, nombre: string, licencia: string, vence: string | null | undefined) => {
      await db.insert(drivers).values({ id: id(400 + n), carrierAccountId: cuenta });
      await db.insert(driverCredentials).values({ driverId: id(400 + n), carrierAccountId: cuenta, fullName: nombre, licenseNumber: licencia });
      if (vence === undefined) return;
      const docId = id(450 + n);
      await db.insert(documents).values({ id: docId, carrierAccountId: cuenta, documentTypeId: C.licencia, driverId: id(400 + n), ...ACTOR, createdAt: hace(60 * DIA) });
      await db.insert(documentVersions).values({ documentId: docId, folio: licencia, issuedOn: null, expiresOn: vence, expiryCalculated: false, note: null, ...ACTOR, createdAt: hace(60 * DIA) });
    };
    await chofer(1, CARRIER, "Ana Ruiz", "CHIH-100 01", dia(200));
    await chofer(2, CARRIER, "Beto Luna", "CHIH-100 02", dia(-4));
    await chofer(3, CARRIER, "Carlos Paz", "CHIH-100 03", dia(10));
    await chofer(4, CARRIER, "Dora Vela", "CHIH-100 04", null);

    await db.insert(accounts).values({ id: SIN_CATALOGO, type: "carrier", name: "Escenario sin catálogo", slug: `${SLUG}-sin-catalogo` });
    await chofer(5, SIN_CATALOGO, "Eva Soto", "CHIH-100 05", undefined);
  }

  console.log(`[${SLUG}] sembrado ${conReglas ? "con" : "SIN"} reglas${conFlota ? ", con la flota del archivero (84)" : ""}${conChoferes ? ", con choferes" : ""}; hoy en Juárez: ${hoy}.`);
  console.log(`[${SLUG}] abrir:        /casa/transportista/expedientes?account=${SLUG}`);
  console.log(`[${SLUG}] al terminar:  pnpm --filter @jtel/db escenario-expedientes --limpiar`);
}

const args = process.argv.slice(2);
const iBase = args.indexOf("--base");

const veredicto = revisarDesechable({
  objetivo: process.env.DATABASE_URL_TEST,
  otras: conexionesDelAmbiente(process.env),
  confirmacion: iBase >= 0 ? args[iBase + 1] : undefined,
});

if (!veredicto.ok) {
  console.error(`\n  ✗ [${SLUG}] ${veredicto.motivo}\n`);
  process.exit(1);
}

console.log(
  `[${SLUG}] destino: ${veredicto.identidad.host}/${veredicto.identidad.base}` +
    ` · distinta de: ${veredicto.comparadaCon.join(", ") || "(nada que comparar)"}`,
);

const db = createDb(process.env.DATABASE_URL_TEST!);

if (args.includes("--limpiar")) await limpiar(db);
else await sembrar(db, !args.includes("--sin-reglas"), args.includes("--flota"), args.includes("--choferes"));

process.exit(0);
