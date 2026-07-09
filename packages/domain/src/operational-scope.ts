import { z } from "zod";

/** Unidad operativa: planta independiente o grupo de plantas (campus). */
export const operationalScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plant"), plantId: z.string().uuid() }),
  z.object({ kind: z.literal("plant_group"), plantGroupId: z.string().uuid() }),
]);

export type OperationalScope = z.infer<typeof operationalScopeSchema>;

export type OperationalUnit =
  | { kind: "plant"; id: string; name: string; code: string }
  | {
      kind: "plant_group";
      id: string;
      name: string;
      memberPlants: Array<{ id: string; name: string; code: string }>;
    };

export function operationalScopeColumns(scope: OperationalScope): {
  plantId: string | null;
  plantGroupId: string | null;
} {
  if (scope.kind === "plant") {
    return { plantId: scope.plantId, plantGroupId: null };
  }
  return { plantId: null, plantGroupId: scope.plantGroupId };
}

export function parseOperationalScope(input: {
  plantId?: string | null;
  plantGroupId?: string | null;
}): OperationalScope | null {
  const plantId = input.plantId?.trim() || null;
  const plantGroupId = input.plantGroupId?.trim() || null;
  if (plantId && !plantGroupId) return { kind: "plant", plantId };
  if (plantGroupId && !plantId) return { kind: "plant_group", plantGroupId };
  return null;
}

export function operationalUnitLabel(unit: OperationalUnit): string {
  if (unit.kind === "plant") return unit.name;
  const members = unit.memberPlants.map((p) => p.code).join(", ");
  return members ? `${unit.name} (${members})` : unit.name;
}

export function toScopeRef(scope: OperationalScope): string {
  if (scope.kind === "plant") return `plant:${scope.plantId}`;
  return `plant_group:${scope.plantGroupId}`;
}

export function parseScopeRef(ref: string): OperationalScope | null {
  const [kind, id] = ref.split(":");
  if (!id) return null;
  if (kind === "plant") return { kind: "plant", plantId: id };
  if (kind === "plant_group") return { kind: "plant_group", plantGroupId: id };
  return null;
}

export function operationalScopeFromContract(contract: {
  plantId?: string | null;
  plantGroupId?: string | null;
}): OperationalScope | null {
  return parseOperationalScope({
    plantId: contract.plantId,
    plantGroupId: contract.plantGroupId,
  });
}

export function scopedRowMatches(
  row: { plantId?: string | null; plantGroupId?: string | null },
  scope: OperationalScope,
): boolean {
  if (scope.kind === "plant") {
    return row.plantId === scope.plantId && !row.plantGroupId;
  }
  return row.plantGroupId === scope.plantGroupId && !row.plantId;
}

/** Geocerca válida para un alcance: campus del grupo o planta miembro (excepción). */
export function geofenceMatchesScope(
  geofence: {
    ownerType: string;
    ownerPlantId?: string | null;
    ownerPlantGroupId?: string | null;
  },
  scope: OperationalScope,
  memberPlantIds: string[] = [],
): boolean {
  if (scope.kind === "plant_group") {
    if (
      geofence.ownerType === "plant_group" &&
      geofence.ownerPlantGroupId === scope.plantGroupId
    ) {
      return true;
    }
    return (
      geofence.ownerType === "plant" &&
      !!geofence.ownerPlantId &&
      memberPlantIds.includes(geofence.ownerPlantId)
    );
  }
  return geofence.ownerType === "plant" && geofence.ownerPlantId === scope.plantId;
}

export function contractMatchesScope(
  contract: { plantId?: string | null; plantGroupId?: string | null },
  scope: OperationalScope,
): boolean {
  const contractScope = operationalScopeFromContract(contract);
  if (!contractScope) return false;
  if (scope.kind !== contractScope.kind) return false;
  if (scope.kind === "plant" && contractScope.kind === "plant") {
    return scope.plantId === contractScope.plantId;
  }
  if (scope.kind === "plant_group" && contractScope.kind === "plant_group") {
    return scope.plantGroupId === contractScope.plantGroupId;
  }
  return false;
}
