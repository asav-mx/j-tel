import { redirect } from "next/navigation";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function ClienteCorporateRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await resolveAccountByType("client", searchParams);
  redirect(withAccount("/cliente", client?.slug));
}
