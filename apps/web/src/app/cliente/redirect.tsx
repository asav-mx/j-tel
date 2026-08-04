import { redirect } from "next/navigation";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

export default async function ClienteCorporateRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se resuelve ni la cuenta a la que redirigir: `resolveAccountByType`
  // toca la base, y esto corre antes de cualquier lectura.
  await exigirSesion();

  const client = await resolveAccountByType("client", searchParams);
  redirect(withAccount("/cliente", client?.slug));
}
