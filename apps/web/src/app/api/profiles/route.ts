import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { createServiceProfileSchema } from "@jtel/domain";

/**
 * Crear un perfil de servicio.
 *
 * Esta ruta no recibe cuenta: el cuerpo trae un `contractId` y nada más. Por
 * eso la cuenta se DERIVA del contrato y se comprueba contra ella. Pedir un
 * slug aquí sería volver a dejar que la petición eligiera contra quién se
 * compara, que es justo el agujero que estas guardias cierran.
 *
 * El orden importa: primero se valida la forma del cuerpo, luego se resuelve
 * el contrato, y solo entonces se decide. Nada se escribe antes.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createServiceProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const repos = getRepos();
  const contract = await repos.contracts.findById(parsed.data.contractId);
  if (!contract) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }

  const g = await exigir(
    request,
    { tipo: "cliente-por-id", accountId: contract.clientAccountId },
    "json",
  );
  if (!g.ok) return g.respuesta;

  const profile = await repos.profiles.create(parsed.data);
  return NextResponse.json(profile, { status: 201 });
}
