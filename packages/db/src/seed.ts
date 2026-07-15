import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { createDb } from "./index.js";
import { createRepositories } from "./repositories/index.js";
import type { ContractPolicy } from "@jtel/domain";

for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {
      /* ignore */
    }
  }
}

const TECMA_CAMPUS_POLYGON = [
  { lat: 31.6980, lng: -106.4320 },
  { lat: 31.6995, lng: -106.4320 },
  { lat: 31.6995, lng: -106.4295 },
  { lat: 31.6980, lng: -106.4295 },
];

const TECMA_PLANT_POLYGON = [
  { lat: 31.6904, lng: -106.4244 },
  { lat: 31.6914, lng: -106.4244 },
  { lat: 31.6914, lng: -106.4224 },
  { lat: 31.6904, lng: -106.4224 },
];

const HONEYWELL_PLANT_POLYGON = [
  { lat: 31.7234, lng: -106.4889 },
  { lat: 31.7244, lng: -106.4889 },
  { lat: 31.7244, lng: -106.4869 },
  { lat: 31.7234, lng: -106.4869 },
];

const CARRIER_BASE_POLYGON = [
  { lat: 31.7350, lng: -106.4500 },
  { lat: 31.7360, lng: -106.4500 },
  { lat: 31.7360, lng: -106.4480 },
  { lat: 31.7350, lng: -106.4480 },
];

const TECMA_POLICY: ContractPolicy = {
  toleranceMinutes: 5,
  arrivalAnticipationMinutes: 15,
  verificationGraceMinutes: 15,
  routeStrictness: "destino_only",
  kmlMatchMinPct: 60,
  kmlCorridorMeters: 120,
  kmlCorridorMinPct: 60,
  allowAlternateDestination: false,
  excusableReasons: [
    "lluvia_nieve",
    "marchas",
    "obstruccion",
    "falla_mecanica",
    "ponchadura",
    "obra_sin_aviso",
  ],
  enforcementRules: [{ type: "no_pago_viaje", toleranceMinutes: 5 }],
  evidenceMarginMinutesBefore: 60,
  evidenceMarginMinutesAfter: 30,
  maxRouteDurationMinutes: 60,
  evidenceMinCoveragePct: 80,
  evidenceMaxGapMinutes: 10,
  monitorPreAlertMinutes: 20,
};

const HONEYWELL_POLICY: ContractPolicy = {
  toleranceMinutes: 10,
  arrivalAnticipationMinutes: 10,
  verificationGraceMinutes: 20,
  routeStrictness: "destino_only",
  kmlMatchMinPct: 60,
  kmlCorridorMeters: 120,
  kmlCorridorMinPct: 60,
  allowAlternateDestination: false,
  excusableReasons: [
    "lluvia_nieve",
    "marchas",
    "obstruccion",
    "falla_mecanica",
    "ponchadura",
    "obra_sin_aviso",
  ],
  enforcementRules: [
    {
      type: "rebate_escalonado",
      toleranceMinutes: 10,
      baseRebatePercent: 2,
      baseFailureCount: 2,
      additionalRebatePercent: 1,
    },
  ],
  evidenceMarginMinutesBefore: 90,
  evidenceMarginMinutesAfter: 45,
  maxRouteDurationMinutes: 60,
  evidenceMinCoveragePct: 80,
  evidenceMaxGapMinutes: 10,
  monitorPreAlertMinutes: 20,
};

async function seed() {
  const db = createDb(
    process.env.DATABASE_URL ?? "postgresql://jtel:jtel_dev@localhost:5432/jtel",
  );
  const repos = createRepositories(db);

  console.log("Limpiando datos previos...");
  await db.execute(sql`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename NOT LIKE '\_\_drizzle%'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);

  console.log("Sembrando datos de demo...");

  const jstaff = await repos.accounts.create({
    type: "jstaff",
    name: "J-Staff",
    slug: "jstaff",
  });

  const juarezBus = await repos.accounts.create({
    type: "carrier",
    name: "Juárez Bus",
    slug: "juarez-bus",
  });
  await repos.carriers.createProfile(juarezBus.id, "Juárez Bus S.A. de C.V.", "demo_user");

  const tecma = await repos.accounts.create({
    type: "client",
    name: "Tecma",
    slug: "tecma",
  });
  await repos.clients.createProfile(tecma.id, "Tecma S.A. de C.V.");

  const honeywell = await repos.accounts.create({
    type: "client",
    name: "Honeywell",
    slug: "honeywell",
  });
  await repos.clients.createProfile(honeywell.id, "Honeywell International");

  const tecmaPlant47 = await repos.clients.createPlant({
    clientAccountId: tecma.id,
    name: "Tecma Planta 47",
    code: "47",
  });

  const campusSantosDumont = await repos.clients.createPlantGroup(
    tecma.id,
    "Campus Santos Dumont",
  );

  const tecmaPlant20 = await repos.clients.createPlant({
    clientAccountId: tecma.id,
    name: "Tecma Planta 20",
    code: "20",
    plantGroupId: campusSantosDumont.id,
  });
  const tecmaPlant24 = await repos.clients.createPlant({
    clientAccountId: tecma.id,
    name: "Tecma Planta 24",
    code: "24",
    plantGroupId: campusSantosDumont.id,
  });
  const tecmaPlant3 = await repos.clients.createPlant({
    clientAccountId: tecma.id,
    name: "Tecma Planta 3",
    code: "3",
    plantGroupId: campusSantosDumont.id,
  });

  const honeywellPlant = await repos.clients.createPlant({
    clientAccountId: honeywell.id,
    name: "Honeywell MX07",
    code: "MX07",
  });

  const tecmaGeofence = await repos.geofences.create({
    ownerType: "plant",
    ownerPlantId: tecmaPlant47.id,
    role: "destino",
    name: "Tecma 47 Destino",
    polygon: TECMA_PLANT_POLYGON,
  });

  const campusGeofence = await repos.geofences.create({
    ownerType: "plant_group",
    ownerPlantGroupId: campusSantosDumont.id,
    role: "destino",
    name: "Campus Santos Dumont — Entrada",
    polygon: TECMA_CAMPUS_POLYGON,
  });

  const honeywellGeofence = await repos.geofences.create({
    ownerType: "plant",
    ownerPlantId: honeywellPlant.id,
    role: "destino",
    name: "Honeywell MX07 Destino",
    polygon: HONEYWELL_PLANT_POLYGON,
  });

  await repos.geofences.create({
    ownerType: "carrier",
    ownerCarrierAccountId: juarezBus.id,
    role: "base",
    name: "Base Juárez Bus",
    polygon: CARRIER_BASE_POLYGON,
  });

  const unit1 = await repos.fleet.createUnit(juarezBus.id, "Unidad 101", "ABC-101");
  const unit2 = await repos.fleet.createUnit(juarezBus.id, "Unidad 102", "ABC-102");
  const unit3 = await repos.fleet.createUnit(juarezBus.id, "Unidad 103", "ABC-103");

  const device1 = await repos.fleet.createDevice(juarezBus.id, "0860425040091256", "GPS-101");
  const device2 = await repos.fleet.createDevice(juarezBus.id, "0860425040091257", "GPS-102");
  const device3 = await repos.fleet.createDevice(juarezBus.id, "0860425040091258", "GPS-103");

  const assignStart = new Date("2020-01-01");
  await repos.fleet.assignDevice(unit1.id, device1.id, assignStart);
  await repos.fleet.assignDevice(unit2.id, device2.id, assignStart);
  await repos.fleet.assignDevice(unit3.id, device3.id, assignStart);

  await repos.commercial.authorize({
    clientAccountId: tecma.id,
    carrierAccountId: juarezBus.id,
    notes: "Demo — transporte personal Juárez",
  });
  await repos.commercial.authorize({
    clientAccountId: honeywell.id,
    carrierAccountId: juarezBus.id,
    notes: "Demo — transporte personal Juárez",
  });

  const tecmaRoute = await repos.routes.createRoute({
    clientAccountId: tecma.id,
    plantId: tecmaPlant47.id,
    name: "Ruta Norte",
  });
  await repos.routes.addKmlVersion({
    routeId: tecmaRoute.id,
    kmlContent: "<kml><Document><name>Ruta Norte</name></Document></kml>",
    waypoints: [
      { lat: 31.7200, lng: -106.4600 },
      { lat: 31.7100, lng: -106.4400 },
      { lat: 31.6909, lng: -106.4234 },
    ],
  });
  const tecmaShift = await repos.routes.createShift({
    clientAccountId: tecma.id,
    plantId: tecmaPlant47.id,
    name: "Entrada 7:00",
    startTime: "07:00:00",
  });
  const tecmaRouteShift = await repos.routes.createRouteShift({
    clientAccountId: tecma.id,
    plantId: tecmaPlant47.id,
    routeId: tecmaRoute.id,
    shiftId: tecmaShift.id,
  });

  const campusRoute = await repos.routes.createRoute({
    clientAccountId: tecma.id,
    plantGroupId: campusSantosDumont.id,
    name: "Ruta Campus Poniente",
  });
  await repos.routes.addKmlVersion({
    routeId: campusRoute.id,
    kmlContent: "<kml><Document><name>Ruta Campus Poniente</name></Document></kml>",
    waypoints: [
      { lat: 31.7050, lng: -106.4450 },
      { lat: 31.7000, lng: -106.4350 },
      { lat: 31.6985, lng: -106.4305 },
    ],
  });
  const campusShift = await repos.routes.createShift({
    clientAccountId: tecma.id,
    plantGroupId: campusSantosDumont.id,
    name: "Entrada 6:45",
    startTime: "06:45:00",
  });
  const campusRouteShift = await repos.routes.createRouteShift({
    clientAccountId: tecma.id,
    plantGroupId: campusSantosDumont.id,
    routeId: campusRoute.id,
    shiftId: campusShift.id,
  });

  const honeywellRoute = await repos.routes.createRoute({
    clientAccountId: honeywell.id,
    plantId: honeywellPlant.id,
    name: "Ruta Poniente",
  });
  await repos.routes.addKmlVersion({
    routeId: honeywellRoute.id,
    kmlContent: "<kml><Document><name>Ruta Poniente</name></Document></kml>",
    waypoints: [
      { lat: 31.7300, lng: -106.5000 },
      { lat: 31.7250, lng: -106.4900 },
      { lat: 31.7239, lng: -106.4879 },
    ],
  });
  const honeywellShift = await repos.routes.createShift({
    clientAccountId: honeywell.id,
    plantId: honeywellPlant.id,
    name: "Entrada 6:30",
    startTime: "06:30:00",
  });
  const honeywellRouteShift = await repos.routes.createRouteShift({
    clientAccountId: honeywell.id,
    plantId: honeywellPlant.id,
    routeId: honeywellRoute.id,
    shiftId: honeywellShift.id,
  });

  const today = new Date();
  const todayIso = today.toISOString().split("T")[0]!;
  const yearAhead = new Date(today);
  yearAhead.setFullYear(yearAhead.getFullYear() + 1);
  const yearAheadIso = yearAhead.toISOString().split("T")[0]!;

  const tecmaContract = await repos.contracts.create({
    carrierAccountId: juarezBus.id,
    clientAccountId: tecma.id,
    plantId: tecmaPlant47.id,
    name: "Tecma 47 - Transporte Personal",
    validFrom: todayIso,
    validTo: yearAheadIso,
    policy: TECMA_POLICY,
    status: "active",
  });

  const campusContract = await repos.contracts.create({
    carrierAccountId: juarezBus.id,
    clientAccountId: tecma.id,
    plantGroupId: campusSantosDumont.id,
    name: "Campus Santos Dumont - Transporte Personal",
    validFrom: todayIso,
    validTo: yearAheadIso,
    policy: TECMA_POLICY,
    status: "active",
  });

  const honeywellContract = await repos.contracts.create({
    carrierAccountId: juarezBus.id,
    clientAccountId: honeywell.id,
    plantId: honeywellPlant.id,
    name: "Honeywell MX07 - Transporte Personal",
    validFrom: todayIso,
    validTo: yearAheadIso,
    policy: HONEYWELL_POLICY,
    status: "active",
  });

  const tecmaProfile = await repos.profiles.create({
    contractId: tecmaContract.id,
    routeShiftId: tecmaRouteShift.id,
    geofenceId: tecmaGeofence.id,
    name: "Ruta Norte - Entrada 7:00",
    code: "TEC-NORTE-7",
    possibleUnitIds: [unit1.id, unit2.id],
    referenceUnitId: unit1.id,
    activeDays: [1, 2, 3, 4, 5],
  });

  const campusProfile = await repos.profiles.create({
    contractId: campusContract.id,
    routeShiftId: campusRouteShift.id,
    geofenceId: campusGeofence.id,
    name: "Campus Poniente - Entrada 6:45",
    code: "CSD-PON-645",
    possibleUnitIds: [unit2.id, unit3.id],
    referenceUnitId: unit2.id,
    activeDays: [1, 2, 3, 4, 5],
  });

  const honeywellProfile = await repos.profiles.create({
    contractId: honeywellContract.id,
    routeShiftId: honeywellRouteShift.id,
    geofenceId: honeywellGeofence.id,
    name: "Ruta Poniente - Entrada 6:30",
    code: "HW-PON-630",
    possibleUnitIds: [unit2.id, unit3.id],
    referenceUnitId: unit2.id,
    activeDays: [1, 2, 3, 4, 5, 6],
  });

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);

  await repos.occurrences.generateForProfile(tecmaProfile.id, weekAgo, weekAhead);
  await repos.occurrences.generateForProfile(campusProfile.id, weekAgo, weekAhead);
  await repos.occurrences.generateForProfile(honeywellProfile.id, weekAgo, weekAhead);

  await repos.memberships.create({
    accountId: jstaff.id,
    clerkUserId: "jstaff_admin",
    role: "admin_plataforma",
    scopeType: "global",
  });

  await repos.memberships.create({
    accountId: tecma.id,
    clerkUserId: "tecma_admin",
    role: "admin_corporativo",
    scopeType: "account",
    scopeId: tecma.id,
  });

  await repos.memberships.create({
    accountId: tecma.id,
    clerkUserId: "tecma_planta47",
    role: "usuario_planta",
    scopeType: "plant",
    scopeId: tecmaPlant47.id,
  });

  await repos.memberships.create({
    accountId: juarezBus.id,
    clerkUserId: "jb_admin",
    role: "admin",
    scopeType: "account",
    scopeId: juarezBus.id,
  });

  await repos.demos.createTemplate("Demo Maquiladora", {
    carrier: "juarez-bus",
    client: "tecma",
    plant: "47",
    policy: TECMA_POLICY,
  });

  await repos.fleet.addFuelRecord({
    unitId: unit1.id,
    carrierAccountId: juarezBus.id,
    liters: 120,
    cost: 2400,
    odometerKm: 45000,
    recordedAt: new Date(),
  });

  await repos.fleet.addMaintenanceRecord({
    unitId: unit1.id,
    carrierAccountId: juarezBus.id,
    description: "Cambio de aceite",
    scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  console.log("Seed completado:");
  console.log(`  J-Staff: ${jstaff.id}`);
  console.log(`  Juárez Bus: ${juarezBus.id}`);
  console.log(`  Tecma: ${tecma.id} (Planta 47: ${tecmaPlant47.id}, Campus: ${campusSantosDumont.id})`);
  console.log(`  Honeywell: ${honeywell.id} (MX07: ${honeywellPlant.id})`);
  console.log(`  Contratos: Tecma 47=${tecmaContract.id}, Campus=${campusContract.id}, Honeywell=${honeywellContract.id}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
