/**
 * Lo que estas pruebas cercan no es la consulta —eso lo dice la base— sino las
 * dos cosas del guion que pueden producir una afirmación falsa con el dato
 * correcto: en qué semana cae un día, y en qué dirección se lee un cambio.
 *
 * El segundo es el que importa. El hueco entre puntos **sube cuando el muestreo
 * empeora**, al revés de casi cualquier otra métrica de un tablero. Un signo
 * invertido aquí no rompe nada, no falla ningún build y hace que el sensor
 * anuncie «más denso» el día que el proveedor raleó la cadencia — que es
 * exactamente el 29 de julio que este sensor existe para no volver a perderse.
 */
import { describe, expect, it } from "vitest";
import { lunesDe, resumirSemanas } from "./medir-cadencia.js";

describe("lunesDe", () => {
  it("un lunes es su propio lunes", () => {
    expect(lunesDe("2026-08-10")).toBe("2026-08-10");
  });

  it("el resto de la semana retrocede a su lunes", () => {
    expect(lunesDe("2026-08-11")).toBe("2026-08-10");
    expect(lunesDe("2026-08-14")).toBe("2026-08-10");
  });

  /*
   * El domingo es el caso que se rompe solo: `getUTCDay()` lo da como 0, así
   * que la resta ingenua (dow - 1) lo mandaría un día ADELANTE, a la semana
   * siguiente. Un domingo mal agrupado movería un día de operación de semana y
   * cambiaría las dos medias que se comparan.
   */
  it("el domingo pertenece a la semana que termina, no a la que empieza", () => {
    expect(lunesDe("2026-08-16")).toBe("2026-08-10");
  });

  it("cruza el fin de mes sin inventar fechas", () => {
    expect(lunesDe("2026-08-01")).toBe("2026-07-27");
  });
});

describe("resumirSemanas", () => {
  const dia = (fecha: string, hueco: number | null, puntos = 1_000) => ({
    fecha,
    puntos,
    hueco,
  });

  it("agrupa por semana y promedia el hueco de sus días", () => {
    const r = resumirSemanas([dia("2026-08-10", 40), dia("2026-08-11", 60)]);
    expect(r).toHaveLength(1);
    expect(r[0]!.lunes).toBe("2026-08-10");
    expect(r[0]!.dias).toBe(2);
    expect(r[0]!.hueco).toBe(50);
    expect(r[0]!.puntos).toBe(2_000);
  });

  it("la primera semana no tiene contra qué compararse", () => {
    expect(resumirSemanas([dia("2026-08-10", 40)])[0]!.cambioPct).toBeNull();
  });

  /*
   * El caso del 29 de julio, en miniatura y con el signo que importa: el hueco
   * pasó de 60 s a 40 s —el aparato empezó a mandar MÁS— y eso tiene que salir
   * NEGATIVO. Si algún día sale positivo, el sensor está diciendo lo contrario
   * de lo que pasó.
   */
  it("un hueco que se encoge da porcentaje negativo: muestreo más denso", () => {
    const r = resumirSemanas([dia("2026-07-20", 60), dia("2026-07-27", 40)]);
    expect(r[1]!.cambioPct).toBeCloseTo(-33.33, 1);
  });

  it("un hueco que crece da porcentaje positivo: muestreo más ralo", () => {
    const r = resumirSemanas([dia("2026-07-20", 40), dia("2026-07-27", 60)]);
    expect(r[1]!.cambioPct).toBeCloseTo(50, 5);
  });

  /*
   * Una semana sin dato no debe borrar la comparación de la siguiente: si se
   * comparara contra ella, el cambio saldría «—» y un salto real quedaría sin
   * reportar justo en el hueco de la serie.
   */
  it("compara contra la última semana CON dato, saltando las vacías", () => {
    const r = resumirSemanas([
      dia("2026-07-20", 60),
      dia("2026-07-27", null, 0),
      dia("2026-08-03", 30),
    ]);
    expect(r[1]!.hueco).toBeNull();
    expect(r[1]!.cambioPct).toBeNull();
    expect(r[2]!.cambioPct).toBeCloseTo(-50, 5);
  });

  it("los días sin hueco no arrastran el promedio de su semana", () => {
    const r = resumirSemanas([dia("2026-08-10", 40), dia("2026-08-11", null, 0)]);
    expect(r[0]!.hueco).toBe(40);
    expect(r[0]!.dias).toBe(2);
  });
});
