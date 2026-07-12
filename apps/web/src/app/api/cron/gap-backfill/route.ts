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

  const now = new Date();
  const from = new Date(now.getTime() - 36 * 60 * 60_000);
  const repos = getRepos();
  const service = new GapBackfillService(repos, getUmbrellaConfig());
  const summary = await service.run({
    from,
    to: now,
    maxGapMinutes: Number(process.env.GAP_MAX_MINUTES ?? 15),
    maxGaps: Number(process.env.GAP_MAX_PER_RUN ?? 30),
  });
  console.log("[cron/gap-backfill]", JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  return GET(request);
}
