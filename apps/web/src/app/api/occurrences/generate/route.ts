import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { profileId, fromDate, toDate } = body as {
    profileId: string;
    fromDate: string;
    toDate: string;
  };

  if (!profileId || !fromDate || !toDate) {
    return NextResponse.json({ error: "Parámetros requeridos" }, { status: 400 });
  }

  const repos = getRepos();
  const created = await repos.occurrences.generateForProfile(
    profileId,
    new Date(fromDate),
    new Date(toDate),
  );

  return NextResponse.json({ created: created.length, ids: created });
}
