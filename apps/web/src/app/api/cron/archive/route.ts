import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { getUmbrellaConfig } from "@/lib/umbrella-config";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { ArchiverService } from "@jtel/services";

// El archivado puede tardar (Umbrella limita a ~1 req/seg y paginamos).
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const repos = getRepos();
  const archiver = new ArchiverService(repos, getUmbrellaConfig());

  const summary = await archiver.archiveAll();
  // Dejamos rastro en los logs para poder diagnosticar (motivo exacto si un
  // carrier falla, cuántos puntos se guardaron, etc.).
  console.log("[cron/archive]", JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  return GET(request);
}
