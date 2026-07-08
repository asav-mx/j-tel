import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { getUmbrellaConfig } from "@/lib/umbrella-config";
import { ArchiverService } from "@jtel/services";

// El archivado puede tardar (Umbrella limita a ~1 req/seg y paginamos).
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "dev-cron-secret";

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const repos = getRepos();
  const archiver = new ArchiverService(repos, getUmbrellaConfig());

  const summary = await archiver.archiveAll();
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  return GET(request);
}
