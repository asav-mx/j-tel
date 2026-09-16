import { describe, expect, it } from "vitest";
import {
  cargarExpedienteDeChofer,
  cargarExpedienteDeDispositivo,
  cargarExpedienteDeUnidad,
} from "./expediente.js";

// 16 sep 2026, 05:30 UTC = 15 sep, 23:30 en Ciudad Juárez. El «hoy» del
// vencimiento es el del mercado: un papel que vence el 15 todavía es vigente.
const AHORA = new Date("2026-09-16T05:30:00Z");
const MIN = 60_000;

const JUAREZ = {
  id: "m1",
  name: "Ciudad Juárez, Chihuahua",
  countryCode: "MX",
  stateCode: "CHH",
  municipality: "Juárez",
  timeZone: "America/Ciudad_Juarez",
};

const tipo = (id: string, clave: string, name: string, subject: "unidad" | "chofer" = "unidad") => ({
  id,
  marketId: "m1",
  subject,
  clave,
  name,
  createdAt: new Date("2026-09-16T00:00:00Z"),
});

const version = (documentId: string, expiresOn: string | null, creada: string) => ({
  id: `v-${documentId}-${creada}`,
  documentId,
  folio: "88213",
  issuedOn: null,
  expiresOn,
  expiryCalculated: false,
  actorKind: "carrier",
  actorId: "user_1",
  note: null,
  createdAt: new Date(creada),
});

interface Opciones {
  mercado?: typeof JUAREZ | null;
  conContrato?: boolean;
  catalogo?: Array<{ tipo: ReturnType<typeof tipo>; regla: unknown }>;
  fojas?: unknown[];
  asignacionesDeChofer?: unknown[];
}

function repos(o: Opciones = {}) {
  const pedidosDeServicios: string[] = [];
  const r = {
    expedientes: {
      unidadDeCuenta: async (cuenta: string, id: string) =>
        cuenta === "c1" && id === "u1"
          ? { id: "u1", carrierAccountId: "c1", label: "10254", plateNumber: null, active: true }
          : null,
      dispositivoDeCuenta: async (cuenta: string, id: string) =>
        cuenta === "c1" && id === "d1"
          ? { id: "d1", carrierAccountId: "c1", imei: "111", label: "TK-FTC927-001", retiredAt: null, retiredReason: null }
          : null,
      choferDeCuenta: async (cuenta: string, id: string) =>
        cuenta === "c1" && id === "ch1"
          ? {
              chofer: { id: "ch1", carrierAccountId: "c1", deactivatedAt: null, credentialsPurgedAt: null },
              credenciales: { fullName: "Juan Pérez", licenseNumber: "CHH-123" },
            }
          : null,
      mercadoDeCuenta: async () => (o.mercado === undefined ? JUAREZ : o.mercado),
      catalogo: async (_m: string, subject: string) =>
        (o.catalogo ?? []).filter((c) => c.tipo.subject === subject),
      fojasDeSujeto: async () => o.fojas ?? [],
      asignacionesDeDispositivo: async () => [
        { unitId: "u1", etiqueta: "10254", desde: new Date("2026-09-01T00:00:00Z"), hasta: null },
      ],
      asignacionesDeChofer: async () => o.asignacionesDeChofer ?? [],
      tieneContratoEncendido: async () => o.conContrato ?? false,
    },
    fleet: {
      getUnitsForCarrier: async () => [{ id: "u1", label: "10254", active: true }],
      getDevicesForCarrier: async () => [
        { id: "d1", imei: "111", label: "TK-FTC927-001", retiredAt: null, retiredReason: null },
      ],
      getActiveAssignmentsForCarrier: async () => [
        { unitId: "u1", deviceId: "d1", validFrom: new Date("2026-09-01T00:00:00Z"), validTo: null },
      ],
      asignacionesDeUnidad: async () => [
        { deviceId: "d1", imei: "111", etiqueta: "TK-FTC927-001", desde: new Date("2026-09-01T00:00:00Z"), hasta: null },
      ],
    },
    livePositions: {
      listForCarrier: async () => [
        { imei: "111", recordedAt: new Date(AHORA.getTime() - 14_000), speed: 42.7, heading: 90 },
      ],
    },
    telemetry: { ultimoPuntoPorImei: async () => new Map<string, Date>() },
    occurrences: {
      ultimosServiciosDeUnidad: async (unitId: string) => {
        pedidosDeServicios.push(unitId);
        return [];
      },
    },
  };
  return { repos: r as never, pedidosDeServicios };
}

describe("el expediente de una unidad nace entero", () => {
  it("las cuatro familias, cada parte con su estado", async () => {
    const e = await cargarExpedienteDeUnidad(repos().repos, { carrierAccountId: "c1", unitId: "u1", ahora: AHORA });
    expect(e?.identidad.numeroEconomico).toEqual({ estado: "con_datos", valor: "10254" });
    expect(e?.identidad.placa).toEqual({ estado: "vacia" });
    expect(e?.actividad.ultimaSenal).toMatchObject({ estado: "con_datos", valor: { grupo: "en_linea" } });
    expect(e?.actividad.recorridos).toEqual({ estado: "aun_no_disponible", fuente: "flota_en_vivo" });
    expect(e?.relaciones.dispositivos).toMatchObject({ estado: "con_datos", valor: [{ imei: "111", vigente: true }] });
    expect(e?.relaciones.choferes).toEqual({ estado: "aun_no_disponible", fuente: "asignacion_de_choferes" });
    expect(e?.documentos).toEqual({ estado: "vacia" });
  });

  it("la unidad de otra cuenta no existe desde aquí", async () => {
    expect(await cargarExpedienteDeUnidad(repos().repos, { carrierAccountId: "c2", unitId: "u1", ahora: AHORA })).toBeNull();
  });

  it("sin contrato encendido, los servicios no aplican: el campo no viene, y ni se consulta", async () => {
    const f = repos({ conContrato: false });
    const e = await cargarExpedienteDeUnidad(f.repos, { carrierAccountId: "c1", unitId: "u1", ahora: AHORA });
    expect(e && "servicios" in e.actividad).toBe(false);
    expect(f.pedidosDeServicios).toEqual([]);
  });

  it("con contrato, los servicios aparecen; sin servicios sellados, vacíos", async () => {
    const e = await cargarExpedienteDeUnidad(repos({ conContrato: true }).repos, {
      carrierAccountId: "c1",
      unitId: "u1",
      ahora: AHORA,
    });
    expect(e?.actividad.servicios).toEqual({ estado: "vacia" });
  });

  it("una cuenta sin mercado: los documentos aún no están disponibles, y dice por qué", async () => {
    const e = await cargarExpedienteDeUnidad(repos({ mercado: null }).repos, {
      carrierAccountId: "c1",
      unitId: "u1",
      ahora: AHORA,
    });
    expect(e?.documentos).toEqual({ estado: "aun_no_disponible", fuente: "mercado_de_la_cuenta" });
  });
});

describe("los papeles de una unidad", () => {
  const catalogo = [
    { tipo: tipo("t1", "poliza_de_seguro", "Póliza de seguro"), regla: { obligatorio: true, vence: true, diasDeAviso: 30, periodicidadMeses: null } },
    { tipo: tipo("t2", "permiso_transporte_personal", "Permiso de transporte de personal"), regla: { obligatorio: true, vence: true, diasDeAviso: 60, periodicidadMeses: null } },
    { tipo: tipo("t3", "verificacion_vehicular", "Verificación vehicular"), regla: null },
    { tipo: tipo("l1", "licencia", "Licencia", "chofer"), regla: null },
  ];

  it("cada tipo del catálogo de su sujeto, con su estado juzgado en la hora del mercado", async () => {
    const fojas = [
      // La póliza se renovó: la foja vieja venció el 15 (hoy en Juárez), la nueva vence en marzo.
      { foja: { id: "f2", documentTypeId: "t1", createdAt: new Date("2026-09-10T00:00:00Z"), actorKind: "carrier", actorId: "u" }, versiones: [version("f2", "2027-03-15", "2026-09-10T00:00:00Z")] },
      { foja: { id: "f1", documentTypeId: "t1", createdAt: new Date("2025-09-10T00:00:00Z"), actorKind: "carrier", actorId: "u" }, versiones: [version("f1", "2026-09-15", "2025-09-10T00:00:00Z")] },
    ];
    const e = await cargarExpedienteDeUnidad(repos({ catalogo, fojas }).repos, {
      carrierAccountId: "c1",
      unitId: "u1",
      ahora: AHORA,
    });
    expect(e?.documentos.estado).toBe("con_datos");
    if (e?.documentos.estado !== "con_datos") return;
    const { hoy, papeles, resumen } = e.documentos.valor;

    expect(hoy).toBe("2026-09-15");
    expect(papeles.map((p) => p.tipo.clave)).toEqual([
      "poliza_de_seguro",
      "permiso_transporte_personal",
      "verificacion_vehicular",
    ]);
    expect(papeles[0]).toMatchObject({ estado: { estado: "vigente" }, vigente: { id: "f2" }, anteriores: [{ id: "f1" }] });
    expect(papeles[1]).toMatchObject({ estado: { estado: "falta" }, vigente: null });
    expect(papeles[2]).toMatchObject({ estado: { estado: "falta_la_regla", falta: "obligatorio" } });
    expect(resumen).toEqual({ pidenAlgo: 1, faltaLaRegla: 1, peor: "falta", estaAlDia: false });
  });

  it("corregir: la versión más reciente de la foja es la que se juzga", async () => {
    const fojas = [
      {
        foja: { id: "f1", documentTypeId: "t1", createdAt: new Date("2026-09-01T00:00:00Z"), actorKind: "carrier", actorId: "u" },
        versiones: [version("f1", "2026-10-01", "2026-09-02T00:00:00Z"), version("f1", "2026-09-01", "2026-09-01T00:00:00Z")],
      },
    ];
    const e = await cargarExpedienteDeUnidad(repos({ catalogo, fojas }).repos, {
      carrierAccountId: "c1",
      unitId: "u1",
      ahora: AHORA,
    });
    if (e?.documentos.estado !== "con_datos") throw new Error("sin documentos");
    expect(e.documentos.valor.papeles[0]!.estado).toEqual({ estado: "por_vencer", venceEl: "2026-10-01", diasRestantes: 16 });
    expect(e.documentos.valor.papeles[0]!.vigente?.versiones).toHaveLength(2);
  });
});

describe("el expediente de un dispositivo", () => {
  it("identidad, actividad y relaciones; sin familia de documentos, porque no aplica", async () => {
    const e = await cargarExpedienteDeDispositivo(repos().repos, { carrierAccountId: "c1", deviceId: "d1", ahora: AHORA });
    expect(e?.identidad.imei).toEqual({ estado: "con_datos", valor: "111" });
    expect(e && "baja" in e.identidad).toBe(false);
    expect(e?.actividad.ultimaSenal).toMatchObject({ estado: "con_datos", valor: { estado: { grupo: "en_unidad" } } });
    expect(e?.relaciones.unidades).toMatchObject({ estado: "con_datos", valor: [{ etiqueta: "10254", vigente: true }] });
    expect(e && "documentos" in e).toBe(false);
  });

  it("el dispositivo de otra cuenta no existe desde aquí", async () => {
    expect(await cargarExpedienteDeDispositivo(repos().repos, { carrierAccountId: "c2", deviceId: "d1", ahora: AHORA })).toBeNull();
  });
});

describe("el expediente de un chofer", () => {
  it("lo que nada alimenta dice «aún no disponible»; lo que la base tiene, se muestra", async () => {
    const sin = await cargarExpedienteDeChofer(repos().repos, { carrierAccountId: "c1", driverId: "ch1", ahora: AHORA });
    expect(sin?.identidad.nombre).toEqual({ estado: "con_datos", valor: "Juan Pérez" });
    expect(sin?.actividad.unidadesOperadas).toEqual({ estado: "aun_no_disponible", fuente: "asignacion_de_choferes" });
    expect(sin?.relaciones.rutas).toEqual({ estado: "aun_no_disponible", fuente: "asignacion_de_choferes" });

    const con = await cargarExpedienteDeChofer(
      repos({ asignacionesDeChofer: [{ routeShiftId: "rs1", ruta: "Poniente", turno: "A", desde: "2026-09-01", hasta: null }] }).repos,
      { carrierAccountId: "c1", driverId: "ch1", ahora: AHORA },
    );
    expect(con?.relaciones.rutas.estado).toBe("con_datos");
  });

  it("sus papeles salen del catálogo de chofer, no del de unidad", async () => {
    const catalogo = [
      { tipo: tipo("t1", "poliza_de_seguro", "Póliza de seguro"), regla: null },
      { tipo: tipo("l1", "licencia", "Licencia", "chofer"), regla: null },
    ];
    const e = await cargarExpedienteDeChofer(repos({ catalogo }).repos, { carrierAccountId: "c1", driverId: "ch1", ahora: AHORA });
    if (e?.documentos.estado !== "con_datos") throw new Error("sin documentos");
    expect(e.documentos.valor.papeles.map((p) => p.tipo.clave)).toEqual(["licencia"]);
  });
});
