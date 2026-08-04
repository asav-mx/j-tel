import { exigirRecurso } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";

/**
 * La puerta de un campus. Cubre las 12 pantallas que cuelgan de él.
 *
 * Mismo criterio que la planta: la cuenta sale de la fila del grupo, y
 * «no existe» y «no es tuyo» contestan lo mismo.
 */
export default async function CampusLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  await exigirRecurso("cliente", () => getRepos().procedencia.deCampus(groupId));
  return <>{children}</>;
}
