import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { getUmbrellaConfig } from "@/lib/umbrella-config";
import { VerificationService } from "@jtel/services";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repos = getRepos();
  const service = new VerificationService(repos, getUmbrellaConfig());

  const result = await service.verifyOccurrence(id);
  return NextResponse.json(result);
}
