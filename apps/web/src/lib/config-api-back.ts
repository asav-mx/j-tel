import { NextResponse } from "next/server";
import type { OperationalScope } from "@jtel/domain";
import { configApiRedirectPath, type ConfigRedirectStep } from "@/lib/unit-routes";

export function configApiBack(
  request: Request,
  slug: string,
  step: ConfigRedirectStep,
  scope: OperationalScope | null,
  params: Record<string, string>,
) {
  const path = scope
    ? configApiRedirectPath(scope, slug, step)
    : `/cliente?account=${encodeURIComponent(slug)}`;
  const url = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}
