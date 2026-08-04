import { redirect } from "next/navigation";
import { exigirRecurso } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";

/**
 * El antiguo Historial (antes "Jornada") vive ahora dentro de Cierre del turno.
 *
 * No se perdió nada: el mapa de contraste esperado-vs-observado sigue ahí, pero
 * deja de ser la portada. La portada es el resultado del turno, ya dado; el mapa
 * dibuja solo lo que tiene excepción y lo limpio se enciende a demanda.
 *
 * La redirección conserva la fecha, el turno y la cuenta para que un enlace
 * viejo siga llevando exactamente al mismo día.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ plantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plantId } = await params;
  // La cuenta sale de la fila del recurso, nunca de `?account=`.
  // Va en la PÁGINA y no solo en el layout: un redirect de layout no
  // impide que la hija se renderice, y su payload viaja igual.
  await exigirRecurso("cliente", () => getRepos().procedencia.dePlanta(plantId));

  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries((await searchParams) ?? {})) {
    if (typeof v === "string") sp.set(k, v);
  }
  const qs = sp.toString();
  redirect(`/cliente/planta/${plantId}/cierre${qs ? `?${qs}` : ""}`);
}
