import type { IngestAlertKind, Repositories } from "@jtel/db";

/**
 * El cotejo entre Compás y J-Tel: lo que el servidor GPS conoce contra lo que
 * la tabla de aparatos dice de quién es cada uno.
 *
 * ## Por qué existe
 *
 * El 14 de septiembre de 2026 dos aparatos de prueba transmitían a Compás y no
 * aparecían en J-Tel. No había un solo error: el servidor los tenía, la tabla
 * los tenía, y la cuenta a la que pertenecían leía de Umbrella, que ya estaba
 * muerto. Encontrarlo costó una tarde, y el síntoma —«el aparato no aparece»—
 * es idéntico al de un equipo sin señal, un IMEI mal tecleado o uno que nadie
 * dio de alta.
 *
 * Cada una de esas causas deja una huella distinta en el cruce de dos listas, y
 * este módulo las nombra. Con la alta por archivo de octubre entran 80+ de
 * golpe: el que falte tiene que decirlo el sistema, no descubrirlo alguien.
 *
 * ## Las cuatro huellas
 *
 *   · **sin dueño** — Compás lo conoce y no es de ninguna cuenta. Se configuró
 *     y se dio de alta en el servidor, pero no en J-Tel.
 *   · **otro proveedor** — Compás lo conoce, y su cuenta lee de otro lado. El
 *     caso de asav.
 *   · **fuera de Compás** — es de una cuenta en Compás, y Compás no lo tiene.
 *     No se dio de alta en el servidor, el IMEI está mal, o el usuario del
 *     repo no lo ve.
 *   · **en dos cuentas** — el mismo IMEI en dos cuentas. Sus posiciones no se
 *     escriben en ninguna: adivinar el dueño sería romper el muro entre
 *     clientes.
 *   · **de baja y transmite** — el aparato está dado de baja y Compás tiene de
 *     él una posición POSTERIOR a la baja. Volvió a servicio sin que nadie le
 *     quitara la baja, o lo tiene quien no debería.
 *
 * ## Los dados de baja no cuentan como faltantes
 *
 * Un aparato dado de baja (0036) ya no se espera en Compás, así que no entra a
 * «fuera de Compás». Sin esto, los 82 aparatos muertos de Umbrella dejaban la
 * alarma gritando para siempre, y el aparato 83 —el real— no se habría visto.
 */

export interface AparatoConDueno {
  id: string;
  imei: string | null;
  carrierAccountId: string;
  /** Desde la 0036. Un aparato dado de baja no se reparte ni se espera en Compás. */
  retiredAt?: Date | null;
}

const activo = (a: AparatoConDueno) => !a.retiredAt;

export interface Reparto {
  /** IMEI → aparato. Sólo de cuentas en Compás, y sólo los de dueño único. */
  porImei: Map<string, { id: string; carrierAccountId: string }>;
  /** IMEIs registrados en más de una cuenta, de cualquier proveedor. */
  enDosCuentas: Array<{ imei: string; cuentas: string[] }>;
}

/**
 * A qué cuenta va la posición de cada IMEI. **Esto es el muro entre clientes**:
 * Compás entrega las posiciones de toda la plataforma juntas, y lo único que
 * decide a quién pertenece cada una es esta tabla.
 */
export function repartir(aparatos: AparatoConDueno[], cuentasCompas: Set<string>): Reparto {
  const porImeiTodos = new Map<string, AparatoConDueno[]>();
  // Sólo los activos: la posición de un aparato dado de baja no se escribe en
  // vivo —está fuera de servicio— y un IMEI de baja en una cuenta y activo en
  // otra no es doble dueño, es un aparato que cambió de manos.
  for (const a of aparatos.filter(activo)) {
    if (!a.imei) continue;
    const lista = porImeiTodos.get(a.imei) ?? [];
    lista.push(a);
    porImeiTodos.set(a.imei, lista);
  }

  const porImei: Reparto["porImei"] = new Map();
  const enDosCuentas: Reparto["enDosCuentas"] = [];
  for (const [imei, lista] of porImeiTodos) {
    const cuentas = [...new Set(lista.map((a) => a.carrierAccountId))];
    if (cuentas.length > 1) {
      enDosCuentas.push({ imei, cuentas: cuentas.sort() });
      continue;
    }
    const unico = lista[0]!;
    if (cuentasCompas.has(unico.carrierAccountId)) {
      porImei.set(imei, { id: unico.id, carrierAccountId: unico.carrierAccountId });
    }
  }
  enDosCuentas.sort((a, b) => a.imei.localeCompare(b.imei));
  return { porImei, enDosCuentas };
}

export interface Cotejo {
  sinDueno: Array<{ imei: string }>;
  otroProveedor: Array<{ imei: string; carrierAccountId: string }>;
  fueraDeCompas: Array<{ imei: string; carrierAccountId: string }>;
  enDosCuentas: Array<{ imei: string; cuentas: string[] }>;
  deBajaTransmite: Array<{ imei: string; carrierAccountId: string }>;
}

/**
 * Cruza el catálogo de Compás contra la tabla de aparatos.
 *
 * Un IMEI en dos cuentas sólo se reporta como tal, no además en las otras
 * huellas: su problema es el doble dueño, y contarlo dos veces haría creer que
 * son dos problemas.
 */
export function cotejar(
  imeisEnCompas: Iterable<string>,
  aparatos: AparatoConDueno[],
  cuentasCompas: Set<string>,
  /** IMEI → hora de su última posición en Compás. Sólo para la huella de los dados de baja. */
  ultimaPosicion: Map<string, Date> = new Map(),
): Cotejo {
  const { enDosCuentas } = repartir(aparatos, cuentasCompas);
  const dobles = new Set(enDosCuentas.map((d) => d.imei));

  const duenoDe = new Map<string, string>();
  for (const a of aparatos.filter(activo)) {
    if (a.imei && !dobles.has(a.imei)) duenoDe.set(a.imei, a.carrierAccountId);
  }
  const deBaja = new Map<string, AparatoConDueno>();
  for (const a of aparatos) {
    if (a.imei && a.retiredAt && !duenoDe.has(a.imei) && !dobles.has(a.imei)) deBaja.set(a.imei, a);
  }

  const enCompas = new Set(imeisEnCompas);
  const sinDueno: Cotejo["sinDueno"] = [];
  const otroProveedor: Cotejo["otroProveedor"] = [];
  for (const imei of enCompas) {
    if (dobles.has(imei)) continue;
    // Un dado de baja en el catálogo no es «sin dueño»: tiene dueño, y está fuera
    // de servicio. Si transmite, lo dice su propia huella, abajo.
    if (deBaja.has(imei)) continue;
    const cuenta = duenoDe.get(imei);
    if (!cuenta) sinDueno.push({ imei });
    else if (!cuentasCompas.has(cuenta)) otroProveedor.push({ imei, carrierAccountId: cuenta });
  }

  /*
   * Posterior a la baja, no «tiene posición»: un aparato que transmitió y luego
   * se dio de baja conserva su última posición en Compás, y compararla sin la
   * fecha lo haría sonar para siempre por algo que pasó antes de la baja.
   */
  const deBajaTransmite: Cotejo["deBajaTransmite"] = [];
  for (const [imei, a] of deBaja) {
    const ultima = ultimaPosicion.get(imei);
    if (ultima && a.retiredAt && ultima > a.retiredAt) {
      deBajaTransmite.push({ imei, carrierAccountId: a.carrierAccountId });
    }
  }

  const fueraDeCompas: Cotejo["fueraDeCompas"] = [];
  for (const [imei, cuenta] of duenoDe) {
    if (cuentasCompas.has(cuenta) && !enCompas.has(imei)) {
      fueraDeCompas.push({ imei, carrierAccountId: cuenta });
    }
  }

  const porImei = (a: { imei: string }, b: { imei: string }) => a.imei.localeCompare(b.imei);
  return {
    sinDueno: sinDueno.sort(porImei),
    otroProveedor: otroProveedor.sort(porImei),
    fueraDeCompas: fueraDeCompas.sort(porImei),
    enDosCuentas,
    deBajaTransmite: deBajaTransmite.sort(porImei),
  };
}

/** Cuántos IMEIs se escriben en el mensaje. La lista completa va en `metadata`. */
const IMEIS_EN_EL_MENSAJE = 10;

function listaCorta(imeis: string[]): string {
  const vistos = imeis.slice(0, IMEIS_EN_EL_MENSAJE).join(", ");
  const resto = imeis.length - IMEIS_EN_EL_MENSAJE;
  return resto > 0 ? `${vistos} y ${resto} más` : vistos;
}

function porCuenta(
  lista: Array<{ imei: string; carrierAccountId: string }>,
  nombres: Map<string, string>,
): string {
  const grupos = new Map<string, string[]>();
  for (const { imei, carrierAccountId } of lista) {
    const g = grupos.get(carrierAccountId) ?? [];
    g.push(imei);
    grupos.set(carrierAccountId, g);
  }
  return [...grupos]
    .map(([cuenta, imeis]) => `${nombres.get(cuenta) ?? cuenta}: ${listaCorta(imeis)}`)
    .join(" · ");
}

function aparatos(n: number) {
  return n === 1 ? "1 aparato" : `${n} aparatos`;
}

/** Un aviso por huella: su tipo, la lista que lo abre y el texto para el humano. */
function avisosDe(cotejo: Cotejo, nombres: Map<string, string>) {
  return [
    {
      kind: "aparato_sin_dueno" as const,
      imeis: cotejo.sinDueno.map((x) => x.imei),
      lista: cotejo.sinDueno,
      mensaje: () =>
        `${aparatos(cotejo.sinDueno.length)} en Compás sin cuenta en J-Tel: ${listaCorta(cotejo.sinDueno.map((x) => x.imei))}. Dalos de alta en la flota de su cuenta.`,
    },
    {
      kind: "aparato_otro_proveedor" as const,
      imeis: cotejo.otroProveedor.map((x) => x.imei),
      lista: cotejo.otroProveedor,
      mensaje: () =>
        `${aparatos(cotejo.otroProveedor.length)} en Compás, pero su cuenta lee de otro proveedor y no los ve: ${porCuenta(cotejo.otroProveedor, nombres)}.`,
    },
    {
      kind: "aparato_fuera_de_compas" as const,
      imeis: cotejo.fueraDeCompas.map((x) => x.imei),
      lista: cotejo.fueraDeCompas,
      mensaje: () =>
        `${aparatos(cotejo.fueraDeCompas.length)} de cuentas en Compás que Compás no tiene: ${porCuenta(cotejo.fueraDeCompas, nombres)}. Falta darlos de alta en el servidor, el IMEI está mal, o el usuario del repo no los ve.`,
    },
    {
      kind: "imei_en_dos_cuentas" as const,
      imeis: cotejo.enDosCuentas.map((x) => x.imei),
      lista: cotejo.enDosCuentas,
      mensaje: () =>
        `${aparatos(cotejo.enDosCuentas.length)} con el mismo IMEI en más de una cuenta: ${cotejo.enDosCuentas
          .map((d) => `${d.imei} (${d.cuentas.map((c) => nombres.get(c) ?? c).join(" y ")})`)
          .join(", ")}. Sus posiciones no se escriben en ninguna hasta que se aclare.`,
    },
    {
      kind: "aparato_de_baja_transmite" as const,
      imeis: cotejo.deBajaTransmite.map((x) => x.imei),
      lista: cotejo.deBajaTransmite,
      mensaje: () =>
        `${aparatos(cotejo.deBajaTransmite.length)} dados de baja volvieron a transmitir a Compás: ${porCuenta(cotejo.deBajaTransmite, nombres)}. Si volvió a servicio, quítale la baja; si no, alguien trae un aparato que no debería.`,
    },
  ] satisfies Array<{ kind: IngestAlertKind; imeis: string[]; lista: unknown[]; mensaje: () => string }>;
}

export interface ResumenCotejo {
  sinDueno: number;
  otroProveedor: number;
  fueraDeCompas: number;
  enDosCuentas: number;
  deBajaTransmite: number;
  avisosAbiertos: number;
  avisosCerrados: number;
  /** Presente si escribir los avisos falló. El cotejo sí se hizo. */
  error?: string;
}

/**
 * Deja `ingest_alerts` diciendo lo mismo que el cotejo, **escribiendo sólo
 * cuando algo cambia**.
 *
 * Corre cada minuto. Si abriera un aviso por corrida, la pantalla se llenaría
 * de copias y nadie leería la de hoy. Por eso cada aviso guarda su `firma` —la
 * lista de IMEIs— y sólo se reemplaza si la lista cambió: un aparato nuevo sin
 * dueño abre un aviso nuevo; el mismo aparato sin dueño una hora después, no.
 * Cuando la huella desaparece, el aviso se cierra solo.
 *
 * Nunca lanza. Si la base no conoce todavía los tipos nuevos —el código se
 * desplegó antes de aplicar la 0035—, el error sale en el resumen y el
 * recolector sigue escribiendo posiciones.
 */
export async function sincronizarAvisos(
  repos: Repositories,
  cotejo: Cotejo,
  nombres: Map<string, string>,
): Promise<ResumenCotejo> {
  const resumen: ResumenCotejo = {
    sinDueno: cotejo.sinDueno.length,
    otroProveedor: cotejo.otroProveedor.length,
    fueraDeCompas: cotejo.fueraDeCompas.length,
    enDosCuentas: cotejo.enDosCuentas.length,
    deBajaTransmite: cotejo.deBajaTransmite.length,
    avisosAbiertos: 0,
    avisosCerrados: 0,
  };

  try {
    for (const aviso of avisosDe(cotejo, nombres)) {
      const abierta = await repos.ingestAlerts.findOpenByKind(aviso.kind);
      const firma = [...aviso.imeis].sort().join(",");

      if (aviso.imeis.length === 0) {
        if (abierta) {
          await repos.ingestAlerts.resolveOpen(aviso.kind);
          resumen.avisosCerrados += 1;
        }
        continue;
      }

      const firmaAbierta = (abierta?.metadata as { firma?: unknown } | null | undefined)?.firma;
      if (abierta && firmaAbierta === firma) continue;

      if (abierta) {
        await repos.ingestAlerts.resolveOpen(aviso.kind);
        resumen.avisosCerrados += 1;
      }
      await repos.ingestAlerts.create({
        carrierAccountId: null,
        kind: aviso.kind,
        severity: "warning",
        message: aviso.mensaje(),
        metadata: { firma, aparatos: aviso.lista },
      });
      resumen.avisosAbiertos += 1;
    }
  } catch (err) {
    resumen.error = err instanceof Error ? err.message : String(err);
  }

  return resumen;
}
