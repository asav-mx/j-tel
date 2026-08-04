import { exigirRecurso } from "@/lib/guardia-pagina";
import { getRepos } from "@/lib/db";

/**
 * La puerta de un contrato. Cubre el contrato, su expediente y su historia.
 *
 * La cuenta sale de `service_contracts.client_account_id`.
 */
export default async function ContratoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  await exigirRecurso(() => getRepos().procedencia.deContrato(contractId));
  return <>{children}</>;
}
