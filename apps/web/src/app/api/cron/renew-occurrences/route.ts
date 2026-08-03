import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigirCron } from "@/lib/guardia-cron";

export async function GET(request: Request) {
  const negada = exigirCron(request, "cron/renew-occurrences");
  if (negada) return negada;

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
