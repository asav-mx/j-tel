import { describe, expect, it } from "vitest";
import { mensajeContratoDuplicado } from "./contrato-duplicado";

const base = { nombre: "Tecma 47", carrier: "Juárez Bus" };

/**
 * Cada caso sólo puede ofrecer lo que la pantalla de contratos deja hacer:
 * «Activar» aparece si el contrato no está activo; «Eliminar», sólo en un
 * borrador sin servicios; y no existe ningún botón de suspender.
 */
describe("el mensaje de contrato duplicado no manda a buscar botones que no existen", () => {
  it("nunca dice «suspende», en ningún estado", () => {
    for (const status of ["active", "draft", "demo"]) {
      for (const servicios of [0, 3]) {
        const m = mensajeContratoDuplicado({ ...base, status, servicios });
        expect(m.toLowerCase()).not.toContain("suspend");
      }
    }
  });

  it("a un contrato activo no le pide activarlo ni eliminarlo", () => {
    const m = mensajeContratoDuplicado({ ...base, status: "active", servicios: 5 });
    expect(m).not.toMatch(/Actívalo|elimínalo/i);
    expect(m).toContain("contacta a JTEL");
  });

  it("un borrador sin servicios se puede activar o eliminar", () => {
    expect(mensajeContratoDuplicado({ ...base, status: "draft", servicios: 0 })).toMatch(/Actívalo o elimínalo\.$/);
  });

  it("un borrador CON servicios sólo se puede activar: el botón de eliminar no aparece", () => {
    const m = mensajeContratoDuplicado({ ...base, status: "draft", servicios: 2 });
    expect(m).toMatch(/Actívalo\.$/);
    expect(m).not.toMatch(/elimínalo/i);
  });

  it("un demo sólo se puede activar", () => {
    const m = mensajeContratoDuplicado({ ...base, status: "demo", servicios: 0 });
    expect(m).toMatch(/Actívalo\.$/);
    expect(m).not.toMatch(/elimínalo/i);
  });
});
