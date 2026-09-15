import { existsSync } from "node:fs";
import { createDb, createRepositories, pedirAplicar } from "@jtel/db";
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
  /*
   * Esto SELLA veredictos: los servicios pendientes cuya hora ya pasó reciben
   * su hecho. En producción eso ya lo hace el cron `/api/cron/verify` cada
   * minuto con el código desplegado; correr este worker a mano contra la misma
   * base sella con el código de tu máquina, que puede no ser el mismo.
   */
  const destino = process.env.DATABASE_URL ?? "postgresql://jtel:jtel_dev@localhost:5432/jtel";
  if (
    !pedirAplicar({
      guion: "worker",
      queEscribe:
        "SELLA veredictos de los servicios pendientes (processPending). En producción ya lo hace el cron /api/cron/verify.",
      url: destino,
    })
  ) {
    process.exit(0);
  }
  const db = createDb(destino);
  const repos = createRepositories(db);

  const service = new VerificationService(repos);

  console.log(`[${new Date().toISOString()}] Procesando verificaciones pendientes...`);
  const results = await service.processPending();
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
