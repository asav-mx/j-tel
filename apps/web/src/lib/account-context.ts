import { getRepos } from "./db";

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

function cleanAccountSlug(raw: string): string {
  // Chat/Glass often turn ?account=tecma&fecha=… into account=tecma%26fecha%3D…,
  // so the value becomes "tecma&fecha=2026-07-09" (or similar). Keep only the slug.
  return raw.trim().split("&")[0]?.split("#")[0]?.trim() ?? "";
}

function extractSlug(searchParams: Awaited<SearchParamsInput>): string | undefined {
  const account = searchParams?.account;
  if (typeof account === "string" && account.trim().length > 0) {
    const slug = cleanAccountSlug(account);
    if (slug) return slug;
  }

  // Some chat clients / copy-paste turn ?account=tecma into ?account%3Dtecma, which
  // Next parses as a single key "account=tecma" with an empty value.
  if (searchParams) {
    for (const key of Object.keys(searchParams)) {
      const match = key.match(/^account=(.+)$/);
      if (match?.[1]?.trim()) {
        const slug = cleanAccountSlug(match[1]);
        if (slug) return slug;
      }
    }
  }

  return undefined;
}

export async function resolveAccountByType(
  type: "carrier" | "client" | "jstaff",
  searchParams?: SearchParamsInput,
) {
  const repos = getRepos();
  const params = searchParams ? await searchParams : undefined;
  const slug = extractSlug(params);

  if (slug) {
    const account = await repos.accounts.findBySlug(slug);
    if (account?.type === type) return account;
  }

  const accounts = await repos.accounts.listByType(type);
  return accounts[0] ?? null;
}

export function withAccount(path: string, slug?: string | null) {
  if (!slug) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}account=${encodeURIComponent(slug)}`;
}

