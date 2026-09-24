import { describe, expect, it } from "vitest";
import { jornadaNueva, type JornadaDelLector, type RegistroDePaso } from "@jtel/domain/validador";
import {
  deserializar,
  diaDeHoy,
  guardarEnElAparato,
  reemplazarPorDia,
  serializar,
  type DondeSeGuarda,
} from "./jornada-del-lector";

/**
 * **La memoria del aparato.** Este archivo no tenía pruebas, y es donde vive la
 * evidencia hasta que J-Tel la acusa: si aquí se pierde algo, se pierde de
 * verdad y sin que nadie se entere. Eso es exactamente lo que estas pruebas
 * vigilan.
 */

const PASO = (extra: Partial<RegistroDePaso> = {}): RegistroDePaso => ({
  id: "p1",
  folio: "ONT-00000001",
  cuando: 1_700_000_000_000,
  via: "qr",
  conSenal: false,
  ...extra,
});

const conQuemados = (dia: string): JornadaDelLector => ({
  ...jornadaNueva("J-VAL-07", dia),
  quemados: new Map([
    ["ONT-00000001", 1_700_000_000_000],
    ["ONT-00000002", 1_700_000_001_000],
  ]),
  pasos: [PASO()],
});

describe("lo guardado y lo leído son la misma cosa", () => {
  /*
   * La trampa concreta: `JSON.stringify(new Map())` devuelve `{}` — sin error,
   * sin aviso y sin los datos. Si alguien «simplifica» el aplanado, la memoria
   * de quemados se vacía en cada recarga y el aparato deja de reconocer un
   * boleto que ya había quemado. Un doble uso pasaría por bueno.
   */
  it("la memoria de quemados sobrevive al viaje por texto", () => {
    const antes = conQuemados("2026-09-23");
    const despues = deserializar(serializar(antes.aparato, [antes]))!;
    const vuelta = despues.jornadas[0]!;

    expect(vuelta.quemados).toBeInstanceOf(Map);
    expect(vuelta.quemados.size).toBe(2);
    expect(vuelta.quemados.get("ONT-00000002")).toBe(1_700_000_001_000);
  });

  it("los pasos vuelven enteros, con lo que hace falta para entregarlos", () => {
    const antes: JornadaDelLector = {
      ...jornadaNueva("J-VAL-07", "2026-09-23"),
      pasos: [PASO({ id: "abc", entregadoEn: 123, rechazoDeJTel: "no lo firmó J-Tel" })],
    };
    const vuelta = deserializar(serializar(antes.aparato, [antes]))!.jornadas[0]!;
    expect(vuelta.pasos[0]).toEqual(antes.pasos[0]);
  });

  it("el nombre del aparato viaja con ellas: sin él, dos lectores se confunden", () => {
    const j = jornadaNueva("J-VAL-07", "2026-09-23");
    expect(deserializar(serializar("J-VAL-07", [j]))!.aparato).toBe("J-VAL-07");
  });

  it("varias jornadas, en el orden en que se guardaron", () => {
    const jornadas = ["2026-09-23", "2026-09-22", "2026-09-20"].map((d) => jornadaNueva("J-VAL-07", d));
    const vuelta = deserializar(serializar("J-VAL-07", jornadas))!;
    expect(vuelta.jornadas.map((j) => j.dia)).toEqual(["2026-09-23", "2026-09-22", "2026-09-20"]);
  });

  /* Un aparato con la memoria revuelta arranca de cero, no se queda tildado. */
  it("lo que no se entiende devuelve null, y no revienta", () => {
    expect(deserializar(null)).toBeNull();
    expect(deserializar("")).toBeNull();
    expect(deserializar("{no es json")).toBeNull();
    expect(deserializar("{}")).toBeNull();
    expect(deserializar('{"aparato":"J-VAL-07"}')).toBeNull();
  });
});

describe("guardar dice si no cupo, en vez de tirar", () => {
  const unaJornada = [jornadaNueva("J-VAL-07", "2026-09-23")];

  it("cuando cabe, guarda y lo dice", () => {
    const escrito: Record<string, string> = {};
    const donde: DondeSeGuarda = {
      getItem: (k) => escrito[k] ?? null,
      setItem: (k, v) => {
        escrito[k] = v;
      },
    };
    expect(guardarEnElAparato(donde, "J-VAL-07", unaJornada)).toBe("guardado");
    expect(deserializar(donde.getItem("ontoy:lector"))!.jornadas.length).toBe(1);
  });

  /*
   * El caso que la regla de Asav nombra: *si se llena, que lo diga en
   * pantalla*. Lo que NO puede pasar es que esto se trague el error y siga
   * como si nada, que era el comportamiento anterior.
   */
  it("cuando el navegador dice que no cabe, contesta «no_cabe» y no traga el error", () => {
    const donde: DondeSeGuarda = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    };
    expect(guardarEnElAparato(donde, "J-VAL-07", unaJornada)).toBe("no_cabe");
  });

  it("sin dónde guardar —ventana privada— también lo dice", () => {
    expect(guardarEnElAparato(null, "J-VAL-07", unaJornada)).toBe("no_cabe");
  });

  /*
   * Y lo que importa de verdad: que no haga lugar por su cuenta. Quien decide
   * qué se guarda es `jornadasQueSeGuardan`, y su respuesta es «hasta que esté
   * entregado». Aquí se escribe lo que venga, tal cual.
   */
  it("no tira nada para hacer lugar: escribe exactamente lo que le dan", () => {
    let guardado = "";
    const donde: DondeSeGuarda = {
      getItem: () => guardado || null,
      setItem: (_k, v) => {
        guardado = v;
      },
    };
    const jornadas = ["2026-09-23", "2026-09-10", "2026-08-01"].map((d) => conQuemados(d));
    guardarEnElAparato(donde, "J-VAL-07", jornadas);
    expect(deserializar(guardado)!.jornadas.map((j) => j.dia)).toEqual([
      "2026-09-23",
      "2026-09-10",
      "2026-08-01",
    ]);
  });
});

describe("reemplazar la jornada de un día", () => {
  it("cambia la de ese día y deja las demás", () => {
    const hoy = jornadaNueva("J-VAL-07", "2026-09-23");
    const ayer = jornadaNueva("J-VAL-07", "2026-09-22");
    const hoyConPaso: JornadaDelLector = { ...hoy, pasos: [PASO()] };

    const despues = reemplazarPorDia([hoy, ayer], hoyConPaso);
    expect(despues.map((j) => j.dia)).toEqual(["2026-09-23", "2026-09-22"]);
    expect(despues[0]!.pasos.length).toBe(1);
    expect(despues[1]).toBe(ayer);
  });

  it("si ese día no estaba, lo agrega adelante", () => {
    const ayer = jornadaNueva("J-VAL-07", "2026-09-22");
    const hoy = jornadaNueva("J-VAL-07", "2026-09-23");
    expect(reemplazarPorDia([ayer], hoy).map((j) => j.dia)).toEqual(["2026-09-23", "2026-09-22"]);
  });

  it("no se duplica por llamarla dos veces", () => {
    const hoy = jornadaNueva("J-VAL-07", "2026-09-23");
    const dos = reemplazarPorDia(reemplazarPorDia([], hoy), hoy);
    expect(dos.length).toBe(1);
  });
});

describe("el día del lector es el del chofer", () => {
  /*
   * La fecha se arma con `getFullYear`/`getMonth`/`getDate` a propósito: es la
   * del reloj del aparato, que es donde está el chofer. Un `toISOString` daría
   * el día UTC, y en Juárez eso cambia de día seis horas antes de la medianoche
   * de la que el chofer habla.
   */
  it("usa el calendario local del aparato, no el de UTC", () => {
    /* La suite corre en UTC (#530), así que aquí los dos coinciden… */
    expect(diaDeHoy(new Date("2026-09-23T12:00:00Z"))).toBe("2026-09-23");
    /* …y lo que se fija es el formato, que es lo que el lote manda como `dia`. */
    expect(diaDeHoy(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });

  it("rellena con cero: el lote manda esta cadena tal cual", () => {
    expect(diaDeHoy(new Date("2026-03-07T10:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
