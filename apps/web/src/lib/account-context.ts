import { getRepos } from "./db";

type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

function extractSlug(searchParams: Awaited<SearchParamsInput>): string | undefined {
  const account = searchParams?.account;
  if (typeof account === "string" && account.trim().length > 0) {
    return account.trim();
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

