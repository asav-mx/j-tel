import type { OperationalUnit } from "@jtel/domain";
import { getClientMemberships } from "./auth";
import { getRepos } from "./db";

/**
 * Qué plantas/campus se enseñan en el homescreen de un usuario cliente.
 *
 * Esto es presentación, no seguridad. Decide el directorio que se pinta —
 * nunca decide qué está permitido abrir. La guardia real de cuenta vive en
 * `guardia-api.ts` (`exigir`) para escrituras, respaldada por `@jtel/auth-rbac`;
 * ninguna de las dos comprueba hoy el alcance de planta/campus dentro de una
 * cuenta — `canAccessPlant` existe pero nadie la llama, y no tiene rama para
 * `plant_group`. Si este homescreen no enseña una planta, la ruta directa a
 * esa planta sigue tan abierta como antes de este cambio: esto es un
 * directorio, no un candado. No se agrega aquí una segunda fuente de verdad
 * de permisos — cuando exista la guardia real de alcance, este archivo debe
 * consumirla, no duplicarla.
 */
export async function getVisibleOperationalUnits(client: {
  id: string;
}): Promise<OperationalUnit[]> {
  const repos = getRepos();
  const allUnits = await repos.clients.getOperationalUnits(client.id);
  const memberships = await getClientMemberships(client.id);

  const veTodaLaCuenta =
    // Sin membresías todavía (identidad de desarrollo sin fila en
    // user_memberships): se enseña todo, igual que antes de este cambio —
    // no ocultar por accidente algo que ya se veía.
    memberships.length === 0 ||
    memberships.some((m) => m.scopeType === "account" || m.role === "admin_corporativo");

  if (veTodaLaCuenta) return allUnits;

  const idsPropios = new Set(
    memberships
      .filter((m) => m.scopeType === "plant" || m.scopeType === "plant_group")
      .map((m) => m.scopeId)
      .filter((id): id is string => Boolean(id)),
  );

  return allUnits.filter((u) => idsPropios.has(u.id));
}
