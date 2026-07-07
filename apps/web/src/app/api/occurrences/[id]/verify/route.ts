import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { VerificationService } from "@jtel/services";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repos = getRepos();
  const service = new VerificationService(repos, {
    umbrellaBaseUrl: process.env.UMBRELLA_GPS_BASE_URL ?? "http://gps2.umbrellasoluciones.com",
    umbrellaUserId: process.env.UMBRELLA_GPS_USERID ?? "",
    umbrellaPassword: process.env.UMBRELLA_GPS_PASSWORD ?? "",
  });

  const result = await service.verifyOccurrence(id);
  return NextResponse.json(result);
}
