import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { getUmbrellaConfig } from "@/lib/umbrella-config";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { VerificationService } from "@jtel/services";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const repos = getRepos();
  const service = new VerificationService(repos, getUmbrellaConfig());

  const results = await service.processPending();
  return NextResponse.json({ processed: results.length, results });
}

export async function POST(request: Request) {
  return GET(request);
}
