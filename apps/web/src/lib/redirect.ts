import { NextResponse } from "next/server";

/**
 * Construye un redirect 303 hacia `path` con los query params dados.
 * 303 fuerza un GET tras un POST de formulario (patrón Post/Redirect/Get).
 * Con `skipEmpty` se omiten los params con valor vacío.
 */
export function redirectWithParams(
  request: Request,
  path: string,
  params: Record<string, string> = {},
  opts: { skipEmpty?: boolean } = {},
) {
  const url = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) {
    if (opts.skipEmpty && !value) continue;
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}
