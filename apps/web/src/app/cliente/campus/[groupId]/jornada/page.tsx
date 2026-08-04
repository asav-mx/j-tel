import { redirect } from "next/navigation";
import { exigirRecurso } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";

/** Ver la nota en la ruta equivalente de planta: Historial → Cierre del turno. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { groupId } = await params;
  // La cuenta sale de la fila del recurso, nunca de `?account=`.
  // Va en la PÁGINA y no solo en el layout: un redirect de layout no
  // impide que la hija se renderice, y su payload viaja igual.
  await exigirRecurso("cliente", () => getRepos().procedencia.deCampus(groupId));

  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries((await searchParams) ?? {})) {
    if (typeof v === "string") sp.set(k, v);
  }
  const qs = sp.toString();
  redirect(`/cliente/campus/${groupId}/cierre${qs ? `?${qs}` : ""}`);
}
