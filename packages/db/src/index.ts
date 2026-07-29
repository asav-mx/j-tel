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
