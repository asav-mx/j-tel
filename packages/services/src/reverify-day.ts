/**
 * Re-verifica un día de un contrato: re-ingere evidencia desde memoria y
 * aplica asignación exclusiva de unidades (calles compartidas).
 *
 * Uso:
 *   SERVICE_DATE=2026-07-09 CONTRACT=campus \
 *     pnpm --filter @jtel/services exec tsx src/reverify-day.ts
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "@jtel/db";
import { VerificationService } from "./verification.js";

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

function normalizeUmbrellaBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return /\/openapi$/i.test(trimmed) ? trimmed : `${trimmed}/openapi`;
}

async function main() {
  const serviceDate = process.env.SERVICE_DATE;
  if (!serviceDate) {
    console.error("Falta SERVICE_DATE=YYYY-MM-DD");
    process.exit(1);
  }

  const db = createDb(process.env.DATABASE_URL!);
  const repos = createRepositories(db);

  const contractIdEnv = process.env.CONTRACT_ID?.trim();
  const contractEnv = process.env.CONTRACT?.trim();
  if (!contractIdEnv && !contractEnv) {
    console.error(
      "ERROR: Define CONTRACT=<nombre_o_fragmento> o CONTRACT_ID=<uuid>.\n" +
        "Ejemplo: CONTRACT=campus SERVICE_DATE=2026-07-22 pnpm --filter @jtel/services exec tsx src/reverify-day.ts\n" +
        "El alcance debe ser explícito — no hay valor por defecto.",
    );
    process.exit(1);
  }
  const filter = contractEnv?.toLowerCase() ?? "";
  const clients = await repos.accounts.listByType("client");
  const contracts = [];
  for (const client of clients) {
    const list = await repos.contracts.findForClient(client.id);
    contracts.push(...list);
  }

  const contract = contractIdEnv
    ? (contracts.find((c) => c.id === contractIdEnv) ?? null)
    : (contracts.find((c) => {
        const hay = `${c.name ?? ""} ${c.plantGroup?.name ?? ""} ${c.plant?.name ?? ""}`.toLowerCase();
        return filter.split("|").some((f) => hay.includes(f.trim()));
      }) ?? null);

  if (!contract) {
    console.error(
      "No se encontró contrato. Contratos:",
      contracts.map((c) => `${c.id.slice(0, 8)}… ${c.name} / ${c.plantGroup?.name ?? c.plant?.name ?? "?"}`),
    );
    process.exit(1);
  }

  console.log(
    `Re-verificando ${contract.name} (${contract.plantGroup?.name ?? contract.plant?.name ?? ""}) · ${serviceDate}`,
  );
  console.log("force + keepEvidence:false + exclusiveUnits");

  const svc = new VerificationService(repos);

  const results = await svc.reverifyContract(contract.id, {
    serviceDate,
    keepEvidence: false,
    exclusiveUnits: true,
    actorKind: "system:cli",
    actorId: null,
    actorIntent: "decision",
  });

  const byStatus = new Map<string, number>();
  for (const r of results) {
    const s = String((r as { status?: string }).status ?? "error");
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
  }
  console.log("\nResumen:", Object.fromEntries(byStatus));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
