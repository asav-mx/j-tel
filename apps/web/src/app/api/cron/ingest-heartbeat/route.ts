import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigirCron } from "@/lib/guardia-cron";
import { IngestHealthService } from "@jtel/services";

export async function GET(request: Request) {
  const negada = exigirCron(request, "cron/ingest-heartbeat");
  if (negada) return negada;

  const repos = getRepos();
  const health = new IngestHealthService(repos);
  const summary = await health.checkHeartbeat();
  console.log("[cron/ingest-heartbeat]", JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  return GET(request);
}
