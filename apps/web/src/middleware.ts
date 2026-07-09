import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Corrige ?account%3Dtecma → ?account=tecma (links rotos al copiar desde chat). */
function cleanedAccountUrl(url: URL): URL | null {
  if (url.searchParams.get("account")) return null;

  const fixed = new URL(url.toString());

  for (const key of [...fixed.searchParams.keys()]) {
    const match = key.match(/^account=(.+)$/);
    if (match?.[1]?.trim()) {
      fixed.searchParams.delete(key);
      fixed.searchParams.set("account", match[1].trim());
      return fixed;
    }
  }

  const raw = fixed.search.slice(1);
  const encodedPrefix = "account%3D";
  if (raw.toLowerCase().startsWith(encodedPrefix)) {
    const slug = decodeURIComponent(raw.slice(encodedPrefix.length)).replace(/=+$/, "");
    if (slug.trim()) {
      fixed.search = `?account=${encodeURIComponent(slug.trim())}`;
      return fixed;
    }
  }

  return null;
}

export function middleware(request: NextRequest) {
  const cleaned = cleanedAccountUrl(request.nextUrl);
  if (cleaned && cleaned.href !== request.nextUrl.href) {
    return NextResponse.redirect(cleaned);
  }
}

export const config = {
  matcher: ["/cliente/:path*", "/carrier/:path*"],
};
