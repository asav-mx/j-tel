import { redirect } from "next/navigation";

/** Ver la nota en la ruta equivalente de planta: Historial → Cierre del turno. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { groupId } = await params;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries((await searchParams) ?? {})) {
    if (typeof v === "string") sp.set(k, v);
  }
  const qs = sp.toString();
  redirect(`/cliente/campus/${groupId}/cierre${qs ? `?${qs}` : ""}`);
}
