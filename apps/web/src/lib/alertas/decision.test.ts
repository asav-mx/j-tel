import { describe, it, expect } from "vitest";
import {
  agruparSinVeredicto,
  asuntoDe,
  avisoIngestaDetenida,
  avisoSinVeredicto,
  CLASES_POR_CUBETA,
  CLASES_QUE_AVISAN,
  cubetaDeCorrida,
  dentroDe,
  gruposQueAvisan,
  instanteSinVeredicto,
  MARGEN_SIN_VEREDICTO_MINUTOS,
  type AlertaLeida,
  type ServicioSinVeredicto,
} from "./decision";

const T = (iso: string) => new Date(iso);

describe("la cubeta de la corrida", () => {
  it("se alinea al reloj, no a la hora en que llegó el cron", () => {
    // El cron de las 10:05 puede entrar a las 10:05:02 o a las 10:05:47.
    const puntual = cubetaDeCorrida(T("2026-07-31T10:05:02Z"), 5);
    const tarde = cubetaDeCorrida(T("2026-07-31T10:05:47Z"), 5);

    expect(puntual).toEqual(tarde);
    expect(puntual.desde.toISOString()).toBe("2026-07-31T10:00:00.000Z");
    expect(puntual.hasta.toISOString()).toBe("2026-07-31T10:05:00.000Z");
  });

  it("dos corridas seguidas cubren tiempo contiguo y sin traslape", () => {
    const primera = cubetaDeCorrida(T("2026-07-31T10:05:02Z"), 5);
    const segunda = cubetaDeCorrida(T("2026-07-31T10:10:03Z"), 5);

    expect(segunda.desde.getTime()).toBe(primera.hasta.getTime());
  });

  it("un instante cae en exactamente una cubeta — ni dos avisos ni ninguno", () => {
    const instante = T("2026-07-31T10:05:00.000Z"); // justo en la frontera
    const primera = cubetaDeCorrida(T("2026-07-31T10:05:30Z"), 5);
    const segunda = cubetaDeCorrida(T("2026-07-31T10:10:30Z"), 5);

    expect(dentroDe(primera, instante)).toBe(true);
    expect(dentroDe(segunda, instante)).toBe(false);
  });

  it("no avisa de un instante que todavía no le toca a esta cubeta", () => {
    const cubeta = cubetaDeCorrida(T("2026-07-31T10:05:30Z"), 5);
    expect(dentroDe(cubeta, T("2026-07-31T10:05:20Z"))).toBe(false);
    expect(dentroDe(cubeta, null)).toBe(false);
  });
});

describe("la lista blanca de lo que avisa", () => {
  it("deja fuera los transitorios: rate limit y error suelto de archivo", () => {
    expect(CLASES_QUE_AVISAN).not.toContain("rate_limit");
    expect(CLASES_QUE_AVISAN).not.toContain("archive_error");
  });

  it("el archivador no se barre por cubeta: lo anuncia quien lo abre", () => {
    // Si estuviera en las dos listas, cada caída mandaría dos correos.
    expect(CLASES_QUE_AVISAN).toContain("watermark_lag");
    expect(CLASES_POR_CUBETA).not.toContain("watermark_lag");
    expect(CLASES_POR_CUBETA).toContain("heartbeat_stale");
  });
});

describe("el momento en que un servicio pasa a ser un faltante", () => {
  it("es deadline + gracia del contrato + la espera", () => {
    const deadline = T("2026-07-31T12:45:00Z");
    const cruce = instanteSinVeredicto(deadline, 15);

    // 15 min de gracia + 30 de margen
    expect(cruce.toISOString()).toBe("2026-07-31T13:30:00.000Z");
  });

  it("respeta la gracia de cada contrato, no una constante", () => {
    const deadline = T("2026-07-31T12:45:00Z");
    const estricto = instanteSinVeredicto(deadline, 5);
    const holgado = instanteSinVeredicto(deadline, 45);

    expect(holgado.getTime() - estricto.getTime()).toBe(40 * 60_000);
  });
});

const servicio = (
  parcial: Partial<ServicioSinVeredicto> & { ocurrenciaId: string },
): ServicioSinVeredicto => ({
  contratoId: "contrato-A",
  contratoNombre: "Contrato de ejemplo",
  clienteNombre: "Cliente de ejemplo",
  carrierNombre: "Carrier de ejemplo",
  rutaTurno: "Ruta 1 × Turno mañana",
  serviceDate: "2026-07-31",
  deadline: T("2026-07-31T12:45:00Z"),
  graciaMinutos: 15,
  sinViaje: false,
  ...parcial,
});

describe("los servicios sin veredicto se agrupan por contrato y día", () => {
  it("un turno entero atorado es UN grupo, no un correo por servicio", () => {
    const grupos = agruparSinVeredicto([
      servicio({ ocurrenciaId: "1" }),
      servicio({ ocurrenciaId: "2", deadline: T("2026-07-31T13:15:00Z") }),
      servicio({ ocurrenciaId: "3", deadline: T("2026-07-31T13:45:00Z") }),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.servicios).toHaveLength(3);
  });

  it("el primer cruce del grupo es el del servicio más temprano", () => {
    const grupos = agruparSinVeredicto([
      servicio({ ocurrenciaId: "tarde", deadline: T("2026-07-31T13:45:00Z") }),
      servicio({ ocurrenciaId: "temprano", deadline: T("2026-07-31T12:45:00Z") }),
    ]);

    expect(grupos[0]!.primerCruce.toISOString()).toBe("2026-07-31T13:30:00.000Z");
  });

  it("separa contratos distintos y días distintos", () => {
    const grupos = agruparSinVeredicto([
      servicio({ ocurrenciaId: "1" }),
      servicio({ ocurrenciaId: "2", contratoId: "contrato-B" }),
      servicio({ ocurrenciaId: "3", serviceDate: "2026-07-30" }),
    ]);

    expect(grupos).toHaveLength(3);
  });
});

describe("un grupo avisa una sola vez, aunque se le sumen faltantes", () => {
  it("avisa el grupo que cruzó en esta cubeta", () => {
    const grupos = agruparSinVeredicto([servicio({ ocurrenciaId: "1" })]);
    // Cruce a las 13:30 → lo recoge la corrida de las 13:30.
    const cubeta = cubetaDeCorrida(T("2026-07-31T13:30:12Z"), 5);

    expect(gruposQueAvisan(grupos, cubeta)).toHaveLength(1);
  });

  it("NO vuelve a avisar en la corrida siguiente", () => {
    const grupos = agruparSinVeredicto([servicio({ ocurrenciaId: "1" })]);
    const siguiente = cubetaDeCorrida(T("2026-07-31T13:35:12Z"), 5);

    expect(gruposQueAvisan(grupos, siguiente)).toHaveLength(0);
  });

  it("NO vuelve a avisar porque al grupo se le sumó otro servicio más tarde", () => {
    // El del turno de la tarde cruza a las 17:30, pero el grupo ya avisó a las
    // 13:30 con su primer faltante. Sin esto, un contrato atorado mandaría un
    // correo por cada servicio que va venciendo durante el día.
    const grupos = agruparSinVeredicto([
      servicio({ ocurrenciaId: "1" }),
      servicio({ ocurrenciaId: "2", deadline: T("2026-07-31T16:45:00Z") }),
    ]);
    const tarde = cubetaDeCorrida(T("2026-07-31T17:30:12Z"), 5);

    expect(gruposQueAvisan(grupos, tarde)).toHaveLength(0);
  });
});

describe("el aviso de servicios sin veredicto", () => {
  it("señala los que nunca entraron a la cola por no tener viaje", () => {
    const grupos = agruparSinVeredicto([
      servicio({ ocurrenciaId: "1", sinViaje: true }),
      servicio({ ocurrenciaId: "2", deadline: T("2026-07-31T13:15:00Z") }),
    ]);
    const aviso = avisoSinVeredicto(grupos[0]!, T("2026-07-31T13:31:00Z"));

    const sinViaje = aviso.mediciones.find((m) => m.etiqueta === "Sin fila de viaje");
    expect(sinViaje?.valor).toBe("1 de 2");
    expect(sinViaje?.lectura).toContain("nunca entraron");
  });

  it("trae las cuatro partes de un hallazgo, no solo el número", () => {
    const grupos = agruparSinVeredicto([servicio({ ocurrenciaId: "1" })]);
    const aviso = avisoSinVeredicto(grupos[0]!, T("2026-07-31T13:31:00Z"));

    expect(aviso.titulo).not.toBe("");
    expect(aviso.mediciones.length).toBeGreaterThan(0);
    expect(aviso.consecuencia).not.toBe("");
    expect(aviso.accion).toContain("J-Staff");
  });

  it("declara de dónde sale el momento del cruce, con su margen", () => {
    const grupos = agruparSinVeredicto([servicio({ ocurrenciaId: "1" })]);
    const aviso = avisoSinVeredicto(grupos[0]!, T("2026-07-31T13:31:00Z"));
    const cruce = aviso.mediciones.find((m) => m.etiqueta === "El primero cruzó");

    expect(cruce?.lectura).toContain(String(MARGEN_SIN_VEREDICTO_MINUTOS));
    expect(cruce?.lectura).toContain("gracia del contrato");
  });
});

describe("el aviso de ingesta detenida", () => {
  const alerta: AlertaLeida = {
    id: "a1",
    kind: "heartbeat_stale",
    severity: "critical",
    message: "Ingesta detenida > 15 min para Carrier de ejemplo (último punto hace 23 min)",
    createdAt: T("2026-07-31T13:20:00Z"),
    resolvedAt: null,
    metadata: {
      staleMinutesThreshold: 15,
      latestPointAgeMinutes: 23.4,
      pointsLastHour: 0,
    },
  };

  it("pone cada medición junto a su umbral", () => {
    const aviso = avisoIngestaDetenida(alerta, T("2026-07-31T13:25:00Z"));
    const punto = aviso.mediciones.find((m) => m.etiqueta === "Último punto de GPS");

    expect(punto?.valor).toBe("23.4 min");
    expect(punto?.lectura).toBe("umbral 15 min");
  });

  it("sobrevive a una alerta sin metadatos, sin inventar números", () => {
    const aviso = avisoIngestaDetenida(
      { ...alerta, metadata: null },
      T("2026-07-31T13:25:00Z"),
    );

    expect(aviso.mediciones.map((m) => m.etiqueta)).toEqual(["Abierta"]);
  });

  it("el asunto se entiende completo en la notificación del teléfono", () => {
    expect(asuntoDe(avisoIngestaDetenida(alerta, T("2026-07-31T13:25:00Z")))).toBe(
      "J-Telemetry · Ingesta detenida",
    );
  });
});
