import { describe, it, expect, beforeAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  LLAVE_DE_LABORATORIO,
  crearPortador,
  emitirBoleto,
  type BoletoSellado,
} from "@jtel/domain/boleto";
import { firmarLote, type LoteDelLector, type PasoEntregado } from "@jtel/domain/sincronizacion";
import { createDb, createRepositories, ticketOperations, validatorSyncs } from "./index.js";

/** Hex a mano: `@jtel/db` no depende de las librerías de firma, y no va a empezar. */
const aHex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

/*
 * El libro de boletos y la sincronización del lector — Ontoy 3.0 · PR P3.5.
 *
 * ESCRIBEN: van contra `DATABASE_URL_TEST`, una rama desechable de Neon, nunca
 * contra producción. El candado de abajo es el mismo de las otras suites.
 *
 * ⚠ Requiere la migración 0054 aplicada en la rama de prueba.
 *
 * ## Esta suite NO limpia lo que siembra, y es a propósito
 *
 * El libro no deja borrar sus renglones —ni editarlos, ni truncar la tabla— y
 * sus referencias no caen en cascada: una unidad con viajes quemados ya no se
 * puede borrar, ni la cuenta que la contiene. Eso **es** lo que se está
 * probando, así que un `afterAll` que borrara la cuenta tendría que romper el
 * candado para poder correr.
 *
 * El precio se paga en la desechable: las filas se quedan. Cuando estorben, se
 * tira la rama entera y se vuelve a construir con las migraciones, que es lo
 * que `packages/db/ci/aplicar-migraciones.mjs` hace en cada CI.
 *
 * ## Lo que aquí no se puede probar con dobles
 *
 * El trigger que rechaza UPDATE y DELETE, los índices únicos parciales, el
 * candado por folio contra las carreras y la detección del doble uso dentro de
 * la transacción viven en la base. Un doble de `Database` los diría todos en
 * verde sin que existiera ninguno.
 */
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[libro-de-boletos] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr pruebas de integración.",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[libro-de-boletos] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Estas pruebas escriben y se niegan a correr contra producción.",
  );
}

const db = createDb(TEST_URL);
const repos = createRepositories(db);
const libro = repos.libroDeBoletos;

const marca = `b${Date.now().toString(36)}`;
const LLAVE_PUBLICA_DE_JTEL = LLAVE_DE_LABORATORIO.publica;

/** Un par de llaves de lector, distinto por corrida. */
let semilla = 0;
const parDeLector = () => crearPortador(new Uint8Array([7, 7, ++semilla, Date.now() % 251]));

let carrierId = "";
let unidadA = "";
let unidadB = "";

beforeAll(async () => {
  carrierId = (
    await repos.accounts.create({ type: "carrier", name: `Boletos ${marca}`, slug: `boletos-${marca}` })
  ).id;
  unidadA = (await repos.fleet.createUnit(carrierId, `U-${marca}-A`)).id;
  unidadB = (await repos.fleet.createUnit(carrierId, `U-${marca}-B`)).id;
});

async function altaDeLector() {
  const par = parDeLector();
  const llavePublica = aHex(par.publica);
  const r = await libro.altaDeLector({ carrierAccountId: carrierId, llavePublica, por: "prueba" });
  if (!r.ok) throw new Error(`alta falló: ${r.error}`);
  return { id: r.lector.id, label: r.lector.label, privada: par.privada, llavePublica };
}

let folios = 0;
const folioNuevo = () => `ONT-${marca}-${String(++folios).padStart(4, "0")}`;

function boletoDe(folio: string, llave = LLAVE_DE_LABORATORIO): BoletoSellado {
  const ahora = Date.now();
  return emitirBoleto(
    {
      folio,
      ruta: "cualquier-circuito",
      emitido: ahora - 60_000,
      vence: ahora + 86_400_000,
      portador: crearPortador(new Uint8Array([3, folios % 251])).publica,
    },
    llave,
  );
}

let pasos = 0;
function pasoQr(folio: string, extra: Partial<PasoEntregado> = {}): PasoEntregado {
  return {
    paso: `00000000-0000-4000-8000-${String(++pasos).padStart(12, "0")}`,
    folio,
    via: "qr",
    cuando: Date.now(),
    conSenal: false,
    boleto: boletoDe(folio),
    ...extra,
  };
}

const HOY = new Date().toISOString().slice(0, 10);

async function entregar(
  lector: { id: string; privada: Uint8Array },
  pasosDelLote: PasoEntregado[],
  opciones: { firmarCon?: Uint8Array } = {},
) {
  const lote: LoteDelLector = {
    lector: lector.id,
    dia: HOY,
    armadoEn: Date.now(),
    pasos: pasosDelLote,
  };
  const firma = firmarLote(lote, opciones.firmarCon ?? lector.privada);
  return libro.recibirLote({ lote, firma, llavePublicaDeJTel: LLAVE_PUBLICA_DE_JTEL });
}

const renglonesDe = (folio: string) =>
  db.select().from(ticketOperations).where(eq(ticketOperations.folio, folio));

describe("el alta de un lector", () => {
  it("genera su nombre con el consecutivo de la plataforma", async () => {
    const lector = await altaDeLector();
    expect(lector.label).toMatch(/^LEC-\d{3,}$/);
  });

  it("la misma llave no se registra dos veces: el libro no podría decir cuál quemó", async () => {
    const lector = await altaDeLector();
    const repetida = await libro.altaDeLector({
      carrierAccountId: carrierId,
      llavePublica: lector.llavePublica,
    });
    expect(repetida).toEqual({ ok: false, error: "llave_ya_registrada" });
  });

  it("una llave que no es una llave no entra", async () => {
    const mala = await libro.altaDeLector({ carrierAccountId: carrierId, llavePublica: "no-es-hex" });
    expect(mala).toEqual({ ok: false, error: "llave_mal_formada" });
  });
});

describe("LA PRUEBA: dos lectores queman el mismo boleto sin red", () => {
  /*
   * El caso que este PR existe para encontrar. Dentro de un aparato el doble
   * uso es absoluto —el lector recuerda lo que quemó—; entre aparatos nadie
   * puede verlo hasta que los dos sincronizan. Aquí sincronizan.
   *
   * Si alguien rompe la detección a propósito, esta prueba tiene que ponerse
   * en rojo. Dos formas realistas de romperla, y las dos la tumban:
   *   · quitar la comparación al insertar → no aparece el hallazgo;
   *   · hacer la idempotencia por folio en vez de por lector y paso → el
   *     segundo lector se vería como un reenvío y no entraría ni su renglón.
   */
  it("al sincronizar, el servidor marca el doble uso y conserva los dos pasos", async () => {
    const folio = folioNuevo();
    const boleto = boletoDe(folio);
    const lectorA = await altaDeLector();
    const lectorB = await altaDeLector();
    await libro.asignarLector(lectorA.id, unidadA, new Date(Date.now() - 3600_000), "prueba");
    await libro.asignarLector(lectorB.id, unidadB, new Date(Date.now() - 3600_000), "prueba");

    const a = await entregar(lectorA, [pasoQr(folio, { boleto, cuando: Date.now() - 60_000 })]);
    expect(a.ok).toBe(true);
    if (a.ok) {
      expect(a.nuevos).toBe(1);
      /* El primero no puede saber del segundo: todavía no existe. */
      expect(a.hallazgos).toEqual([]);
    }

    const b = await entregar(lectorB, [pasoQr(folio, { boleto, cuando: Date.now() - 30_000 })]);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.nuevos).toBe(1);
    expect(b.hallazgos).toHaveLength(1);
    expect(b.hallazgos[0]!.lectores).toEqual([lectorA.id, lectorB.id]);

    const renglones = await renglonesDe(folio);
    /* Los dos quemados siguen ahí: el cotejo levanta el hallazgo, no lo corrige. */
    expect(renglones.filter((r) => r.kind === "quemado")).toHaveLength(2);
    const hallazgo = renglones.find((r) => r.kind === "doble_uso_detectado");
    expect(hallazgo).toBeDefined();
    expect((hallazgo!.detalle as { lectores: string[] }).lectores).toEqual([lectorA.id, lectorB.id]);
    /* El hallazgo lo escribe el servidor: no es de ningún lector ni de ningún paso. */
    expect(hallazgo!.validatorId).toBeNull();
    expect(hallazgo!.pasoDelLector).toBeNull();
  });

  /*
   * La alarma falsa, que sería igual de mala: un lector que manda su lote dos
   * veces —porque se cayó la señal a la mitad— no está usando nada dos veces.
   */
  it("un reenvío del MISMO lector no duplica renglones ni inventa un hallazgo", async () => {
    const folio = folioNuevo();
    const lector = await altaDeLector();
    const paso = pasoQr(folio);

    const primera = await entregar(lector, [paso]);
    expect(primera.ok && primera.nuevos).toBe(1);

    const segunda = await entregar(lector, [paso]);
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;
    expect(segunda.nuevos).toBe(0);
    expect(segunda.reenviados).toBe(1);
    expect(segunda.hallazgos).toEqual([]);

    const renglones = await renglonesDe(folio);
    expect(renglones).toHaveLength(1);
    /* Las dos entregas sí quedan: son dos veces que el aparato habló. */
    const entregas = await db
      .select()
      .from(validatorSyncs)
      .where(eq(validatorSyncs.validatorId, lector.id));
    expect(entregas).toHaveLength(2);
  });
});

describe("el lector robado", () => {
  /*
   * La baja revoca la llave en el instante (corrección de Asav, 23-sep). Lo que
   * hace útil la revocación no es sólo rechazar: es que el intento quede
   * escrito, porque si el aparato anda en otras manos, eso es lo único que lo
   * dice.
   */
  it("un lote firmado por un lector dado de baja se rechaza, y queda el registro", async () => {
    const lector = await altaDeLector();
    await libro.asignarLector(lector.id, unidadA, new Date(), "prueba");
    const antes = await entregar(lector, [pasoQr(folioNuevo())]);
    expect(antes.ok).toBe(true);

    const baja = await libro.bajaDeLector(lector.id, {
      at: new Date(),
      por: "prueba",
      motivo: "Se perdió en la ruta",
    });
    expect(baja).not.toBeNull();
    /* La baja lo suelta de su unidad en la misma transacción. */
    expect(baja!.soltada).not.toBeNull();

    const folio = folioNuevo();
    const despues = await entregar(lector, [pasoQr(folio)]);
    expect(despues.ok).toBe(false);
    if (despues.ok) return;
    expect(despues.error).toBe("lector_de_baja");
    expect(despues.syncId).toBeDefined();

    /* Nada del lote entró al libro… */
    expect(await renglonesDe(folio)).toHaveLength(0);
    /* …y el intento sí quedó. */
    const [registro] = await db
      .select()
      .from(validatorSyncs)
      .where(eq(validatorSyncs.id, despues.syncId!));
    expect(registro!.resultado).toBe("rechazado_lector_de_baja");
    expect(registro!.renglonesEnviados).toBe(1);
    expect(registro!.renglonesNuevos).toBe(0);
  });

  it("una firma que no es del lector se rechaza, y también queda registrada", async () => {
    const lector = await altaDeLector();
    const impostor = await altaDeLector();
    const folio = folioNuevo();

    const r = await entregar(lector, [pasoQr(folio)], { firmarCon: impostor.privada });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("firma_del_lote");
    expect(await renglonesDe(folio)).toHaveLength(0);

    const [registro] = await db.select().from(validatorSyncs).where(eq(validatorSyncs.id, r.syncId!));
    expect(registro!.resultado).toBe("rechazado_firma");
  });

  it("un lector desconocido no escribe nada, ni un registro", async () => {
    const inventado = { id: "00000000-0000-4000-8000-999999999999", privada: parDeLector().privada };
    const r = await entregar(inventado, []);
    expect(r).toEqual({ ok: false, error: "lector_desconocido" });
  });

  /*
   * La segunda mitad del lector robado: su llave es suya, así que puede firmar
   * lotes legítimos. Lo que no puede es inventar folios — la firma de J-Tel no
   * la tiene.
   */
  it("un boleto que J-Tel no firmó se rechaza renglón por renglón, sin tumbar el resto del lote", async () => {
    const lector = await altaDeLector();
    const bueno = folioNuevo();
    const inventado = folioNuevo();
    const llaveDelLadron = { ...LLAVE_DE_LABORATORIO, privada: crearPortador(new Uint8Array([42])).privada };

    const r = await entregar(lector, [
      pasoQr(bueno),
      pasoQr(inventado, { boleto: boletoDe(inventado, llaveDelLadron) }),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevos).toBe(1);
    expect(r.rechazados).toHaveLength(1);
    expect(r.rechazados[0]!.motivo).toBe("firma_no_es_de_jtel");

    expect(await renglonesDe(bueno)).toHaveLength(1);
    expect(await renglonesDe(inventado)).toHaveLength(0);

    const [registro] = await db.select().from(validatorSyncs).where(eq(validatorSyncs.id, r.syncId));
    expect(registro!.resultado).toBe("aceptado_con_rechazos");
    expect(registro!.renglonesRechazados).toBe(1);
  });

  /*
   * La columna del paso es `uuid`. Un id con otra forma no se puede ni
   * consultar: sin apartarlo antes, Postgres tumba el lote entero con 22P02 y
   * el lector recibe un 500 sin saber cuál renglón lo causó — incluidos los
   * buenos que venían en el mismo lote.
   */
  it("un id de paso que no es un uuid se rechaza con su motivo, y el resto del lote entra", async () => {
    const lector = await altaDeLector();
    const bueno = folioNuevo();
    const malo = folioNuevo();

    const r = await entregar(lector, [
      pasoQr(bueno),
      pasoQr(malo, { paso: "no-soy-un-uuid" }),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevos).toBe(1);
    expect(r.rechazados).toEqual([
      { paso: "no-soy-un-uuid", folio: malo, motivo: "renglon_mal_formado" },
    ]);
    expect(await renglonesDe(bueno)).toHaveLength(1);
    expect(await renglonesDe(malo)).toHaveLength(0);
  });

  it("un folio que no cuadra con su boleto se rechaza", async () => {
    const lector = await altaDeLector();
    const folio = folioNuevo();
    const r = await entregar(lector, [pasoQr(folio, { boleto: boletoDe(folioNuevo()) })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rechazados[0]!.motivo).toBe("folio_no_cuadra_con_el_boleto");
    expect(await renglonesDe(folio)).toHaveLength(0);
  });
});

describe("lo que el libro guarda de cada quemado", () => {
  it("la unidad y el circuito que el PLAN le asignaba en ese momento", async () => {
    const lector = await altaDeLector();
    const hace2h = new Date(Date.now() - 2 * 3600_000);
    await libro.asignarLector(lector.id, unidadA, hace2h, "prueba");

    const folio = folioNuevo();
    const r = await entregar(lector, [pasoQr(folio, { cuando: Date.now() - 3600_000 })]);
    expect(r.ok).toBe(true);

    const [renglon] = await renglonesDe(folio);
    expect(renglon!.unidadAsignadaId).toBe(unidadA);
    /* Sin circuito asignado a esa unidad: null es «no consta», no un invento. */
    expect(renglon!.circuitoAsignadoId).toBeNull();
    expect(renglon!.firmaDelBoleto).toBeTruthy();
    /* Dos relojes, dos columnas: el del lector y el del servidor. */
    expect(renglon!.quemadoEn).toBeInstanceOf(Date);
    expect(renglon!.recibidoEn).toBeInstanceOf(Date);
  });

  it("un lector sin unidad deja las dos columnas en null, y el renglón entra igual", async () => {
    const lector = await altaDeLector();
    const folio = folioNuevo();
    const r = await entregar(lector, [pasoQr(folio)]);
    expect(r.ok).toBe(true);

    const [renglon] = await renglonesDe(folio);
    expect(renglon!.unidadAsignadaId).toBeNull();
    expect(renglon!.circuitoAsignadoId).toBeNull();
  });

  it("el latido: un lote sin pasos es una entrega aceptada de cero renglones", async () => {
    const lector = await altaDeLector();
    const r = await entregar(lector, []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevos).toBe(0);

    const [registro] = await db.select().from(validatorSyncs).where(eq(validatorSyncs.id, r.syncId));
    expect(registro!.resultado).toBe("aceptado");
    expect(registro!.renglonesEnviados).toBe(0);
  });
});

describe("lo que el pase puede preguntar", () => {
  it("un folio quemado sale; uno que nadie tocó, no", async () => {
    const lector = await altaDeLector();
    const quemado = folioNuevo();
    const intacto = folioNuevo();
    await entregar(lector, [pasoQr(quemado)]);

    expect(await libro.foliosQuemados([quemado, intacto])).toEqual([quemado]);
    expect(await libro.foliosQuemados([])).toEqual([]);
  });

  /*
   * La vía dictada no verifica nada. Si un reclamo confirmara el boleto, quien
   * leyera tu folio en la pantalla podría dejarte sin viaje desde otro camión.
   */
  it("un reclamo dictado NO confirma el boleto del pasajero", async () => {
    const lector = await altaDeLector();
    const folio = folioNuevo();
    const r = await entregar(lector, [
      { paso: `00000000-0000-4000-8000-${String(++pasos).padStart(12, "0")}`,
        folio, via: "codigo_dictado", cuando: Date.now(), conSenal: true },
    ]);
    expect(r.ok).toBe(true);

    const [renglon] = await renglonesDe(folio);
    expect(renglon!.kind).toBe("reclamo_dictado");
    /* Y no trae firma: ocho dígitos no son una firma. */
    expect(renglon!.firmaDelBoleto).toBeNull();
    expect(await libro.foliosQuemados([folio])).toEqual([]);
  });
});

describe("el libro no pierde renglones", () => {
  let folioFijo = "";

  beforeAll(async () => {
    const lector = await altaDeLector();
    folioFijo = folioNuevo();
    await entregar(lector, [pasoQr(folioFijo)]);
  });

  const codigoDe = (e: unknown) => (e as { cause?: { code?: string } })?.cause?.code;

  it("la base rechaza el UPDATE", async () => {
    const [renglon] = await renglonesDe(folioFijo);
    await expect(
      db.update(ticketOperations).set({ folio: "otro" }).where(eq(ticketOperations.id, renglon!.id)),
    ).rejects.toSatisfy((e) => codigoDe(e) === "JT054");
  });

  it("la base rechaza el DELETE", async () => {
    const [renglon] = await renglonesDe(folioFijo);
    await expect(
      db.delete(ticketOperations).where(eq(ticketOperations.id, renglon!.id)),
    ).rejects.toSatisfy((e) => codigoDe(e) === "JT054");
  });

  /* TRUNCATE no dispara triggers de renglón: sin su propio trigger, la tabla se
     vacía entera «sin borrar nada». */
  it("la base rechaza el TRUNCATE", async () => {
    await expect(db.execute(sql`TRUNCATE ticket_operations`)).rejects.toSatisfy(
      (e) => codigoDe(e) === "JT054",
    );
  });

  it("el registro de las entregas tampoco se edita", async () => {
    const [entrega] = await db.select().from(validatorSyncs).limit(1);
    await expect(
      db.update(validatorSyncs).set({ firma: "otra" }).where(eq(validatorSyncs.id, entrega!.id)),
    ).rejects.toSatisfy((e) => codigoDe(e) === "JT054");
  });

  /* Y la unidad que quemó boletos ya no se puede borrar: el libro manda sobre
     el plan. Es el precio de que no se pierda un renglón, y se paga. */
  it("una unidad con viajes en el libro no se puede borrar", async () => {
    const lector = await altaDeLector();
    const unidad = (await repos.fleet.createUnit(carrierId, `U-${marca}-${Date.now()}`)).id;
    await libro.asignarLector(lector.id, unidad, new Date(Date.now() - 1000), "prueba");
    await entregar(lector, [pasoQr(folioNuevo())]);

    await expect(
      db.execute(sql`DELETE FROM units WHERE id = ${unidad}::uuid`),
    ).rejects.toSatisfy((e) => codigoDe(e) === "23503");
  });
});

describe("la salud del lector", () => {
  it("recién dado de alta y sin circuito, no se puede decir si está mudo", async () => {
    const lector = await altaDeLector();
    const salud = await libro.saludDeLector(lector.id);
    expect(salud).toEqual({ estado: "no_se_puede_decir", motivo: "sin_circuito_asignado" });
  });

  it("el último contacto es su última entrega aceptada", async () => {
    const lector = await altaDeLector();
    const alta = await libro.ultimoContacto(lector.id);
    await entregar(lector, []);
    const despues = await libro.ultimoContacto(lector.id);
    expect(despues!.getTime()).toBeGreaterThanOrEqual(alta!.getTime());
  });
});
