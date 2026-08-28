import { describe, it, expect } from "vitest";
import { detalleDelError } from "./archiver.js";

/*
 * El caso real que motivó esto: las veinte alertas del 26 de agosto de 2026.
 * El mensaje de Drizzle arranca con el `select` completo, así que doscientos
 * caracteres se gastan antes de llegar a la causa — y la causa era lo único
 * que servía para saber qué había fallado.
 */
const SQL_LARGO =
  'Failed query: select "id", "account_id", "legal_name", "gps_provider", "gps_base_url", ' +
  '"umbrella_user_id", "umbrella_password_encrypted", "gps_poll_seconds", "created_at" ' +
  'from "carrier_profiles" "carrier_profiles" where "carrier_profiles"."account_id" = $1';

describe("detalleDelError", () => {
  it("pone la CAUSA al frente, que es lo que se perdía", () => {
    const err = new Error(SQL_LARGO, { cause: new Error("connection timeout") });
    const d = detalleDelError(err);
    expect(d.resumen).toBe("connection timeout");
    expect(d.causa).toBe("connection timeout");
  });

  it("guarda el texto ÍNTEGRO, sin recortar", () => {
    const err = new Error(SQL_LARGO, { cause: new Error("connection timeout") });
    const d = detalleDelError(err);
    expect(d.error).toBe(SQL_LARGO);
    expect(d.error.length).toBeGreaterThan(200);
    expect(d.error.endsWith("$1")).toBe(true);
  });

  it("rescata el código de Postgres, que es lo más diagnóstico y lo más corto", () => {
    const pg = Object.assign(new Error("permission denied for table carrier_profiles"), {
      code: "42501",
    });
    const d = detalleDelError(new Error(SQL_LARGO, { cause: pg }));
    expect(d.codigo).toBe("42501");
    expect(d.resumen).toContain("permission denied");
  });

  it("sin causa cae al principio del mensaje, no a un hueco", () => {
    const d = detalleDelError(new Error("se cayó y ya"));
    expect(d.causa).toBeNull();
    expect(d.codigo).toBeNull();
    expect(d.resumen).toBe("se cayó y ya");
    expect(d.error).toBe("se cayó y ya");
  });

  it("el resumen se acota, PERO el texto completo nunca", () => {
    // La pantalla de verificación pinta `message` entero: un select de cuarenta
    // columnas ahí no es información, es una pared. `metadata` no se recorta.
    const largo = "x".repeat(900);
    const d = detalleDelError(new Error(largo));
    expect(d.resumen).toHaveLength(301); // 300 + el signo de continuación
    expect(d.resumen.endsWith("…")).toBe(true);
    expect(d.error).toHaveLength(900);
  });

  it("una causa larga también se acota en el resumen y viaja entera aparte", () => {
    const causa = new Error("y".repeat(500));
    const d = detalleDelError(new Error(SQL_LARGO, { cause: causa }));
    expect(d.resumen).toHaveLength(301);
    expect(d.causa).toHaveLength(500);
  });

  it("lo que no es Error tampoco se pierde", () => {
    const d = detalleDelError("un string pelón");
    expect(d.error).toBe("un string pelón");
    expect(d.resumen).toBe("un string pelón");
    expect(d.causa).toBeNull();
  });
});
