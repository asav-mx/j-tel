import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { IngestHealthService } from "@jtel/services";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "dev-cron-secret";

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const repos = getRepos();
  const health = new IngestHealthService(repos);
  const summary = await health.checkHeartbeat();
  console.log("[cron/ingest-heartbeat]", JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  return GET(request);
}
