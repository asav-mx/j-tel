import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { VerificationService } from "@jtel/services";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "dev-cron-secret";

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const repos = getRepos();
  const service = new VerificationService(repos, {
    umbrellaBaseUrl: process.env.UMBRELLA_GPS_BASE_URL ?? "http://gps2.umbrellasoluciones.com",
    umbrellaUserId: process.env.UMBRELLA_GPS_USERID ?? "",
    umbrellaPassword: process.env.UMBRELLA_GPS_PASSWORD ?? "",
  });

  const results = await service.processPending();
  return NextResponse.json({ processed: results.length, results });
}

export async function POST(request: Request) {
  return GET(request);
}
