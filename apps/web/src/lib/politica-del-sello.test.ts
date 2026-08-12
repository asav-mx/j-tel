import { describe, expect, it } from "vitest";
import { politicaDelSello } from "./politica-del-sello";
import type { ContractPolicy } from "@jtel/domain";

/**
 * La política del contrato, VIVA. Los valores son los del Campus el 12 de
 * agosto de 2026, porque es el contrato donde la divergencia real ocurrió.
 */
const VIVA = {
  toleranceMinutes: 5,
  evidenceMarginMinutesBefore: 60,
  verificationGraceMinutes: 10,
  evidenceMarginMinutesAfter: 45,
  kmlMatchMinPct: 60,
  routeStrictness: "kml_full",
  excusableReasons: [],
  enforcementRules: [],
} as unknown as ContractPolicy;

describe("politicaDelSello", () => {
  it("sin hecho, manda la política del contrato: no hay sello que respetar", () => {
    const r = politicaDelSello(null, VIVA);
    expect(r.origen).toBe("contrato");
    expect(r.politica.evidenceMarginMinutesAfter).toBe(45);
    expect(r.contratoCambioDesdeElSello).toBe(false);
  });

  /**
   * La prueba que sostiene C24. Es el caso real de los 124 hechos del Campus
   * sellados entre el 13 y el 17 de julio: se juzgaron con 30 minutos después
   * y el contrato hoy dice 45.
   */
  it("con hecho sellado, manda el snapshot AUNQUE el contrato haya cambiado", () => {
    const r = politicaDelSello(
      { contractPolicySnapshot: { ...VIVA, evidenceMarginMinutesAfter: 30 } },
      VIVA,
    );
    expect(r.origen).toBe("sello");
    expect(r.politica.evidenceMarginMinutesAfter).toBe(30);
    expect(r.contratoCambioDesdeElSello).toBe(true);
  });

  /** Los otros 73: el margen congelado es CERO, y cero no es ausencia. */
  it("un cero congelado se respeta como valor, no se toma por vacío", () => {
    const r = politicaDelSello(
      { contractPolicySnapshot: { ...VIVA, evidenceMarginMinutesAfter: 0 } },
      VIVA,
    );
    expect(r.politica.evidenceMarginMinutesAfter).toBe(0);
    expect(r.contratoCambioDesdeElSello).toBe(true);
  });

  it("si el sello y el contrato coinciden, no se anuncia ningún cambio", () => {
    const r = politicaDelSello({ contractPolicySnapshot: { ...VIVA } }, VIVA);
    expect(r.origen).toBe("sello");
    expect(r.contratoCambioDesdeElSello).toBe(false);
  });

  /**
   * La trampa que el sensor de C24 se comió antes de reportar: comparar los dos
   * `jsonb` a secas daba 63 hechos con la zona horaria «divergente», y en
   * pantalla eran cero — el par es ausente contra el default, y las dos
   * lecturas rinden lo mismo. Aquí se comprueba del lado del código.
   */
  it("una llave ausente que el esquema completa con su default NO es una divergencia", () => {
    const { timeZone: _sinZona, ...vivaSinZona } = VIVA as ContractPolicy & {
      timeZone?: string;
    };
    const r = politicaDelSello(
      { contractPolicySnapshot: { ...vivaSinZona } },
      vivaSinZona as ContractPolicy,
    );
    expect(r.contratoCambioDesdeElSello).toBe(false);
  });

  it("una llave que ninguna pantalla lee no cuenta como divergencia", () => {
    const r = politicaDelSello(
      { contractPolicySnapshot: { ...VIVA, kmlMatchMinPct: 99 } },
      VIVA,
    );
    expect(r.contratoCambioDesdeElSello).toBe(false);
  });

  /**
   * Caer a la política viva ante un snapshot corrupto reintroduciría en
   * silencio el defecto que este archivo cierra. Se usa el snapshot tal cual.
   */
  it("un snapshot que no parsea se usa igual: no se cae a la viva", () => {
    const r = politicaDelSello(
      { contractPolicySnapshot: { evidenceMarginMinutesAfter: 30, roto: true } },
      VIVA,
    );
    expect(r.origen).toBe("sello");
    expect(r.politica.evidenceMarginMinutesAfter).toBe(30);
  });
});
