import { describe, it, expect, afterEach } from "vitest";
import {
  computeExpectedDeadline,
  computeEvidenceWindow,
  instanteZonificado,
  JTTEL_TZ,
} from "./index.js";

/**
 * La guarda del bug de 2026-07-28.
 *
 * `computeExpectedDeadline` construía la fecha con `new Date(\`${d}T00:00:00\`)`,
 * sin marca de zona. Eso se resuelve en la zona del PROCESO, así que el mismo
 * contrato producía deadlines distintos según dónde se generó la ocurrencia:
 * 06:00Z desde una laptop en Juárez, 00:00Z desde Vercel, que corre en UTC.
 *
 * Seis horas de corrimiento. Los hechos sellados con la base equivocada
 * salieron 84.4% no cumplido con UN solo cumplido entre 294, contra 47.2% de
 * los calculados bien.
 *
 * Una regla de lint que persiga `new Date(\`...T...\`)` se esquiva sola. Esta
 * prueba fija el invariante que de verdad se violó: **el resultado no puede
 * depender del reloj del proceso**. No se puede satisfacer por accidente.
 */

const TZ_ORIGINAL = process.env.TZ;

/** Corre `fn` con el reloj del proceso puesto en `tz`. */
function conRelojDelProceso<T>(tz: string, fn: () => T): T {
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = TZ_ORIGINAL;
  }
}

afterEach(() => {
  process.env.TZ = TZ_ORIGINAL;
});

const ZONAS_DEL_PROCESO = [
  "UTC",
  "America/Ciudad_Juarez",
  "Asia/Tokyo",
  "Pacific/Kiritimati",
];

describe("el reloj del proceso no puede cambiar el resultado", () => {
  it("el deadline es idéntico corra donde corra", () => {
    const resultados = ZONAS_DEL_PROCESO.map((tz) =>
      conRelojDelProceso(tz, () =>
        computeExpectedDeadline("2026-07-21", "06:00:00", 20, JTTEL_TZ).toISOString(),
      ),
    );

    // Si el proceso influye, este expect falla y nombra la zona culpable.
    expect(new Set(resultados).size, `resultados por zona: ${resultados.join(" | ")}`).toBe(1);
    expect(resultados[0]).toBe("2026-07-21T11:40:00.000Z");
  });

  it("la ventana de evidencia también es idéntica", () => {
    const politica = {
      evidenceMarginMinutesBefore: 60,
      verificationGraceMinutes: 15,
      evidenceMarginMinutesAfter: 30,
    };
    const ventanas = ZONAS_DEL_PROCESO.map((tz) =>
      conRelojDelProceso(tz, () => {
        const d = computeExpectedDeadline("2026-07-21", "06:00:00", 20, JTTEL_TZ);
        const w = computeEvidenceWindow(d, politica);
        return `${w.windowStart.toISOString()}→${w.windowEnd.toISOString()}`;
      }),
    );
    expect(new Set(ventanas).size, ventanas.join(" | ")).toBe(1);
  });

  it("instanteZonificado tampoco se deja arrastrar", () => {
    const r = ZONAS_DEL_PROCESO.map((tz) =>
      conRelojDelProceso(tz, () =>
        instanteZonificado("2026-07-21", 5 * 60, "America/Ciudad_Juarez").toISOString(),
      ),
    );
    expect(new Set(r).size, r.join(" | ")).toBe(1);
    expect(r[0]).toBe("2026-07-21T11:00:00.000Z");
  });

  it("el caso exacto que se rompió en producción", () => {
    // Planta 47: turno 06:00, anticipación 15. Lo sellado fue 05:45 UTC, que
    // en Juárez son las 23:45 del día ANTERIOR. Debe ser 11:45 UTC.
    const d = conRelojDelProceso("UTC", () =>
      computeExpectedDeadline("2026-07-21", "06:00:00", 15, "America/Ciudad_Juarez"),
    );
    expect(d.toISOString()).toBe("2026-07-21T11:45:00.000Z");
    expect(d.toISOString()).not.toBe("2026-07-21T05:45:00.000Z");
  });
});

describe("la zona del contrato sí cambia el resultado, y debe", () => {
  it("dos zonas distintas dan instantes distintos para la misma hora civil", () => {
    const juarez = computeExpectedDeadline("2026-07-21", "06:00:00", 0, "America/Ciudad_Juarez");
    const cdmx = computeExpectedDeadline("2026-07-21", "06:00:00", 0, "America/Mexico_City");
    expect(juarez.toISOString()).toBe("2026-07-21T12:00:00.000Z");
    expect(cdmx.toISOString()).toBe("2026-07-21T12:00:00.000Z");

    const tokio = computeExpectedDeadline("2026-07-21", "06:00:00", 0, "Asia/Tokyo");
    expect(tokio.toISOString()).toBe("2026-07-20T21:00:00.000Z");
  });

  it("sin zona declarada cae a la del despliegue, no a la del proceso", () => {
    const conDefault = conRelojDelProceso("Asia/Tokyo", () =>
      computeExpectedDeadline("2026-07-21", "06:00:00", 0),
    );
    const explicita = computeExpectedDeadline("2026-07-21", "06:00:00", 0, JTTEL_TZ);
    expect(conDefault.toISOString()).toBe(explicita.toISOString());
  });
});

describe("el cambio de horario", () => {
  // Ciudad Juárez es municipio fronterizo: sigue el calendario de Estados
  // Unidos, no el mexicano. En 2026 adelanta el 8 de marzo y atrasa el 1 de
  // noviembre. Antes y después va a UTC-7; en medio, a UTC-6.
  it("antes de adelantar el reloj, UTC-7", () => {
    expect(computeExpectedDeadline("2026-03-07", "06:00:00", 0, JTTEL_TZ).toISOString()).toBe(
      "2026-03-07T13:00:00.000Z",
    );
  });

  it("después de adelantar el reloj, UTC-6", () => {
    expect(computeExpectedDeadline("2026-03-09", "06:00:00", 0, JTTEL_TZ).toISOString()).toBe(
      "2026-03-09T12:00:00.000Z",
    );
  });

  it("después de atrasarlo, UTC-7 otra vez", () => {
    expect(computeExpectedDeadline("2026-11-02", "06:00:00", 0, JTTEL_TZ).toISOString()).toBe(
      "2026-11-02T13:00:00.000Z",
    );
  });

  it("el turno de madrugada del día del cambio no se desfasa", () => {
    // 08-mar-2026: el reloj salta de 02:00 a 03:00. Un turno de las 06:00 cae
    // después del salto, ya en UTC-6.
    expect(computeExpectedDeadline("2026-03-08", "06:00:00", 0, JTTEL_TZ).toISOString()).toBe(
      "2026-03-08T12:00:00.000Z",
    );
  });
});

describe("aritmética del deadline", () => {
  it("la anticipación se resta de la hora del turno", () => {
    const sin = computeExpectedDeadline("2026-07-21", "06:00:00", 0, JTTEL_TZ);
    const con = computeExpectedDeadline("2026-07-21", "06:00:00", 20, JTTEL_TZ);
    expect(sin.getTime() - con.getTime()).toBe(20 * 60_000);
  });

  it("una anticipación mayor que la hora del turno cae al día anterior", () => {
    // Turno 00:30 con 60 min de anticipación → 23:30 del día anterior.
    const d = computeExpectedDeadline("2026-07-21", "00:30:00", 60, JTTEL_TZ);
    expect(d.toISOString()).toBe("2026-07-21T05:30:00.000Z");
  });

  it("acepta HH:MM además de HH:MM:SS", () => {
    expect(computeExpectedDeadline("2026-07-21", "06:00", 0, JTTEL_TZ).toISOString()).toBe(
      computeExpectedDeadline("2026-07-21", "06:00:00", 0, JTTEL_TZ).toISOString(),
    );
  });
});
