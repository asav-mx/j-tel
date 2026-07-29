import { describe, it, expect } from "vitest";
import {
  pairLedgerEntryWithFact,
  SEALING_LEDGER_ACTIONS,
  DEFAULT_PAIRING_TOLERANCE_MS,
} from "./ledger-pairing.js";

const sello = new Date("2026-07-24T06:50:00.000Z");
const en = (ms: number) => new Date(sello.getTime() + ms);

const entrada = (action: string, offsetMs: number, id = action) => ({
  id,
  action,
  createdAt: en(offsetMs),
});

describe("pairLedgerEntryWithFact", () => {
  it("empareja la entrada escrita justo después del sello", () => {
    const e = entrada("verificacion_automatica", 40);
    const r = pairLedgerEntryWithFact([e], sello);
    expect(r.paired).toBe(true);
    if (r.paired) expect(r.entry.id).toBe("verificacion_automatica");
  });

  it("empareja también un hecho sellado en pase de eliminación", () => {
    // El motor escribe la MISMA carga con otra acción cuando el hecho se selló
    // durante el pase de eliminación. Ignorarla pierde esos hechos.
    const e = entrada("eliminacion_candidatas", 120);
    const r = pairLedgerEntryWithFact([e], sello);
    expect(r.paired).toBe(true);
  });

  it("ignora las entradas de corridas anteriores al sello vigente", () => {
    const r = pairLedgerEntryWithFact(
      [
        entrada("verificacion_automatica", -86_400_000, "vieja"),
        entrada("verificacion_automatica", 30, "vigente"),
      ],
      sello,
    );
    expect(r.paired).toBe(true);
    if (r.paired) expect(r.entry.id).toBe("vigente");
  });

  it("ignora contexto_calibracion, que no lleva los pasos de verificación", () => {
    const r = pairLedgerEntryWithFact(
      [entrada("contexto_calibracion", 10), entrada("verificacion_automatica", 50, "buena")],
      sello,
    );
    expect(r.paired).toBe(true);
    if (r.paired) expect(r.entry.id).toBe("buena");
  });

  it("sin entrada al momento del sello o después: no empareja", () => {
    const r = pairLedgerEntryWithFact([entrada("verificacion_automatica", -1000)], sello);
    expect(r.paired).toBe(false);
    if (!r.paired) expect(r.reason).toBe("no_entry");
  });

  it("solo contexto_calibracion: no empareja", () => {
    const r = pairLedgerEntryWithFact([entrada("contexto_calibracion", 10)], sello);
    expect(r.paired).toBe(false);
    if (!r.paired) expect(r.reason).toBe("no_entry");
  });

  it("dos candidatas después del sello: ambiguo, no elige", () => {
    const r = pairLedgerEntryWithFact(
      [
        entrada("verificacion_automatica", 30, "a"),
        entrada("eliminacion_candidatas", 90, "b"),
      ],
      sello,
    );
    expect(r.paired).toBe(false);
    if (!r.paired) {
      expect(r.reason).toBe("ambiguous");
      expect(r.candidates).toBe(2);
    }
  });

  it("una sola candidata pero lejísimos del sello: no la atribuye", () => {
    const r = pairLedgerEntryWithFact(
      [entrada("verificacion_automatica", DEFAULT_PAIRING_TOLERANCE_MS + 1)],
      sello,
    );
    expect(r.paired).toBe(false);
    if (!r.paired) expect(r.reason).toBe("out_of_tolerance");
  });

  it("justo en el límite de la tolerancia sí empareja", () => {
    const r = pairLedgerEntryWithFact(
      [entrada("verificacion_automatica", DEFAULT_PAIRING_TOLERANCE_MS)],
      sello,
    );
    expect(r.paired).toBe(true);
  });

  it("mismo instante que el sello cuenta como válido", () => {
    // saveFact y addLedgerEntry pueden caer en el mismo instante del reloj de
    // Postgres; la entrada nunca es ANTERIOR al hecho que la originó.
    const r = pairLedgerEntryWithFact([entrada("verificacion_automatica", 0)], sello);
    expect(r.paired).toBe(true);
  });

  it("no depende del orden de llegada", () => {
    const desordenadas = [
      entrada("verificacion_automatica", 5000, "lejana"),
      entrada("contexto_calibracion", 10, "ruido"),
      entrada("verificacion_automatica", -50, "vieja"),
    ];
    const r = pairLedgerEntryWithFact(desordenadas, sello);
    expect(r.paired).toBe(true);
    if (r.paired) expect(r.entry.id).toBe("lejana");
  });

  it("lista vacía: no empareja", () => {
    const r = pairLedgerEntryWithFact([], sello);
    expect(r.paired).toBe(false);
    if (!r.paired) expect(r.candidates).toBe(0);
  });

  it("las dos acciones que sellan están declaradas", () => {
    expect([...SEALING_LEDGER_ACTIONS]).toEqual([
      "verificacion_automatica",
      "eliminacion_candidatas",
    ]);
  });
});
