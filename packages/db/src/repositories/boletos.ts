import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { MOTIVO_SISTEMA, llavePublicaBienFormada, nombreDeLector } from "@jtel/domain";
import { boletoLoFirmoJTel } from "@jtel/domain/boleto";
import {
  hallazgoDeDobleUso,
  loteBienFormado,
  saludDelLector,
  verificarFirmaDelLote,
  type HallazgoDeDobleUso,
  type HorarioDelServicio,
  type LoteDelLector,
  type SaludDelLector,
} from "@jtel/domain/sincronizacion";
import type { Database } from "../index.js";
import {
  circuitUnitAssignments,
  circuits,
  ticketOperations,
  units,
  validatorAssignments,
  validatorSyncs,
  validators,
} from "../schema/index.js";

/**
 * El libro de boletos y sus lectores — Ontoy 3.0 · PR P3.5 (0054).
 *
 * **Nada de aquí cobra.** Boletos de laboratorio con dinero de mentira
 * (`docs/Ficha-Construccion-Ontoy-3-Pagos.md` §1); no hay una sola columna de
 * importe en las cuatro tablas, y no es un olvido.
 *
 * Aquí vive lo que toca la base. Las reglas —cómo se firma un lote, qué cuenta
 * como doble uso, cuándo un lector está mudo— son de `@jtel/domain`, para que
 * el servidor y el aparato contesten con la misma.
 */

/** Por qué el servidor no aceptó un renglón del lote. */
export type MotivoDeRechazo =
  /** Vía QR sin boleto, o vía dictada con uno: una de las dos miente. */
  | "renglon_mal_formado"
  /** El folio del renglón no es el del boleto que lo acompaña. */
  | "folio_no_cuadra_con_el_boleto"
  /** J-Tel no firmó ese boleto. Un lector robado no puede inventar folios. */
  | "firma_no_es_de_jtel";

export interface RenglonRechazado {
  readonly paso: string;
  readonly folio: string;
  readonly motivo: MotivoDeRechazo;
}

export type ResultadoDeSincronizacion =
  | {
      readonly ok: true;
      readonly syncId: string;
      /** Los que entraron al libro ahora mismo. */
      readonly nuevos: number;
      /** Los que ya estaban: un reenvío no duplica ni levanta hallazgos. */
      readonly reenviados: number;
      readonly rechazados: readonly RenglonRechazado[];
      readonly hallazgos: readonly HallazgoDeDobleUso[];
    }
  | {
      readonly ok: false;
      readonly error: "lector_desconocido" | "lector_de_baja" | "firma_del_lote" | "entrega_simultanea";
      /** El renglón que quedó del intento, cuando se pudo escribir uno. */
      readonly syncId?: string;
    };

/** El error de llave duplicada de Postgres, que aquí significa una cosa concreta. */
const ES_DUPLICADO = (e: unknown) => (e as { cause?: { code?: string } })?.cause?.code === "23505";

export class LibroDeBoletosRepository {
  constructor(private db: Database) {}

  // ── Los lectores ───────────────────────────────────────────────────────

  /**
   * Da de alta un lector: su llave pública y el nombre que genera el sistema
   * (6.3, `validators_consecutivo_seq`).
   *
   * La llave es la identidad del aparato, así que una llave repetida es un
   * error del que la captura, no una coincidencia: dos lectores con la misma
   * llave harían que el libro no pudiera decir cuál de los dos quemó.
   */
  async altaDeLector(datos: {
    carrierAccountId: string;
    llavePublica: string;
    por?: string | null;
  }): Promise<
    | { ok: true; lector: typeof validators.$inferSelect }
    | { ok: false; error: "llave_mal_formada" | "llave_ya_registrada" }
  > {
    if (!llavePublicaBienFormada(datos.llavePublica)) {
      return { ok: false, error: "llave_mal_formada" };
    }
    try {
      return await this.db.transaction(async (tx) => {
        const [fila] = await tx.execute<{ n: number }>(
          sql`SELECT nextval('validators_consecutivo_seq')::integer AS n`,
        );
        const consecutivo = Number(fila!.n);
        const [lector] = await tx
          .insert(validators)
          .values({
            carrierAccountId: datos.carrierAccountId,
            llavePublica: datos.llavePublica,
            consecutivo,
            label: nombreDeLector(consecutivo),
            altaPor: datos.por ?? null,
          })
          .returning();
        return { ok: true as const, lector: lector! };
      });
    } catch (e) {
      if (ES_DUPLICADO(e)) return { ok: false, error: "llave_ya_registrada" };
      throw e;
    }
  }

  async lectorPorId(id: string) {
    const [lector] = await this.db.select().from(validators).where(eq(validators.id, id)).limit(1);
    return lector ?? null;
  }

  async lectorPorLlave(llavePublica: string) {
    const [lector] = await this.db
      .select()
      .from(validators)
      .where(eq(validators.llavePublica, llavePublica))
      .limit(1);
    return lector ?? null;
  }

  async lectoresDeLaCuenta(carrierAccountId: string) {
    return this.db
      .select()
      .from(validators)
      .where(eq(validators.carrierAccountId, carrierAccountId))
      .orderBy(asc(validators.consecutivo));
  }

  /**
   * Asigna un lector a una unidad, cerrando lo que estorbe — en una sola
   * transacción, igual que `assignDevice`.
   *
   * Cierra la asignación abierta del mismo lector y la de la misma unidad, cada
   * una con el motivo que escribe el sistema: quien asigna no tecleó «suelta el
   * otro», pero eso fue lo que pasó y su historia lo dice.
   */
  async asignarLector(
    validatorId: string,
    unitId: string,
    validFrom: Date = new Date(),
    por: string | null = null,
  ) {
    return this.db.transaction(async (tx) => {
      const [unidad] = await tx.select({ label: units.label }).from(units).where(eq(units.id, unitId));
      const [lector] = await tx
        .select({ label: validators.label })
        .from(validators)
        .where(eq(validators.id, validatorId));

      await tx
        .update(validatorAssignments)
        .set({
          validTo: validFrom,
          cerradaPor: por,
          motivoCierre: MOTIVO_SISTEMA.dispositivoReasignado(unidad?.label ?? unitId),
        })
        .where(
          and(isNull(validatorAssignments.validTo), eq(validatorAssignments.validatorId, validatorId)),
        );

      await tx
        .update(validatorAssignments)
        .set({
          validTo: validFrom,
          cerradaPor: por,
          motivoCierre: MOTIVO_SISTEMA.unidadRecibioOtro(lector?.label ?? validatorId),
        })
        .where(and(isNull(validatorAssignments.validTo), eq(validatorAssignments.unitId, unitId)));

      const [asignacion] = await tx
        .insert(validatorAssignments)
        .values({ validatorId, unitId, validFrom, asignadaPor: por })
        .returning();
      return asignacion!;
    });
  }

  /** Suelta un lector de su unidad. Devuelve null si no estaba montado. */
  async soltarLector(validatorId: string, datos: { at: Date; por: string | null; motivo: string }) {
    const [cerrada] = await this.db
      .update(validatorAssignments)
      .set({ validTo: datos.at, cerradaPor: datos.por, motivoCierre: datos.motivo })
      .where(
        and(isNull(validatorAssignments.validTo), eq(validatorAssignments.validatorId, validatorId)),
      )
      .returning();
    return cerrada ?? null;
  }

  /**
   * Da de baja un lector (6.5): fecha, motivo y quién. **La fila no se borra** y
   * **la llave queda revocada en el instante**: desde este commit, sus lotes se
   * rechazan y el intento queda registrado.
   *
   * Si estaba montado, se suelta en la misma transacción. Devuelve null si ya
   * estaba de baja — la condición va en el `WHERE`, así que dos bajas
   * simultáneas no se pisan el motivo.
   */
  async bajaDeLector(validatorId: string, datos: { at: Date; por: string | null; motivo: string }) {
    return this.db.transaction(async (tx) => {
      const [lector] = await tx
        .update(validators)
        .set({ bajaEn: datos.at, bajaMotivo: datos.motivo, bajaPor: datos.por })
        .where(and(eq(validators.id, validatorId), isNull(validators.bajaEn)))
        .returning();
      if (!lector) return null;

      const [soltada] = await tx
        .update(validatorAssignments)
        .set({
          validTo: datos.at,
          cerradaPor: datos.por,
          motivoCierre: MOTIVO_SISTEMA.baja(datos.motivo),
        })
        .where(
          and(isNull(validatorAssignments.validTo), eq(validatorAssignments.validatorId, validatorId)),
        )
        .returning();
      return { lector, soltada: soltada ?? null };
    });
  }

  // ── La sincronización ──────────────────────────────────────────────────

  /**
   * Recibe un lote de un lector: lo escribe en el libro y levanta el doble uso.
   *
   * ## El orden importa, y cada paso tiene su porqué
   *
   * 1. **¿Existe el lector?** Si no, no hay dónde colgar el registro —la fila de
   *    `validator_syncs` pide un lector de verdad— y se contesta sin escribir.
   * 2. **¿Está de baja?** Entonces su llave está revocada: el lote se rechaza y
   *    **el intento queda escrito**, que es lo que hace útil la revocación
   *    cuando el aparato anda en manos de alguien más.
   * 3. **¿La firma es suya?** Un lote mal formado cae aquí también: si no se
   *    puede serializar sin ambigüedad, no se puede afirmar de quién es.
   * 4. Y hasta entonces se mira renglón por renglón.
   *
   * ## Los dos candados contra las carreras
   *
   * **Por folio, un candado de Postgres** (`pg_advisory_xact_lock`), tomados en
   * orden alfabético para que dos lotes no se traben entre sí. Sin él, dos
   * lectores entregando el mismo folio al mismo tiempo no se ven —cada
   * transacción lee antes de que la otra confirme— y el doble uso se perdería
   * en silencio, que es justo lo que este PR existe para encontrar.
   *
   * **Por lector y paso, el índice único de la 0054.** Si el mismo lote entra
   * dos veces a la vez, la base rechaza la segunda entera y el lector reintenta;
   * ningún renglón se duplica y ningún hallazgo se inventa.
   */
  async recibirLote(entrada: {
    lote: LoteDelLector;
    firma: string;
    /** Contra qué se re-verifica la firma de J-Tel de cada boleto. */
    llavePublicaDeJTel: Uint8Array;
  }): Promise<ResultadoDeSincronizacion> {
    const { lote, firma } = entrada;

    const lector = await this.lectorPorId(lote.lector);
    if (!lector) return { ok: false, error: "lector_desconocido" };

    const enviados = Array.isArray(lote.pasos) ? lote.pasos.length : 0;

    if (lector.bajaEn) {
      const [registro] = await this.db
        .insert(validatorSyncs)
        .values({
          validatorId: lector.id,
          resultado: "rechazado_lector_de_baja",
          renglonesEnviados: enviados,
          renglonesRechazados: enviados,
          firma,
          detalle: { baja_en: lector.bajaEn.toISOString(), baja_motivo: lector.bajaMotivo },
        })
        .returning({ id: validatorSyncs.id });
      return { ok: false, error: "lector_de_baja", syncId: registro!.id };
    }

    if (!loteBienFormado(lote) || !verificarFirmaDelLote(lote, firma, lector.llavePublica)) {
      const [registro] = await this.db
        .insert(validatorSyncs)
        .values({
          validatorId: lector.id,
          resultado: "rechazado_firma",
          renglonesEnviados: enviados,
          renglonesRechazados: enviados,
          firma,
          detalle: { por_que: loteBienFormado(lote) ? "la_firma_no_es_del_lector" : "lote_mal_formado" },
        })
        .returning({ id: validatorSyncs.id });
      return { ok: false, error: "firma_del_lote", syncId: registro!.id };
    }

    try {
      return await this.db.transaction(async (tx) => {
        /* Los candados, en orden alfabético: el mismo orden en todas las
           transacciones es lo que evita que dos se traben una a la otra. */
        const folios = [...new Set(lote.pasos.map((p) => p.folio))].sort();
        for (const folio of folios) {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${folio}))`);
        }

        const pasos = lote.pasos.map((p) => p.paso);
        const yaEstaban = new Set(
          pasos.length === 0
            ? []
            : (
                await tx
                  .select({ paso: ticketOperations.pasoDelLector })
                  .from(ticketOperations)
                  .where(
                    and(
                      eq(ticketOperations.validatorId, lector.id),
                      inArray(ticketOperations.pasoDelLector, pasos),
                    ),
                  )
              ).map((f) => f.paso as string),
        );

        /* Dónde estaba el lector, según el PLAN, en cada instante del lote. */
        const asignaciones = await tx
          .select()
          .from(validatorAssignments)
          .where(eq(validatorAssignments.validatorId, lector.id));
        const unidadEn = (t: Date): string | null =>
          asignaciones.find(
            (a) => a.validFrom <= t && (a.validTo === null || a.validTo >= t),
          )?.unitId ?? null;

        const unidades = [
          ...new Set(lote.pasos.map((p) => unidadEn(new Date(p.cuando))).filter((u): u is string => !!u)),
        ];
        const circuitosDeUnidad =
          unidades.length === 0
            ? []
            : await tx
                .select()
                .from(circuitUnitAssignments)
                .where(inArray(circuitUnitAssignments.unitId, unidades));
        const circuitoEn = (unitId: string | null, t: Date): string | null => {
          if (!unitId) return null;
          return (
            circuitosDeUnidad.find(
              (c) => c.unitId === unitId && c.validFrom <= t && (c.validTo === null || c.validTo >= t),
            )?.circuitId ?? null
          );
        };

        const rechazados: RenglonRechazado[] = [];
        const porInsertar: Array<typeof ticketOperations.$inferInsert & { folio: string }> = [];

        for (const p of lote.pasos) {
          if (yaEstaban.has(p.paso)) continue;

          const cuando = new Date(p.cuando);
          const unidad = unidadEn(cuando);
          const comun = {
            folio: p.folio,
            validatorId: lector.id,
            unidadAsignadaId: unidad,
            circuitoAsignadoId: circuitoEn(unidad, cuando),
            conSenal: p.conSenal,
            quemadoEn: cuando,
            diaDelLector: lote.dia,
            pasoDelLector: p.paso,
          };

          if (p.via === "codigo_dictado") {
            if (p.boleto) {
              rechazados.push({ paso: p.paso, folio: p.folio, motivo: "renglon_mal_formado" });
              continue;
            }
            /* No verifica nada y por eso entra como reclamo, no como quemado. */
            porInsertar.push({ ...comun, kind: "reclamo_dictado" });
            continue;
          }

          if (!p.boleto) {
            rechazados.push({ paso: p.paso, folio: p.folio, motivo: "renglon_mal_formado" });
            continue;
          }
          /* El folio y el boleto tienen que ser el mismo viaje. La vía dictada y
             la del QR llegan a llaves distintas si nadie lo mira (lección del P3). */
          if (p.boleto.cuerpo?.folio !== p.folio) {
            rechazados.push({ paso: p.paso, folio: p.folio, motivo: "folio_no_cuadra_con_el_boleto" });
            continue;
          }
          if (!boletoLoFirmoJTel(p.boleto, entrada.llavePublicaDeJTel)) {
            rechazados.push({ paso: p.paso, folio: p.folio, motivo: "firma_no_es_de_jtel" });
            continue;
          }
          porInsertar.push({ ...comun, kind: "quemado", firmaDelBoleto: p.boleto.firmaDeJTel });
        }

        /* La entrega se escribe ANTES que los renglones: son inmutables, así
           que sus cuentas no se pueden corregir después y tienen que estar
           decididas ya. */
        const [registro] = await tx
          .insert(validatorSyncs)
          .values({
            validatorId: lector.id,
            resultado: rechazados.length > 0 ? "aceptado_con_rechazos" : "aceptado",
            renglonesEnviados: enviados,
            renglonesNuevos: porInsertar.length,
            renglonesRechazados: rechazados.length,
            firma,
            detalle: rechazados.length > 0 ? { rechazados } : {},
          })
          .returning({ id: validatorSyncs.id });
        const syncId = registro!.id;

        const insertados =
          porInsertar.length === 0
            ? []
            : await tx
                .insert(ticketOperations)
                .values(porInsertar.map((v) => ({ ...v, syncId })))
                .returning({
                  id: ticketOperations.id,
                  folio: ticketOperations.folio,
                  kind: ticketOperations.kind,
                  quemadoEn: ticketOperations.quemadoEn,
                });

        /*
         * El doble uso, renglón por renglón que entró.
         *
         * Sólo entre quemados: un reclamo dictado no prueba que alguien haya
         * subido, y llamarlo doble uso sería levantar un hallazgo sobre ocho
         * dígitos que cualquiera pudo leer en voz alta.
         */
        const hallazgos: HallazgoDeDobleUso[] = [];
        for (const fila of insertados) {
          if (fila.kind !== "quemado") continue;
          const ajenos = await tx
            .select({
              operacionId: ticketOperations.id,
              lector: ticketOperations.validatorId,
              cuando: ticketOperations.quemadoEn,
            })
            .from(ticketOperations)
            .where(
              and(
                eq(ticketOperations.folio, fila.folio),
                eq(ticketOperations.kind, "quemado"),
                ne(ticketOperations.validatorId, lector.id),
              ),
            );
          const hallazgo = hallazgoDeDobleUso(
            fila.folio,
            {
              operacionId: fila.id,
              lector: lector.id,
              cuando: fila.quemadoEn?.getTime() ?? 0,
            },
            ajenos.map((a) => ({
              operacionId: a.operacionId,
              lector: a.lector ?? "",
              cuando: a.cuando?.getTime() ?? 0,
            })),
          );
          if (hallazgo) hallazgos.push(hallazgo);
        }

        if (hallazgos.length > 0) {
          await tx.insert(ticketOperations).values(
            hallazgos.map((h) => ({
              kind: "doble_uso_detectado" as const,
              folio: h.folio,
              syncId,
              detalle: { lectores: h.lectores, operaciones: h.operaciones },
            })),
          );
        }

        return {
          ok: true as const,
          syncId,
          nuevos: insertados.length,
          reenviados: yaEstaban.size,
          rechazados,
          hallazgos,
        };
      });
    } catch (e) {
      /* El índice único de la 0054 mordió: el mismo lote entró dos veces a la
         vez. Nada se escribió; el lector reintenta y la segunda vez los ve
         como reenvío. */
      if (ES_DUPLICADO(e)) return { ok: false, error: "entrega_simultanea" };
      throw e;
    }
  }

  // ── Lo que pregunta el pase ────────────────────────────────────────────

  /**
   * De estos folios, ¿cuáles ya se quemaron?
   *
   * **Sólo los quemados, nunca los reclamos dictados.** Un reclamo es alguien
   * diciendo ocho dígitos en voz alta: si contara, quien leyera tu folio en la
   * pantalla podría dejarte sin viaje desde otro camión. El pase se queda en
   * «sin confirmar», que es la verdad.
   *
   * **No se guarda quién preguntó** (decisión de Asav, e1): esta consulta no
   * escribe nada, ni siquiera un contador.
   */
  async foliosQuemados(folios: readonly string[]): Promise<string[]> {
    if (folios.length === 0) return [];
    const filas = await this.db
      .selectDistinct({ folio: ticketOperations.folio })
      .from(ticketOperations)
      .where(
        and(inArray(ticketOperations.folio, [...folios]), eq(ticketOperations.kind, "quemado")),
      );
    return filas.map((f) => f.folio);
  }

  // ── La salud de un lector ──────────────────────────────────────────────

  /**
   * ¿Cuándo habló por última vez? Su última entrega **aceptada**, o su alta si
   * nunca ha entregado nada: un lector recién dado de alta no lleva callado
   * desde el principio de los tiempos.
   */
  async ultimoContacto(validatorId: string): Promise<Date | null> {
    const [lector] = await this.db
      .select({ altaEn: validators.altaEn })
      .from(validators)
      .where(eq(validators.id, validatorId))
      .limit(1);
    if (!lector) return null;
    const [ultima] = await this.db
      .select({ recibidoEn: validatorSyncs.recibidoEn })
      .from(validatorSyncs)
      .where(
        and(
          eq(validatorSyncs.validatorId, validatorId),
          inArray(validatorSyncs.resultado, ["aceptado", "aceptado_con_rechazos"]),
        ),
      )
      .orderBy(desc(validatorSyncs.recibidoEn))
      .limit(1);
    return ultima?.recibidoEn ?? lector.altaEn;
  }

  /**
   * ¿Este lector está mudo? La regla y el número viven en `@jtel/domain`
   * (`HORAS_DE_SERVICIO_PARA_MUDO`); aquí sólo se juntan los datos.
   *
   * El horario sale del circuito que el plan le asigna a su unidad. Sin
   * circuito no hay horario, y entonces se contesta «no se puede decir» en vez
   * de inventar una jornada.
   */
  async saludDeLector(validatorId: string, ahora: Date = new Date()): Promise<SaludDelLector | null> {
    const contacto = await this.ultimoContacto(validatorId);
    if (!contacto) return null;

    const [fila] = await this.db
      .select({
        inicioLocal: circuits.serviceStartLocal,
        finLocal: circuits.serviceEndLocal,
        zona: circuits.timeZone,
      })
      .from(validatorAssignments)
      .innerJoin(
        circuitUnitAssignments,
        and(
          eq(circuitUnitAssignments.unitId, validatorAssignments.unitId),
          isNull(circuitUnitAssignments.validTo),
        ),
      )
      .innerJoin(circuits, eq(circuits.id, circuitUnitAssignments.circuitId))
      .where(
        and(eq(validatorAssignments.validatorId, validatorId), isNull(validatorAssignments.validTo)),
      )
      .limit(1);

    const horario: HorarioDelServicio | null = fila
      ? { inicioLocal: fila.inicioLocal, finLocal: fila.finLocal, zona: fila.zona }
      : null;
    return saludDelLector({ ultimoContacto: contacto.getTime(), ahora: ahora.getTime(), horario });
  }
}
