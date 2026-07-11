import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { getUmbrellaConfig } from "@/lib/umbrella-config";
import { GapBackfillService } from "@jtel/services";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "dev-cron-secret";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const repos = getRepos();
  const svc = new GapBackfillService(repos, getUmbrellaConfig(), {
    gapMinutes: 15,
    lookbackHours: 6,
    maxGapsPerRun: 6,
  });
  const summary = await svc.fillGaps();
  console.log("[cron/gap-backfill]", JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  return GET(request);
}
