import type { Repositories } from "@jtel/db";
import {
  efectoDeRegla,
  faltantesDeRegla,
  localDateIso,
  type PiezaDeRegla,
  type ReglaDeTipo,
} from "@jtel/domain";

/**
 * El catálogo de documentos visto desde J-Staff (D2 de `docs/Ficha-Expedientes.md`).
 *
 * El catálogo es la ley de un mercado: qué papel se exige, si vence, cada
 * cuánto y con cuántos días de aviso. Lo carga J-Staff; cambiar una regla agrega
 * una versión con su autor y su nota, y no reescribe el pasado (la base rechaza
 * el UPDATE desde la 0038).
 *
 * Nada de aquí escribe. Revisar el efecto de una regla es una lectura: se juzgan
 * los papeles del mercado con la regla actual y con la propuesta, y se cuentan.
 */

type Repos = Pick<Repositories, "expedientes">;

export interface TipoDelCatalogo {
  id: string;
  clave: string;
  nombre: string;
  sujeto: "unidad" | "chofer";
  regla: ReglaDeTipo | null;
  /** Lo que le falta a la regla para juzgar. Vacío = completa. */
  faltan: PiezaDeRegla[];
}

export interface Catalogo {
  mercados: Array<{ id: string; nombre: string; clave: string; cuentas: number }>;
  /** El mercado que se muestra; `null` si hay varios y no se eligió ninguno. */
  mercado: { id: string; nombre: string; clave: string; cuentas: number } | null;
  unidad: TipoDelCatalogo[];
  chofer: TipoDelCatalogo[];
}

const claveDe = (m: { countryCode: string; stateCode: string; municipality: string | null }) =>
  [`${m.countryCode}-${m.stateCode}`, m.municipality].filter(Boolean).join(" · ");

export async function cargarCatalogo(repos: Repos, entrada: { marketId: string | null }): Promise<Catalogo> {
  const filas = await repos.expedientes.mercados();
  const mercados = filas.map((m) => ({ id: m.id, nombre: m.name, clave: claveDe(m), cuentas: Number(m.cuentas) }));
  const mercado =
    mercados.find((m) => m.id === entrada.marketId) ?? (mercados.length === 1 ? mercados[0]! : null);
  if (!mercado) return { mercados, mercado: null, unidad: [], chofer: [] };

  const [unidad, chofer] = await Promise.all(
    (["unidad", "chofer"] as const).map(async (sujeto) =>
      (await repos.expedientes.catalogo(mercado.id, sujeto)).map(
        ({ tipo, regla }): TipoDelCatalogo => ({
          id: tipo.id,
          clave: tipo.clave,
          nombre: tipo.name,
          sujeto,
          regla,
          faltan: faltantesDeRegla(regla),
        }),
      ),
    ),
  );
  return { mercados, mercado, unidad: unidad!, chofer: chofer! };
}

export interface ReglaDeUnTipo {
  tipo: { id: string; clave: string; nombre: string; sujeto: "unidad" | "chofer" };
  mercado: { id: string; nombre: string; clave: string; zonaHoraria: string };
  regla: ReglaDeTipo | null;
  faltan: PiezaDeRegla[];
  historial: Array<{
    id: string;
    regla: ReglaDeTipo;
    nota: string | null;
    actorKind: string;
    actorId: string | null;
    guardadaAt: Date;
  }>;
  /** Cuántos sujetos juzga en su mercado, y de qué cuentas. */
  juzga: { sujetos: number; cuentas: string[] };
}

export async function cargarReglaDeUnTipo(repos: Repos, entrada: { documentTypeId: string }): Promise<ReglaDeUnTipo | null> {
  const [datos, historial] = await Promise.all([
    repos.expedientes.sujetosDelTipo(entrada.documentTypeId),
    repos.expedientes.historialDeRegla(entrada.documentTypeId),
  ]);
  if (!datos) return null;
  const vigente = historial[0];
  const regla: ReglaDeTipo | null = vigente
    ? {
        obligatorio: vigente.required,
        vence: vigente.expires,
        diasDeAviso: vigente.warningDays,
        periodicidadMeses: vigente.periodicityMonths,
      }
    : null;
  return {
    tipo: { id: datos.tipo.id, clave: datos.tipo.clave, nombre: datos.tipo.name, sujeto: datos.tipo.subject },
    mercado: {
      id: datos.mercado.id,
      nombre: datos.mercado.name,
      clave: claveDe(datos.mercado),
      zonaHoraria: datos.mercado.timeZone,
    },
    regla,
    faltan: faltantesDeRegla(regla),
    historial: historial.map((h) => ({
      id: h.id,
      regla: { obligatorio: h.required, vence: h.expires, diasDeAviso: h.warningDays, periodicidadMeses: h.periodicityMonths },
      nota: h.note,
      actorKind: h.actorKind,
      actorId: h.actorId,
      guardadaAt: h.createdAt,
    })),
    juzga: {
      sujetos: datos.sujetos.length,
      cuentas: [...new Set(datos.sujetos.map((s) => s.cuenta))].sort((a, b) => a.localeCompare(b, "es")),
    },
  };
}

export async function revisarEfectoDeRegla(
  repos: Repos,
  entrada: { documentTypeId: string; propuesta: ReglaDeTipo; ahora: Date },
) {
  const [datos, actual] = await Promise.all([
    repos.expedientes.sujetosDelTipo(entrada.documentTypeId),
    repos.expedientes.reglaVigente(entrada.documentTypeId),
  ]);
  if (!datos) return null;
  const hoy = localDateIso(entrada.ahora, datos.mercado.timeZone);
  const efecto = efectoDeRegla({
    actual,
    propuesta: entrada.propuesta,
    hoy,
    fojas: datos.sujetos.map((s) =>
      s.version
        ? {
            folio: s.version.folio,
            emitidoEl: s.version.issuedOn,
            venceEl: s.version.expiresOn,
            venceCalculado: s.version.expiryCalculated,
          }
        : null,
    ),
  });
  return {
    actual,
    hoy,
    sujetos: datos.sujetos.length,
    cuentas: [...new Set(datos.sujetos.map((s) => s.cuenta))].sort((a, b) => a.localeCompare(b, "es")),
    ...efecto,
  };
}
