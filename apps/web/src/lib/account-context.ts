import { getRepos } from "./db";
import { canAccessCarrierAccount, canAccessClientAccount } from "@jtel/auth-rbac";
import { getIdentidad } from "./auth";

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

/**
 * La cuenta sobre la que trabaja esta pantalla — **dentro de tu alcance**.
 *
 * Antes esto terminaba en `listByType(type)[0]`: **sin `?account=` tomaba la
 * primera cuenta del tipo, fuera de quien fuera**. Con un solo cliente real era
 * invisible; con dos es una fuga, y además le enseñaba a cualquiera la cuenta
 * de otro solo por no pasar el parámetro.
 *
 * Lo que cambia:
 *
 * - **Con `?account=`**, la cuenta tiene que existir, ser del tipo pedido **y
 *   estar dentro de tu alcance**. Antes bastaba con que existiera: el parámetro
 *   elegía y nadie comprobaba.
 * - **Sin `?account=`**, no se adivina. Se miran las cuentas de ese tipo que tu
 *   alcance cubre: si es **exactamente una**, esa; si son varias o ninguna,
 *   `null` — y quien llama decide qué hacer con eso.
 *
 * El default sale de **tu alcance**, no de la primera fila de la tabla. Es la
 * misma regla de los defaults que fallan abiertos, aplicada a la identidad de
 * la cuenta: la ausencia de un dato no se lee como una decisión.
 */
export async function resolveAccountByType(
  type: "carrier" | "client" | "jstaff",
  searchParams?: SearchParamsInput,
) {
  const repos = getRepos();
  const params = searchParams ? await searchParams : undefined;
  const slug = extractSlug(params);

  const { memberships } = await getIdentidad();
  const alcanza = (accountId: string) =>
    type === "carrier"
      ? canAccessCarrierAccount(memberships, accountId)
      : canAccessClientAccount(memberships, accountId);

  if (slug) {
    const account = await repos.accounts.findBySlug(slug);
    if (!account || account.type !== type) return null;
    return alcanza(account.id) ? account : null;
  }

  /*
   * Con alcance global esto lee todas las cuentas del tipo. Es correcto —ese es
   * su alcance— pero también es por lo que no se elige una sola cuando hay
   * varias: J-Staff tiene que decir cuál está mirando, no heredarla del orden
   * de la tabla.
   */
  const candidatas = (await repos.accounts.listByType(type)).filter((c) => alcanza(c.id));
  return candidatas.length === 1 ? candidatas[0]! : null;
}

export function withAccount(path: string, slug?: string | null) {
  if (!slug) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}account=${encodeURIComponent(slug)}`;
}

