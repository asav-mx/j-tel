import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { IngestHealthService } from "@jtel/services";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
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
