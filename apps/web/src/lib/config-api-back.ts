import type { OperationalScope } from "@jtel/domain";
import { configApiRedirectPath, type ConfigRedirectStep } from "@/lib/unit-routes";
import { redirectWithParams } from "@/lib/redirect";

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
  return redirectWithParams(request, path, params);
}
