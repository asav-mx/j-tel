import { redirect } from "next/navigation";
import { destinoDeLaDireccionVieja } from "@/lib/casa/archivero";

/**
 * Dispositivos dejó de ser lugar del menú el 19-sep: vive como cajón del
 * archivero de Expedientes (ficha V2 §4). La dirección vieja no se deja muerta:
 * redirige al cajón con todo lo que traía —la cuenta, el panel de alta abierto,
 * el «hecho» de un alta recién hecha—.
 */
export default async function DispositivosSeMudo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(destinoDeLaDireccionVieja(await searchParams));
}
