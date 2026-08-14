import { describe, it, expect } from "vitest";
import {
  agruparDesalineadas,
  agruparSinVeredicto,
  asuntoDe,
  avisoDeSimulacro,
  avisoHoraLimiteVieja,
  avisoIngestaDetenida,
  avisoSinVeredicto,
  CLASES_POR_CUBETA,
  CLASES_QUE_AVISAN,
  cubetaDeCorrida,
  dentroDe,
  gruposQueAvisan,
  instanteSinVeredicto,
  MARGEN_SIN_VEREDICTO_MINUTOS,
  TOPE_DETALLE_DESALINEADAS,
  type AlertaLeida,
  type OcurrenciaDesalineada,
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

/* ─── C21 · la hora límite que su turno ya no produce ─────────────────────── */

const desalineada = (
  parcial: Partial<OcurrenciaDesalineada> = {},
): OcurrenciaDesalineada => ({
  ocurrenciaId: "o1",
  contratoId: "c1",
  contratoNombre: "Contrato A",
  clienteNombre: "Cliente A",
  turnoId: "t1",
  turnoNombre: "Turno A",
  turnoInicio: "06:00:00",
  anticipacionMinutos: 15,
  rutaNombre: "Ruta 1",
  serviceDate: "2026-08-20",
  guardada: T("2026-08-20T11:45:00Z"),
  derivada: T("2026-08-20T05:45:00Z"),
  causa: "zona",
  difMinutos: -360,
  ...parcial,
});

describe("las ocurrencias desalineadas se agrupan por contrato, turno y corrimiento", () => {
  it("un turno movido es UN grupo, no un correo por ocurrencia", () => {
    const grupos = agruparDesalineadas([
      desalineada({ ocurrenciaId: "o1", serviceDate: "2026-08-20" }),
      desalineada({ ocurrenciaId: "o2", serviceDate: "2026-08-21" }),
      desalineada({ ocurrenciaId: "o3", serviceDate: "2026-08-22" }),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.ocurrencias).toHaveLength(3);
  });

  it("NO junta dos corrimientos distintos del mismo turno — son dos historias", () => {
    // Es la causa C20 cometida en el correo que avisa de otra: una etiqueta
    // que suma dos cosas distintas porque comparten nombre.
    const grupos = agruparDesalineadas([
      desalineada({ ocurrenciaId: "o1", difMinutos: -360 }),
      desalineada({ ocurrenciaId: "o2", difMinutos: -5 }),
    ]);

    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.difMinutos).sort((a, b) => a - b)).toEqual([-360, -5]);
  });

  it("separa turnos distintos aunque compartan nombre — C20", () => {
    // Dos turnos llamados «Turno B» en la misma cuenta cliente: el de la
    // planta y el del campus. Agrupar por nombre los colapsaría en uno.
    const grupos = agruparDesalineadas([
      desalineada({ turnoId: "t-planta", turnoNombre: "Turno B", contratoId: "c1" }),
      desalineada({ turnoId: "t-campus", turnoNombre: "Turno B", contratoId: "c2" }),
    ]);

    expect(grupos).toHaveLength(2);
  });

  it("ordena por cuándo se vuelve irreversible, no por tamaño del grupo", () => {
    const grupos = agruparDesalineadas([
      // El grupo grande se sella después.
      desalineada({ ocurrenciaId: "a1", turnoId: "grande", guardada: T("2026-08-25T11:45:00Z") }),
      desalineada({ ocurrenciaId: "a2", turnoId: "grande", guardada: T("2026-08-26T11:45:00Z") }),
      // El chico se sella mañana.
      desalineada({ ocurrenciaId: "b1", turnoId: "urgente", guardada: T("2026-08-09T11:45:00Z") }),
    ]);

    expect(grupos[0]!.ocurrencias).toHaveLength(1);
    expect(grupos[0]!.primeraEnSellarse.toISOString()).toBe("2026-08-09T11:45:00.000Z");
  });

  it("el reloj del grupo es la ocurrencia que primero cruza su hora límite", () => {
    const grupos = agruparDesalineadas([
      desalineada({ ocurrenciaId: "o1", guardada: T("2026-08-22T11:45:00Z") }),
      desalineada({ ocurrenciaId: "o2", guardada: T("2026-08-20T11:45:00Z") }),
      desalineada({ ocurrenciaId: "o3", guardada: T("2026-08-21T11:45:00Z") }),
    ]);

    expect(grupos[0]!.primeraEnSellarse.toISOString()).toBe("2026-08-20T11:45:00.000Z");
    expect(grupos[0]!.ultimaEnSellarse.toISOString()).toBe("2026-08-22T11:45:00.000Z");
  });
});

describe("el aviso de hora límite vieja", () => {
  const ahora = T("2026-08-08T12:00:00Z");
  const unGrupo = (ocurrencias: OcurrenciaDesalineada[]) =>
    agruparDesalineadas(ocurrencias)[0]!;

  it("trae las cuatro partes de un hallazgo, no solo el número", () => {
    const aviso = avisoHoraLimiteVieja(unGrupo([desalineada()]), ahora, 500);

    expect(aviso.titulo).toContain("Cliente A");
    expect(aviso.mediciones.length).toBeGreaterThan(0);
    expect(aviso.consecuencia).not.toBe("");
    expect(aviso.accion).toContain("Asav");
  });

  it("dice sobre cuántas se midió, para que el conteo no viaje sin su universo", () => {
    const aviso = avisoHoraLimiteVieja(unGrupo([desalineada()]), ahora, 500);

    const servicios = aviso.mediciones.find((m) => m.etiqueta === "Servicios sin sellar");
    expect(servicios?.valor).toBe("1");
    expect(servicios?.lectura).toContain("de 500 revisados");
  });

  it("escribe el corrimiento como duración, nunca con formato de hora", () => {
    const aviso = avisoHoraLimiteVieja(
      unGrupo([desalineada({ difMinutos: -360 })]),
      ahora,
      500,
    );

    const corrimiento = aviso.mediciones.find((m) => m.etiqueta === "Corrimiento");
    expect(corrimiento?.valor).toContain("6 h");
    expect(corrimiento?.valor).not.toMatch(/\d+:\d\d/);
  });

  it("el sentido del corrimiento no se contradice con su lectura", () => {
    // `difMinutos` es derivada − guardada. La primera redacción decía «tarde»
    // junto a «va antes» en la misma línea, y ninguna prueba lo veía: el valor
    // era correcto y la lectura también, cada uno por su cuenta. Esta prueba
    // existe porque lo atrapó leer el correo, no una aserción.
    const corrimiento = (dif: number) =>
      avisoHoraLimiteVieja(unGrupo([desalineada({ difMinutos: dif })]), ahora, 500)
        .mediciones.find((m) => m.etiqueta === "Corrimiento")!;

    // Derivada después de la guardada ⇒ la guardada va adelantada.
    const adelantada = corrimiento(360);
    expect(adelantada.valor).toBe("6 h temprano");
    expect(adelantada.lectura).toContain("va antes");

    // Derivada antes de la guardada ⇒ la guardada va atrasada.
    const atrasada = corrimiento(-150);
    expect(atrasada.valor).toBe("2 h 30 min tarde");
    expect(atrasada.lectura).toContain("va después");
  });

  it("distingue el marco temporal equivocado del ajuste de política", () => {
    const zona = avisoHoraLimiteVieja(
      unGrupo([desalineada({ causa: "zona" })]),
      ahora,
      500,
    );
    const deriva = avisoHoraLimiteVieja(
      unGrupo([desalineada({ causa: "deriva", difMinutos: -5 })]),
      ahora,
      500,
    );

    const lectura = (a: typeof zona) =>
      a.mediciones.find((m) => m.etiqueta === "Corrimiento")!.lectura;
    expect(lectura(zona)).toContain("medianoche civil");
    expect(lectura(deriva)).toContain("cambiaron después de generarse");
  });

  it("cada instante de evidencia lleva su fecha completa", () => {
    const aviso = avisoHoraLimiteVieja(unGrupo([desalineada()]), ahora, 500);

    const primero = aviso.mediciones.find((m) => m.etiqueta === "El primero se juzga");
    expect(primero?.valor).toMatch(/^\d{4}-\d{2}-\d{2} /);
  });

  it("recorta la lista larga y DICE que la recortó", () => {
    const muchas = Array.from({ length: TOPE_DETALLE_DESALINEADAS + 8 }, (_, i) =>
      desalineada({ ocurrenciaId: `o${i}`, serviceDate: `2026-08-${10 + i}` }),
    );
    const aviso = avisoHoraLimiteVieja(unGrupo(muchas), ahora, 500);

    expect(aviso.detalle).toHaveLength(TOPE_DETALLE_DESALINEADAS + 1);
    expect(aviso.detalle!.at(-1)).toContain("8 más");
    // El conteo de arriba sigue siendo el completo: el recorte es de la lista.
    expect(aviso.titulo).toContain(String(TOPE_DETALLE_DESALINEADAS + 8));
  });

  it("el asunto se entiende completo en la notificación del teléfono", () => {
    expect(asuntoDe(avisoHoraLimiteVieja(unGrupo([desalineada()]), ahora, 500))).toBe(
      "J-Telemetry · Hora límite desalineada",
    );
  });
});

describe("el simulacro se anuncia como simulacro", () => {
  const ahora = T("2026-08-08T18:00:00Z");

  it("el asunto lo dice, para que la notificación del teléfono no engañe", () => {
    // Si compartiera clase con un hallazgo, el asunto diría «Hora límite
    // desalineada» y se leería como real antes de que nadie abra el correo.
    expect(asuntoDe(avisoDeSimulacro(ahora))).toContain("SIMULACRO");
    expect(asuntoDe(avisoDeSimulacro(ahora))).not.toContain("desalineada");
  });

  it("el título y la acción también, no solo el asunto", () => {
    const aviso = avisoDeSimulacro(ahora);

    expect(aviso.titulo).toContain("SIMULACRO");
    expect(aviso.titulo).toContain("no es un hallazgo");
    expect(aviso.accion).toContain("Confirmar que este correo llegó");
  });

  it("no afirma ningún servicio: cero, con su lectura", () => {
    const aviso = avisoDeSimulacro(ahora);
    const servicios = aviso.mediciones.find((m) => m.etiqueta === "Servicios afectados");

    expect(servicios?.valor).toBe("0");
    expect(servicios?.lectura).toContain("no lee la base");
    // Un simulacro que nombrara servicios sería §D: un correo correcto como
    // prueba y falso como afirmación sobre la operación.
    expect(aviso.detalle).toBeUndefined();
  });

  it("dice que fue provocado a mano y no por una corrida programada", () => {
    const provocado = avisoDeSimulacro(ahora).mediciones.find(
      (m) => m.etiqueta === "Provocado",
    );

    expect(provocado?.lectura).toContain("?simular=1");
    expect(provocado?.lectura).toContain("ninguna corrida programada");
  });

  /*
   * Los dos primeros simulacros —hora límite y ventanas— llegaron a la bandeja
   * con el MISMO asunto y el mismo título. Eran dos correos idénticos probando
   * dos caminos distintos, y no había forma de saber cuál probaba cuál. **Una
   * prueba cuyo resultado no se puede atribuir no prueba nada**, que es la misma
   * lección del vigilante en su versión chica.
   */
  describe("dos crones distintos no producen el mismo correo", () => {
    it("el asunto nombra el cron, que es lo único que se ve en el teléfono", () => {
      const a = asuntoDe(avisoDeSimulacro(ahora, "revisar-horas-limite"));
      const b = asuntoDe(avisoDeSimulacro(ahora, "revisar-ventanas"));

      expect(a).toContain("revisar-horas-limite");
      expect(b).toContain("revisar-ventanas");
      expect(a).not.toBe(b);
      // Y sigue anunciándose como simulacro: nombrar el cron no puede costar eso.
      expect(a).toContain("SIMULACRO");
    });

    it("el cuerpo dice de dónde vino, no solo el asunto", () => {
      const quien = avisoDeSimulacro(ahora, "revisar-ventanas").mediciones.find(
        (m) => m.etiqueta === "Quién lo mandó",
      );

      expect(quien?.valor).toBe("/api/cron/revisar-ventanas");
      expect(quien?.lectura).toContain("que otro entregue no dice que éste entregue");
    });

    it("sin cron declarado lo dice, en vez de fingir que se sabe", () => {
      const quien = avisoDeSimulacro(ahora).mediciones.find(
        (m) => m.etiqueta === "Quién lo mandó",
      );

      expect(quien?.valor).toBe("sin declarar");
      expect(quien?.lectura).toContain("no se puede atribuir");
    });
  });
});
