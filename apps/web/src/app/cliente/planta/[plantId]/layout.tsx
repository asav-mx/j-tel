import { exigirRecurso } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";

/**
 * La puerta de una planta. Cubre las 12 pantallas que cuelgan de ella.
 *
 * La cuenta sale de **la fila de la planta**, no de `?account=`. El id es lo
 * único que aporta la petición, y un id no dice de quién es.
 *
 * Si la planta no existe, o existe y es de otra cuenta, la respuesta es **la
 * misma 404**: distinguirlas dejaría que un extraño enumere ids y aprenda qué
 * plantas existen sin ver ninguna.
 */
export default async function PlantaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = await params;
  await exigirRecurso("cliente", () => getRepos().procedencia.dePlanta(plantId));
  return <>{children}</>;
}
