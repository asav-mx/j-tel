import { describe, it, expect } from "vitest";
import { revisarZonaDelProceso, zonaDeEsteProceso } from "./zona-del-proceso.js";

describe("la alarma de la zona del proceso", () => {
  it("en UTC no dice nada", () => {
    expect(revisarZonaDelProceso({ tz: "UTC", desplazamientoMinutos: 0 })).toEqual({ enUtc: true });
  });

  /* Sin TZ puesta pero con el reloj en UTC tampoco: lo que importa es lo que
     contesta `Date`, no si alguien escribió la variable. */
  it("sin TZ puesta, si el desplazamiento es cero, no dice nada", () => {
    expect(revisarZonaDelProceso({ tz: undefined, desplazamientoMinutos: 0 }).enUtc).toBe(true);
  });

  it("fuera de UTC avisa, con la zona y el desplazamiento en horas", () => {
    const v = revisarZonaDelProceso({
      tz: "America/Ciudad_Juarez",
      desplazamientoMinutos: 360,
      zonaResuelta: "America/Ciudad_Juarez",
    });
    expect(v.enUtc).toBe(false);
    if (v.enUtc) return;
    expect(v.mensaje).toContain("NO corre en UTC");
    /* El signo, como lo dice todo el mundo: UTC-6, no «offset 360». */
    expect(v.mensaje).toContain("UTC-6");
    expect(v.mensaje).toContain("America/Ciudad_Juarez");
  });

  it("al este de Greenwich el signo es el otro", () => {
    const v = revisarZonaDelProceso({ tz: "Europe/Madrid", desplazamientoMinutos: -120 });
    expect(v.enUtc).toBe(false);
    if (v.enUtc) return;
    expect(v.mensaje).toContain("UTC+2");
  });

  /* Media hora existe: India es UTC+5:30. Redondear a 5 sería un dato falso. */
  it("una zona de media hora no se redondea", () => {
    const v = revisarZonaDelProceso({ tz: "Asia/Kolkata", desplazamientoMinutos: -330 });
    expect(v.enUtc).toBe(false);
    if (v.enUtc) return;
    expect(v.mensaje).toContain("UTC+5.50");
  });

  it("el mensaje manda a leer el diagnóstico, no a adivinar", () => {
    const v = revisarZonaDelProceso({ tz: "America/Ciudad_Juarez", desplazamientoMinutos: 360 });
    if (v.enUtc) throw new Error("debía avisar");
    expect(v.mensaje).toContain("Diagnostico-Rango-Del-Generador");
  });

  /*
   * La suite corre en UTC desde el #530, así que esto comprueba dos cosas a la
   * vez: que la lectura del sistema funciona, y que la suite sigue en UTC.
   */
  it("leído de este proceso, que corre en UTC porque la suite lo fija", () => {
    const zona = zonaDeEsteProceso();
    expect(zona.desplazamientoMinutos).toBe(0);
    expect(revisarZonaDelProceso(zona).enUtc).toBe(true);
  });
});
