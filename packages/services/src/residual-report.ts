/**
 * Inventario de no_cumplido residuales (match A∧B, no memoria).
 *
 *   SERVICE_DATE=2026-07-09,2026-07-10 CONTRACT=campus \
 *     pnpm --filter @jtel/services run residual-report
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "@jtel/db";
import { sql } from "drizzle-orm";

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

type Caja = "near_miss" | "cold";

function classify(a: number | null, b: number | null, minA: number, minB: number): Caja {
  if (a == null || b == null) return "cold";
  const gapA = minA - a;
  const gapB = minB - b;
  // Near-miss: al menos una métrica a ≤10 pts del umbral y la otra no está muerta (<15).
  const aNear = gapA <= 10;
  const bNear = gapB <= 10;
  const aAlive = a >= 15;
  const bAlive = b >= 15;
  // Caso especial: B≈100 y A bajo → "colgado en geocerca", frío.
  if (b >= 95 && a < minA - 5) return "cold";
  if ((aNear || bNear) && aAlive && bAlive) return "near_miss";
  if (aNear && aAlive) return "near_miss";
  if (bNear && bAlive) return "near_miss";
  return "cold";
}

async function main() {
  const contractEnv = process.env.CONTRACT?.trim();
  if (!contractEnv) {
    console.error(
      "ERROR: Define CONTRACT=<nombre_o_fragmento>.\n" +
        "Ejemplo: CONTRACT=campus SERVICE_DATE=2026-07-22 pnpm --filter @jtel/services run residual-report\n" +
        "El alcance debe ser explícito — no hay valor por defecto.",
    );
    process.exit(1);
  }
  const filter = contractEnv.toLowerCase();
  const dates = (process.env.SERVICE_DATE ?? "2026-07-09,2026-07-10")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  if (dates.length === 0) {
    console.error("Falta SERVICE_DATE=YYYY-MM-DD[,YYYY-MM-DD]");
    process.exit(1);
  }

  const db = createDb(process.env.DATABASE_URL!);
  const repos = createRepositories(db);
  const clients = await repos.accounts.listByType("client");
  const contracts = [];
  for (const c of clients) {
    contracts.push(...(await repos.contracts.findForClient(c.id)));
  }
  const contract = contracts.find((c) => {
    const hay = `${c.name ?? ""} ${c.id}`.toLowerCase();
    return filter.split("|").some((f) => hay.includes(f.trim()));
  });
  if (!contract) {
    console.error("Contrato no encontrado:", filter);
    process.exit(1);
  }

  const policy = contract.policy;
  const minA = policy.kmlMatchMinPct ?? 40;
  const minB = policy.kmlCorridorMinPct ?? 60;

  console.log(
    `Residual report · ${contract.name}\n` +
      `umbrales A≥${minA} B≥${minB} corredor ${policy.kmlCorridorMeters ?? 120} m\n`,
  );
  console.log(
    [
      "fecha",
      "codigo",
      "caja",
      "A",
      "B",
      "gapA",
      "gapB",
      "cov%",
      "pts",
      "occurrenceId",
    ].join("\t"),
  );

  let near = 0;
  let cold = 0;

  for (const day of dates) {
    const rows = await db.execute(sql`
      SELECT so.id AS occurrence_id,
             so.service_date,
             sp.code,
             sp.name,
             le.metadata->>'pointCount' AS pts,
             (
               SELECT (s->'details'->>'coveragePct')::float
               FROM jsonb_array_elements(le.steps) s
               WHERE s->>'step' = 'cobertura_evidencia'
               LIMIT 1
             ) AS cov_pct,
             (
               SELECT (s->'details'->>'routeMatchPct')::float
               FROM jsonb_array_elements(le.steps) s
               WHERE s->>'step' = 'candidata'
                 AND (s->'details'->>'arrivalAt') IS NOT NULL
               ORDER BY LEAST(
                 COALESCE((s->'details'->>'routeMatchPct')::numeric, 0),
                 COALESCE((s->'details'->>'corridorPrecisionPct')::numeric, 0)
               ) DESC
               LIMIT 1
             ) AS best_a,
             (
               SELECT (s->'details'->>'corridorPrecisionPct')::float
               FROM jsonb_array_elements(le.steps) s
               WHERE s->>'step' = 'candidata'
                 AND (s->'details'->>'arrivalAt') IS NOT NULL
               ORDER BY LEAST(
                 COALESCE((s->'details'->>'routeMatchPct')::numeric, 0),
                 COALESCE((s->'details'->>'corridorPrecisionPct')::numeric, 0)
               ) DESC
               LIMIT 1
             ) AS best_b
      FROM compliance_facts cf
      JOIN service_occurrences so ON so.id = cf.service_occurrence_id
      JOIN service_profiles sp ON sp.id = so.service_profile_id
      LEFT JOIN LATERAL (
        SELECT steps, metadata FROM ledger_entries
        WHERE service_occurrence_id = so.id
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
      ) le ON true
      WHERE so.service_date = ${day}
        AND sp.contract_id = ${contract.id}
        AND cf.status = 'no_cumplido'
      ORDER BY sp.code
    `);

    const list = (rows as { rows?: Record<string, unknown>[] }).rows ?? (rows as Record<string, unknown>[]);
    for (const r of list) {
      const a = r.best_a == null ? null : Number(r.best_a);
      const b = r.best_b == null ? null : Number(r.best_b);
      const caja = classify(a, b, minA, minB);
      if (caja === "near_miss") near += 1;
      else cold += 1;
      const gapA = a == null ? "" : (minA - a).toFixed(1);
      const gapB = b == null ? "" : (minB - b).toFixed(1);
      console.log(
        [
          String(r.service_date),
          String(r.code),
          caja,
          a == null ? "" : a.toFixed(1),
          b == null ? "" : b.toFixed(1),
          gapA,
          gapB,
          r.cov_pct == null ? "" : Number(r.cov_pct).toFixed(0),
          r.pts ?? "",
          String(r.occurrence_id),
        ].join("\t"),
      );
    }
  }

  console.log(`\nResumen: near_miss=${near} cold=${cold} total=${near + cold}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
