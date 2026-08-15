/**
 * De dónde sale lo que se avisa: la lectura de la base, y el único lugar de
 * esta tarea que escribe.
 *
 * Escribe una sola cosa —abrir y cerrar el incidente del archivador
 * (`watermark_lag`)— y lo hace con los métodos que el repositorio ya tenía,
 * sobre un valor del enum que ya existía. Cero migraciones, cero tablas
 * nuevas: este carril es `apps/web` y no toca `packages/`.
 *
 * Por qué se escribe ese incidente en vez de calcularlo cada vez: la fila es
 * la que recuerda que el archivador YA estaba callado. Sin ella habría que
 * elegir entre avisar cada cinco minutos durante toda la caída, o inventar un
 * estado en algún lado. La tabla `ingest_alerts` ya deduplica por tipo y
 * carrier (`findOpenByKind`), y de paso da gratis el aviso de "ya volvió" y el
 * conteo del resumen diario.
 *
 * La muestra de salud tampoco se arma aquí: se pide a `lib/salud-muestra`, el
 * mismo armado que lee `/api/salud`. Antes había una copia en este archivo que
 * decía estar hecha igual y no lo estaba —le faltaba el chequeo de
 * verificación—, y el correo salió reportando que no pudo contar. Dos
 * definiciones de la misma muestra es cómo se llega a que el correo diga una
 * cosa y el vigilante otra.
 */

import type { Repositories } from "@jtel/db";
import { UMBRALES_SALUD, diagnostico } from "@jtel/services";
import { localDateIso, JTTEL_TZ } from "@/lib/local-time";
import { leerMuestraDeSalud } from "@/lib/salud-muestra";
import {
  agruparSinVeredicto,
  CLASES_POR_CUBETA,
  avisoArchivadorCallado,
  avisoArchivadorRestablecido,
  avisoIngestaDetenida,
  avisoIngestaRestablecida,
  avisoSinVeredicto,
  cubetaDeCorrida,
  dentroDe,
  DIAS_SIN_VEREDICTO,
  gruposQueAvisan,
  instanteSinVeredicto,
  type AlertaLeida,
  type Aviso,
  type ServicioSinVeredicto,
} from "@/lib/alertas/decision";
import type { ResumenDiario } from "@/lib/alertas/correo";

/**
 * Cuántas filas de `ingest_alerts` se miran para encontrar las que se
 * resolvieron en la cubeta. No es silencioso a propósito: el resultado de la
 * corrida reporta el tope, para que un día con cientos de alertas no se lea
 * como un día tranquilo.
 */
const TOPE_ALERTAS_RECIENTES = 200;

/**
 * Lo que hay que escribir DESPUÉS de que el aviso salió, no antes.
 *
 * El orden es deliberado y es lo único delicado de este archivo. La fila de
 * `ingest_alerts` es la memoria de "ya avisamos de esto"; si se escribiera
 * antes del envío y el envío fallara, el incidente quedaría marcado como
 * conocido y ese aviso no volvería a salir nunca. Escribiendo después, un
 * envío fallido deja todo como estaba y la siguiente corrida lo intenta de
 * nuevo — vuelve a detectar, vuelve a avisar.
 */
export type IncidentesPendientes = {
  abrir: Array<{ mensaje: string; edadMinutos: number }>;
  cerrar: string[];
};

export type ResultadoDeteccion = {
  avisos: Aviso[];
  pendientes: IncidentesPendientes;
  /** Se alcanzó el tope de lectura: puede haber resoluciones no vistas. */
  topeAlcanzado: boolean;
};

/**
 * El incidente del archivador: se abre cuando cruza el umbral y se cierra
 * cuando vuelve. El aviso lo manda la misma corrida que lo abre o lo cierra —
 * por eso `watermark_lag` no entra al barrido por cubeta de más abajo, o se
 * anunciaría dos veces.
 */
async function atenderArchivador(
  repos: Repositories,
  ahora: Date,
  chequeoArchivador: { estado: string; minutos: number | null } | undefined,
  marcasContadas: number,
): Promise<{ avisos: Aviso[]; pendientes: IncidentesPendientes }> {
  const avisos: Aviso[] = [];
  const pendientes: IncidentesPendientes = { abrir: [], cerrar: [] };

  if (!chequeoArchivador) return { avisos, pendientes };

  const abierta = await repos.ingestAlerts.findOpenByKind("watermark_lag");

  if (chequeoArchivador.estado === "enfermo") {
    if (!abierta) {
      const edad = chequeoArchivador.minutos ?? 0;
      pendientes.abrir.push({
        mensaje: `Archivador callado ${edad} min (umbral ${UMBRALES_SALUD.archivadorMaxMinutos} min)`,
        edadMinutos: edad,
      });
      avisos.push(
        avisoArchivadorCallado(
          {
            edadMinutos: edad,
            umbralMinutos: UMBRALES_SALUD.archivadorMaxMinutos,
            carriersConMarca: marcasContadas,
          },
          ahora,
        ),
      );
    }
    return { avisos, pendientes };
  }

  if (abierta) {
    pendientes.cerrar.push("watermark_lag");
    avisos.push(avisoArchivadorRestablecido(comoLeida(abierta), ahora));
  }

  return { avisos, pendientes };
}

/**
 * Se llama SOLO después de un envío exitoso. Ver `IncidentesPendientes`.
 *
 * Severidad `warning` y no `critical` a propósito: `/api/salud` ya responde
 * 503 por su propio chequeo del archivador, y marcarla crítica la contaría dos
 * veces en el mismo diagnóstico.
 */
export async function aplicarIncidentes(
  repos: Repositories,
  pendientes: IncidentesPendientes,
): Promise<void> {
  for (const a of pendientes.abrir) {
    await repos.ingestAlerts.create({
      kind: "watermark_lag",
      severity: "warning",
      message: a.mensaje,
      metadata: {
        edadMinutos: a.edadMinutos,
        umbralMinutos: UMBRALES_SALUD.archivadorMaxMinutos,
      },
    });
  }
  for (const _ of pendientes.cerrar) {
    await repos.ingestAlerts.resolveOpen("watermark_lag");
  }
}

type FilaAlerta = {
  id: string;
  kind: string;
  severity: string;
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
  metadata: Record<string, unknown> | null;
};

const comoLeida = (a: FilaAlerta): AlertaLeida => ({
  id: a.id,
  kind: a.kind,
  severity: a.severity,
  message: a.message,
  createdAt: a.createdAt,
  resolvedAt: a.resolvedAt,
  metadata: a.metadata,
});

/**
 * Los servicios que ya pasaron su momento de juicio y no tienen hecho sellado.
 *
 * Incluye —y los marca— los que ni siquiera tienen fila de viaje: la cola de
 * verificación hace `innerJoin` contra `trips`, así que una ocurrencia sin
 * viaje nunca entra a ella, nunca se juzga y hoy no aparece en ninguna
 * pantalla como falla. Ese es el silencio que esta detección existe para
 * romper.
 */
export async function leerSinVeredicto(
  repos: Repositories,
  ahora: Date,
  dias: number = DIAS_SIN_VEREDICTO,
): Promise<ServicioSinVeredicto[]> {
  const desde = new Date(ahora.getTime() - dias * 24 * 60 * 60_000);
  const clientes = await repos.accounts.listByType("client", { includeDemo: false });

  const servicios: ServicioSinVeredicto[] = [];

  for (const cliente of clientes) {
    const ocurrencias = await repos.occurrences.findForClientAccount(
      cliente.id,
      desde,
      ahora,
    );

    for (const o of ocurrencias) {
      // Solo contratos vivos. Un borrador o una demo sin verificar no es una
      // falla de plataforma, y un suspendido dejó de esperarse a propósito.
      if (o.contract?.status !== "active") continue;
      if (o.complianceFact) continue;

      const gracia = o.contract.policy?.verificationGraceMinutes ?? 0;
      if (instanteSinVeredicto(o.expectedDeadline, gracia) > ahora) continue;

      const ruta = o.profile?.routeShift?.route?.name ?? "ruta sin nombre";
      const turno = o.profile?.routeShift?.shift?.name ?? "turno sin nombre";

      servicios.push({
        ocurrenciaId: o.id,
        contratoId: o.contractId,
        contratoNombre: o.contract.name,
        clienteNombre: o.contract.client?.name ?? cliente.name,
        carrierNombre: o.contract.carrier?.name ?? "carrier sin nombre",
        rutaTurno: `${ruta} × ${turno}`,
        serviceDate: o.serviceDate,
        deadline: o.expectedDeadline,
        graciaMinutos: gracia,
        sinViaje: !o.trip,
      });
    }
  }

  return servicios;
}

/**
 * Todo lo que esta corrida tiene que avisar.
 *
 * El orden importa poco salvo en un punto: el archivador se atiende antes del
 * barrido por cubeta, porque abrir su incidente puede cambiar el conteo de
 * abiertas que el resumen lee después.
 */
export async function detectarAvisos(
  repos: Repositories,
  ahora: Date,
): Promise<ResultadoDeteccion> {
  const cubeta = cubetaDeCorrida(ahora);
  const { resultado, marcas } = await leerMuestraDeSalud(repos, ahora);

  const archivador = resultado.chequeos.find((c) => c.id === "archivador");
  const atendido = await atenderArchivador(repos, ahora, archivador, marcas.length);

  const avisos: Aviso[] = [...atendido.avisos];

  // Ingesta detenida: la abre y la cierra el cron de heartbeat, así que aquí
  // se recoge por cubeta — la que se abrió o se resolvió en el intervalo que
  // le toca a esta corrida.
  const recientes = await repos.ingestAlerts.listRecent(TOPE_ALERTAS_RECIENTES);
  const topeAlcanzado = recientes.length === TOPE_ALERTAS_RECIENTES;

  const porCubeta = new Set<string>(CLASES_POR_CUBETA);
  for (const a of recientes) {
    if (!porCubeta.has(a.kind)) continue;
    if (!a.resolvedAt && dentroDe(cubeta, a.createdAt)) {
      avisos.push(avisoIngestaDetenida(comoLeida(a), ahora));
    } else if (a.resolvedAt && dentroDe(cubeta, a.resolvedAt)) {
      avisos.push(avisoIngestaRestablecida(comoLeida(a), ahora));
    }
  }

  // Servicios sin veredicto: avisa solo el grupo (contrato × día) cuyo primer
  // faltante cruzó en esta cubeta.
  const servicios = await leerSinVeredicto(repos, ahora);
  const grupos = agruparSinVeredicto(servicios);
  for (const grupo of gruposQueAvisan(grupos, cubeta)) {
    avisos.push(avisoSinVeredicto(grupo, ahora));
  }

  return { avisos, pendientes: atendido.pendientes, topeAlcanzado };
}

/** Los datos del resumen diario: el día anterior, contado completo. */
export async function armarResumen(
  repos: Repositories,
  ahora: Date,
): Promise<ResumenDiario> {
  const { resultado } = await leerMuestraDeSalud(repos, ahora);

  const ayer = new Date(ahora.getTime() - 24 * 60 * 60_000);
  const diaIso = localDateIso(ayer, JTTEL_TZ);
  const inicioDelDia = new Date(ahora.getTime() - 24 * 60 * 60_000);

  const abiertas = await repos.ingestAlerts.listUnresolved(100);
  const recientes = await repos.ingestAlerts.listRecent(TOPE_ALERTAS_RECIENTES);

  const contar = (filas: FilaAlerta[]) => {
    const porTipo = new Map<string, { cantidad: number; masAntigua: Date | null }>();
    for (const f of filas) {
      const previo = porTipo.get(f.kind) ?? { cantidad: 0, masAntigua: null };
      porTipo.set(f.kind, {
        cantidad: previo.cantidad + 1,
        masAntigua:
          previo.masAntigua && previo.masAntigua < f.createdAt ? previo.masAntigua : f.createdAt,
      });
    }
    return [...porTipo.entries()].map(([tipo, v]) => ({ tipo, ...v }));
  };

  const servicios = await leerSinVeredicto(repos, ahora);
  const contratos = new Set(servicios.map((s) => s.contratoId));

  return {
    dia: diaIso,
    saludAhora: resultado.estado,
    diagnostico: diagnostico(resultado),
    chequeos: resultado.chequeos.map((c) => ({
      id: c.id,
      estado: c.estado,
      lectura: c.lectura,
    })),
    abiertasPorTipo: contar(abiertas),
    nuevasPorTipo: contar(recientes.filter((r) => r.createdAt >= inicioDelDia)).map(
      ({ tipo, cantidad }) => ({ tipo, cantidad }),
    ),
    sinVeredicto: {
      total: servicios.length,
      sinViaje: servicios.filter((s) => s.sinViaje).length,
      contratos: contratos.size,
    },
    diasMirados: DIAS_SIN_VEREDICTO,
  };
}
