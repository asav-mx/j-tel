import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const repos = getRepos();
  const result = await repos.occurrences.renewRollingWindow(30);

  return NextResponse.json({
    ok: true,
    ...result,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
