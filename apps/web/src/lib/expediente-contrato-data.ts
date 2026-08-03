/**
 * Expediente del contrato — la última de las cinco identidades, y la única que
 * hasta hoy no tenía puerta.
 *
 * ── Por qué NO es la Oficina ────────────────────────────────────────────────
 *
 * | | Pregunta | Quién la abre |
 * |---|---|---|
 * | **Oficina** | ¿con qué reglas se juzga? | un coordinador que quiere entender un veredicto |
 * | **Expediente** | ¿qué es esta relación comercial? | quien va a renovar, negociar o auditar |
 *
 * Distinta pregunta, distinta persona, distinto momento. El expediente tiene
 * **una puerta** hacia la Oficina, no una copia: las reglas siguen viviendo en
 * un solo lugar.
 *
 * ── Las dos partes lo ven igual ─────────────────────────────────────────────
 *
 * **Mismo contenido para cliente y carrier.** Es el documento de la relación, y
 * una relación no tiene dos versiones. La única diferencia es dónde vive.
 *
 * Por eso este cargador no recibe una "cara": recibe un contrato y la cuenta
 * que lo pide, y lo único que hace con la cuenta es comprobar que sea **parte
 * del contrato**. Si un dato tuviera que ocultarse de una de las partes, no
 * pertenece a este expediente — y entonces el filtro correcto es no traerlo,
 * no traerlo y esconderlo.
 *
 * ── Lo que la auditoría §5 encontró, medido el 2026-08-02 ───────────────────
 *
 * - **Documentos: no hay dónde guardarlos.** Ninguna tabla de archivos en el
 *   esquema. La pestaña no se construye y queda anotada.
 * - **Módulos contratados: el concepto no existe.** Ninguna tabla de módulos.
 *   Dibujarlos hoy sería hornear en la pantalla una lista que nadie contrató —
 *   exactamente lo que la ley 6 prohíbe.
 * - **Historia de la política: 0 versiones en toda la base.** El lector existe
 *   (PR #125) y la sección se construye; hoy dice que no ha cambiado nunca, que
 *   es distinto de no saber.
 * - **Contratos por cuenta: Tecma tiene 2.** La navegación entre hermanos sí
 *   aplica.
 */

import { getRepos } from "@/lib/db";
import { JTTEL_TZ, localDateIso } from "@jtel/domain";

export type ParteDelContrato = { id: string; nombre: string; tipo: "cliente" | "carrier" };

export type RutaDelAlcance = {
  routeId: string;
  nombre: string;
  turnos: string[];
  /** Cuántos perfiles de servicio la sirven bajo este contrato. */
  perfiles: number;
};

export type VersionDePolitica = {
  id: string;
  cuando: string;
  quien: string | null;
  motivo: string | null;
};

export type ExpedienteContrato = {
  contrato: {
    id: string;
    nombre: string;
    estado: string;
    vigencia: { desde: string; hasta: string; vencido: boolean };
    alta: string;
  };
  partes: ParteDelContrato[];
  /** A quién sirve: planta o campus. */
  sitio: string | null;
  hermanos: {
    anterior: { id: string; nombre: string } | null;
    siguiente: { id: string; nombre: string } | null;
    indice: number;
    total: number;
  };
  identidad: { etiqueta: string; valor: string; lectura: string | null }[];
  alcance: {
    rutas: RutaDelAlcance[];
    turnos: string[];
    geocercas: { id: string; nombre: string }[];
    serviciosPorDia: number;
  };
  historia: VersionDePolitica[];
  /** Por qué la historia está vacía, cuando lo está. */
  sinHistoria: string | null;
  /** A dónde lleva la puerta de la política. Una puerta, no una copia. */
  puertaOficina: string | null;
  compuerta: string;
  ausentes: { titulo: string; razon: string }[];
};

export const COMPUERTA_CONTRATO =
  "Disponible cuando la verificación alcance su umbral de confianza. El agregado histórico —cumplimiento por mes, servicios sellados, pendientes acumulados— existe en los hechos; publicarlo antes de que el árbitro acierte de forma sostenida sería poner una cifra de juicio en el documento con el que se renueva una relación comercial.";

export const AUSENTES_CONTRATO: { titulo: string; razon: string }[] = [
  {
    titulo: "Documentos del contrato",
    razon:
      "No hay dónde guardarlos: el esquema no tiene ninguna tabla de archivos. La pestaña no se construye hasta que exista el almacenamiento y se decida qué se guarda y quién puede verlo.",
  },
  {
    titulo: "Módulos contratados",
    razon:
      "El concepto no existe en el modelo. Dibujar hoy una lista de módulos activos e inactivos sería hornearla en la pantalla, y lo que se cobra en una relación comercial no puede vivir en el código de una vista.",
  },
  {
    titulo: "Términos comerciales",
    razon:
      "Tarifas y penalizaciones no están modeladas, y no se muestran a medias. Un expediente que insinúa términos que el sistema no sostiene es peor que uno que no los menciona.",
  },
];

function fecha(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : localDateIso(d, JTTEL_TZ);
}

const ESTADOS: Record<string, string> = {
  active: "Activo",
  draft: "Borrador",
  demo: "Demostración",
  suspended: "Suspendido",
  ended: "Terminado",
};

export async function loadExpedienteContrato(
  cuenta: { id: string; name: string; type: string },
  contractId: string,
): Promise<ExpedienteContrato | null> {
  const repos = getRepos();
  const contrato = await repos.contracts.findById(contractId);
  if (!contrato) return null;

  // La pertenencia: la cuenta que pide tiene que ser PARTE del contrato. No es
  // un filtro de vista — un tercero simplemente no lo abre.
  const esParte =
    contrato.clientAccountId === cuenta.id || contrato.carrierAccountId === cuenta.id;
  if (!esParte) return null;

  const esCliente = contrato.clientAccountId === cuenta.id;

  const [cliente, carrier, historia, hermanosCrudos, perfiles, rutaTurnos] = await Promise.all([
    repos.accounts.findById(contrato.clientAccountId),
    repos.accounts.findById(contrato.carrierAccountId),
    repos.contracts.getPolicyHistory(contractId),
    esCliente
      ? repos.contracts.findForClient(contrato.clientAccountId)
      : repos.contracts.findForCarrier(contrato.carrierAccountId),
    repos.profiles.findForContract(contractId),
    repos.routes.getRouteShiftsForClient(contrato.clientAccountId),
  ]);

  const porRutaTurno = new Map(rutaTurnos.map((rs) => [rs.id, rs]));

  const rutas = new Map<string, RutaDelAlcance>();
  const turnos = new Set<string>();
  const geocercas = new Map<string, { id: string; nombre: string }>();

  for (const p of perfiles) {
    const rs = p.routeShiftId ? porRutaTurno.get(p.routeShiftId) : undefined;
    const nombreRuta = rs?.route?.name ?? "—";
    const nombreTurno = rs?.shift?.name ?? "—";
    const routeId = rs?.routeId ?? nombreRuta;

    const actual = rutas.get(routeId) ?? {
      routeId,
      nombre: nombreRuta,
      turnos: [] as string[],
      perfiles: 0,
    };
    actual.perfiles += 1;
    if (!actual.turnos.includes(nombreTurno)) actual.turnos.push(nombreTurno);
    rutas.set(routeId, actual);
    turnos.add(nombreTurno);

    const g = p.geofence;
    if (g && !geocercas.has(g.id)) geocercas.set(g.id, { id: g.id, nombre: g.name });
  }

  const ordenados = [...hermanosCrudos].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", "es"),
  );
  const i = ordenados.findIndex((c) => c.id === contractId);
  const hermano = (x: (typeof ordenados)[number] | undefined) =>
    x ? { id: x.id, nombre: x.name ?? "Contrato" } : null;

  const hoy = localDateIso(new Date(), JTTEL_TZ);
  const hasta = fecha(contrato.validTo);
  const desde = fecha(contrato.validFrom);

  const identidad: ExpedienteContrato["identidad"] = [
    {
      etiqueta: "Estado",
      valor: ESTADOS[contrato.status] ?? contrato.status,
      lectura: null,
    },
    {
      etiqueta: "Vigencia",
      valor: `${desde} → ${hasta}`,
      // Todo dato con su lectura: una fecha de fin sin decir si ya pasó obliga
      // a quien lee a comparar contra el calendario.
      lectura: hasta < hoy ? "vencido" : `vigente hoy (${hoy})`,
    },
    {
      // El conteo que importa es el de SERVICIOS, no el de rutas: en esta
      // operación varias rutas comparten nombre (son registros distintos, con
      // trazados distintos), así que "27 rutas" invita a contar nombres en la
      // tabla y no cuadrar. El alcance de un contrato se mide en servicios al
      // día, que es lo que se contrata.
      etiqueta: "Servicios al día",
      valor: String(perfiles.length),
      lectura: `${rutas.size} ${rutas.size === 1 ? "ruta" : "rutas"} · ${turnos.size} ${turnos.size === 1 ? "turno" : "turnos"}`,
    },
    {
      etiqueta: "Turnos",
      valor: String(turnos.size),
      lectura: turnos.size > 0 ? [...turnos].sort().join(" · ") : null,
    },
    {
      etiqueta: "Destinos",
      valor: String(geocercas.size),
      lectura: geocercas.size > 0 ? [...geocercas.values()].map((g) => g.nombre).join(" · ") : null,
    },
    {
      etiqueta: "En el sistema desde",
      valor: fecha(contrato.createdAt),
      lectura: "fecha de alta, no de inicio de la relación",
    },
  ];

  return {
    contrato: {
      id: contrato.id,
      nombre: contrato.name ?? "Contrato",
      estado: ESTADOS[contrato.status] ?? contrato.status,
      vigencia: { desde, hasta, vencido: hasta < hoy },
      alta: fecha(contrato.createdAt),
    },
    partes: [
      { id: contrato.clientAccountId, nombre: cliente?.name ?? "—", tipo: "cliente" },
      { id: contrato.carrierAccountId, nombre: carrier?.name ?? "—", tipo: "carrier" },
    ],
    sitio: contrato.plant?.name ?? contrato.plantGroup?.name ?? null,
    hermanos: {
      anterior: hermano(ordenados[i - 1]),
      siguiente: hermano(ordenados[i + 1]),
      indice: i + 1,
      total: ordenados.length,
    },
    identidad,
    alcance: {
      rutas: [...rutas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      turnos: [...turnos].sort(),
      geocercas: [...geocercas.values()],
      serviciosPorDia: perfiles.length,
    },
    historia: historia.map((h) => ({
      id: h.id,
      cuando: `${localDateIso(h.changedAt, JTTEL_TZ)}`,
      // La firma honesta hasta que exista auth-rbac es el ROL, no un nombre
      // inventado. El motor guarda actorKind y actorId por separado justo para
      // no tener que adivinar uno del otro.
      quien: h.actorId ?? h.actorKind,
      motivo: h.note ?? null,
    })),
    // Cero versiones no es "no sé": es que la política no ha cambiado desde el
    // alta. Decirlo así evita que el silencio se lea como un dato perdido.
    sinHistoria:
      historia.length === 0
        ? "La política de este contrato no ha cambiado desde su alta. Cada versión queda registrada; los hechos conservan la que estaba vigente el día que se sellaron."
        : null,
    // La puerta a la Oficina existe solo para el cliente: es quien configura.
    // El transportista ve la misma política, pero no la mueve — ley 5.
    puertaOficina: esCliente ? `/cliente/contrato/${contrato.id}` : null,
    compuerta: COMPUERTA_CONTRATO,
    ausentes: AUSENTES_CONTRATO,
  };
}
