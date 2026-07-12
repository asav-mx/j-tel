/**
 * Etiqueta ground truth por ocurrencia (cierre de residuales).
 *
 *   OCCURRENCE_ID=<uuid> VERDICT=cumplido|no_hecho \
 *     CAUSE=threshold|kml_geofence|exclusive_steal|wrong_unit|no_trip \
 *     UNIT=<unit-uuid> NOTES="..." \
 *     pnpm --filter @jtel/services run label-residual
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "@jtel/db";

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

const CAUSES = new Set([
  "threshold",
  "kml_geofence",
  "exclusive_steal",
  "wrong_unit",
  "no_trip",
]);

async function main() {
  const occurrenceId = process.env.OCCURRENCE_ID?.trim();
  const verdict = process.env.VERDICT?.trim() as "cumplido" | "no_hecho" | undefined;
  const cause = process.env.CAUSE?.trim() || null;
  const unitId = process.env.UNIT?.trim() || null;
  const notes = process.env.NOTES?.trim() || null;
  const recordedBy = process.env.RECORDED_BY?.trim() || "label-residual";

  if (!occurrenceId || (verdict !== "cumplido" && verdict !== "no_hecho")) {
    console.error(
      "Uso: OCCURRENCE_ID=… VERDICT=cumplido|no_hecho [CAUSE=…] [UNIT=…] [NOTES=…]",
    );
    process.exit(1);
  }
  if (cause && !CAUSES.has(cause)) {
    console.error("CAUSE inválida. Usa:", [...CAUSES].join("|"));
    process.exit(1);
  }

  const db = createDb(process.env.DATABASE_URL!);
  const repos = createRepositories(db);
  const occ = await repos.occurrences.findById(occurrenceId);
  if (!occ) {
    console.error("Ocurrencia no encontrada:", occurrenceId);
    process.exit(1);
  }

  const row = await repos.occurrenceGroundTruth.upsert({
    occurrenceId,
    operatorVerdict: verdict,
    operatorUnitId: unitId,
    primaryCause: cause,
    notes,
    recordedBy,
  });

  console.log({
    occurrenceId,
    code: occ.profile?.code,
    date: occ.serviceDate,
    verdict: row.operatorVerdict,
    cause: row.primaryCause,
    unit: row.operatorUnitId,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
