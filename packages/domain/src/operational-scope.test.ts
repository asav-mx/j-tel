import { describe, it, expect } from "vitest";
import {
  operationalScopeColumns,
  parseOperationalScope,
  operationalUnitLabel,
  toScopeRef,
  parseScopeRef,
  operationalScopeFromContract,
  scopedRowMatches,
  geofenceMatchesScope,
  contractMatchesScope,
  type OperationalScope,
  type OperationalUnit,
} from "./operational-scope.js";

const plantScope: OperationalScope = { kind: "plant", plantId: "p-1" };
const groupScope: OperationalScope = { kind: "plant_group", plantGroupId: "g-1" };

describe("operationalScopeColumns", () => {
  it("mapea planta a columnas", () => {
    expect(operationalScopeColumns(plantScope)).toEqual({
      plantId: "p-1",
      plantGroupId: null,
    });
  });

  it("mapea grupo a columnas", () => {
    expect(operationalScopeColumns(groupScope)).toEqual({
      plantId: null,
      plantGroupId: "g-1",
    });
  });
});

describe("parseOperationalScope", () => {
  it("regresa scope de planta", () => {
    expect(parseOperationalScope({ plantId: "p-1" })).toEqual(plantScope);
  });

  it("regresa scope de grupo", () => {
    expect(parseOperationalScope({ plantGroupId: "g-1" })).toEqual(groupScope);
  });

  it("recorta espacios y trata cadenas vacías como null", () => {
    expect(parseOperationalScope({ plantId: "  p-1  " })).toEqual(plantScope);
    expect(parseOperationalScope({ plantId: "   " })).toBeNull();
  });

  it("regresa null si ambos o ninguno están presentes", () => {
    expect(parseOperationalScope({ plantId: "p-1", plantGroupId: "g-1" })).toBeNull();
    expect(parseOperationalScope({})).toBeNull();
  });
});

describe("operationalUnitLabel", () => {
  it("usa el nombre para planta", () => {
    const unit: OperationalUnit = { kind: "plant", id: "p-1", name: "Planta 47", code: "P47" };
    expect(operationalUnitLabel(unit)).toBe("Planta 47");
  });

  it("lista códigos miembros para grupo", () => {
    const unit: OperationalUnit = {
      kind: "plant_group",
      id: "g-1",
      name: "Campus Juárez",
      memberPlants: [
        { id: "p-1", name: "A", code: "P1" },
        { id: "p-2", name: "B", code: "P2" },
      ],
    };
    expect(operationalUnitLabel(unit)).toBe("Campus Juárez (P1, P2)");
  });

  it("usa solo el nombre cuando el grupo no tiene miembros", () => {
    const unit: OperationalUnit = {
      kind: "plant_group",
      id: "g-1",
      name: "Campus Juárez",
      memberPlants: [],
    };
    expect(operationalUnitLabel(unit)).toBe("Campus Juárez");
  });
});

describe("toScopeRef / parseScopeRef", () => {
  it("ida y vuelta para planta", () => {
    expect(toScopeRef(plantScope)).toBe("plant:p-1");
    expect(parseScopeRef("plant:p-1")).toEqual(plantScope);
  });

  it("ida y vuelta para grupo", () => {
    expect(toScopeRef(groupScope)).toBe("plant_group:g-1");
    expect(parseScopeRef("plant_group:g-1")).toEqual(groupScope);
  });

  it("regresa null para refs inválidas", () => {
    expect(parseScopeRef("plant")).toBeNull();
    expect(parseScopeRef("desconocido:x")).toBeNull();
  });
});

describe("operationalScopeFromContract", () => {
  it("deriva scope desde columnas del contrato", () => {
    expect(operationalScopeFromContract({ plantId: "p-1" })).toEqual(plantScope);
    expect(operationalScopeFromContract({ plantGroupId: "g-1" })).toEqual(groupScope);
    expect(operationalScopeFromContract({})).toBeNull();
  });
});

describe("scopedRowMatches", () => {
  it("empata fila de planta solo con scope de planta correcto", () => {
    expect(scopedRowMatches({ plantId: "p-1" }, plantScope)).toBe(true);
    expect(scopedRowMatches({ plantId: "p-2" }, plantScope)).toBe(false);
    expect(scopedRowMatches({ plantId: "p-1", plantGroupId: "g-1" }, plantScope)).toBe(false);
  });

  it("empata fila de grupo solo con scope de grupo correcto", () => {
    expect(scopedRowMatches({ plantGroupId: "g-1" }, groupScope)).toBe(true);
    expect(scopedRowMatches({ plantGroupId: "g-2" }, groupScope)).toBe(false);
    expect(scopedRowMatches({ plantGroupId: "g-1", plantId: "p-1" }, groupScope)).toBe(false);
  });
});

describe("geofenceMatchesScope", () => {
  it("scope de planta empata geocerca de su planta", () => {
    expect(
      geofenceMatchesScope({ ownerType: "plant", ownerPlantId: "p-1" }, plantScope),
    ).toBe(true);
    expect(
      geofenceMatchesScope({ ownerType: "plant", ownerPlantId: "p-9" }, plantScope),
    ).toBe(false);
  });

  it("scope de grupo empata geocerca del grupo", () => {
    expect(
      geofenceMatchesScope({ ownerType: "plant_group", ownerPlantGroupId: "g-1" }, groupScope),
    ).toBe(true);
  });

  it("scope de grupo acepta geocerca de planta miembro (excepción)", () => {
    expect(
      geofenceMatchesScope(
        { ownerType: "plant", ownerPlantId: "p-2" },
        groupScope,
        ["p-1", "p-2"],
      ),
    ).toBe(true);
    expect(
      geofenceMatchesScope(
        { ownerType: "plant", ownerPlantId: "p-9" },
        groupScope,
        ["p-1", "p-2"],
      ),
    ).toBe(false);
  });
});

describe("contractMatchesScope", () => {
  it("empata contrato de planta con scope de planta", () => {
    expect(contractMatchesScope({ plantId: "p-1" }, plantScope)).toBe(true);
    expect(contractMatchesScope({ plantId: "p-2" }, plantScope)).toBe(false);
  });

  it("empata contrato de grupo con scope de grupo", () => {
    expect(contractMatchesScope({ plantGroupId: "g-1" }, groupScope)).toBe(true);
    expect(contractMatchesScope({ plantGroupId: "g-2" }, groupScope)).toBe(false);
  });

  it("no empata cuando difieren los tipos de scope", () => {
    expect(contractMatchesScope({ plantId: "p-1" }, groupScope)).toBe(false);
  });

  it("regresa false para contrato sin scope", () => {
    expect(contractMatchesScope({}, plantScope)).toBe(false);
  });
});
