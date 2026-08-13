import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 10 });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

export * from "./schema/index.js";
export { createRepositories, type Repositories } from "./repositories/index.js";
export { isEncryptionConfigured } from "./crypto.js";
export {
  pairLedgerEntryWithFact,
  SEALING_LEDGER_ACTIONS,
  DEFAULT_PAIRING_TOLERANCE_MS,
  type LedgerPairing,
  type PairableLedgerEntry,
} from "./ledger-pairing.js";
export {
  clasificarDiferencia,
  MINUTOS_MARCO_DISTINTO,
  type CausaDeDiferencia,
} from "./deadline-diff.js";
export {
  MAX_PARAMETROS_POR_SENTENCIA,
  filasPorSentencia,
  enLotes,
  escribirEnLotes,
} from "./lote-de-escritura.js";
export { routeWindowSizing, windowForOccurrence } from "./ventana-ocurrencia.js";
export {
  revisarHorasLimite,
  ANTICIPACION_POR_DEFECTO,
  type HoraLimiteDesalineada,
  type RevisionDeHorasLimite,
} from "./horas-limite.js";
export {
  revisarVentanas,
  agruparPorRutaTurno,
  type VentanaDesalineada,
  type RevisionDeVentanas,
  type GrupoDeVentanas,
} from "./ventanas-desalineadas.js";
/**
 * Fixture de pruebas, no de producto. Se niega a sembrar fuera de
 * `DATABASE_URL_TEST`; ver el candado dentro del archivo.
 */
export {
  sembrarEscenarioDosCarriers,
  ESCENARIO_B,
  type EscenarioDosCarriers,
} from "./escenario-dos-carriers.js";
export {
  huecosDeVentana,
  resumirUnidadDia,
  HUECO_MINUTOS_POR_DEFECTO,
  SALTO_KMH_POR_DEFECTO,
  type BloqueObservado,
  type ResumenUnidadDia,
  type HuecosDeVentana,
} from "./resumen-telemetria.js";
