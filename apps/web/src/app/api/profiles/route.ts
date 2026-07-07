import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createServiceProfileSchema } from "@jtel/domain";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createServiceProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const repos = getRepos();
  const profile = await repos.profiles.create(parsed.data);
  return NextResponse.json(profile, { status: 201 });
}
