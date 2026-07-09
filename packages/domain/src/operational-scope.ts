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
