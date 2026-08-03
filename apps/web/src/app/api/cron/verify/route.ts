import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigirCron } from "@/lib/guardia-cron";
import { getUmbrellaConfig } from "@/lib/umbrella-config";
import { VerificationService } from "@jtel/services";

export async function GET(request: Request) {
  const negada = exigirCron(request, "cron/verify");
  if (negada) return negada;

  const repos = getRepos();
  const service = new VerificationService(repos, getUmbrellaConfig());

  const results = await service.processPending();
  return NextResponse.json({ processed: results.length, results });
}

export async function POST(request: Request) {
  return GET(request);
}
