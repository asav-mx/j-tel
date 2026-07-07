import { existsSync } from "node:fs";
import { createDb, createRepositories } from "@jtel/db";
import { VerificationService } from "@jtel/services";

for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {
      /* ignore */
    }
  }
}

async function run() {
  const db = createDb(
    process.env.DATABASE_URL ?? "postgresql://jtel:jtel_dev@localhost:5432/jtel",
  );
  const repos = createRepositories(db);

  const service = new VerificationService(repos, {
    umbrellaBaseUrl:
      process.env.UMBRELLA_GPS_URL ?? "http://gps2.umbrellasoluciones.com",
    umbrellaUserId: process.env.UMBRELLA_USER_ID,
    umbrellaPassword: process.env.UMBRELLA_PASSWORD,
  });

  console.log(`[${new Date().toISOString()}] Procesando verificaciones pendientes...`);
  const results = await service.processPending();
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
