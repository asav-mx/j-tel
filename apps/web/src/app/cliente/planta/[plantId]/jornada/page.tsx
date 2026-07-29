import { redirect } from "next/navigation";

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
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries((await searchParams) ?? {})) {
    if (typeof v === "string") sp.set(k, v);
  }
  const qs = sp.toString();
  redirect(`/cliente/planta/${plantId}/cierre${qs ? `?${qs}` : ""}`);
}
