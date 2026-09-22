import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { direccionEnVivo, MAXIMO_RUTAS, rutasPedidas } from "@/lib/rutas-pedidas";

describe("las rutas que pide /api/circuitos/en-vivo", () => {
  it("sólo las pedidas, ordenadas y sin repetidas", () => {
    expect(rutasPedidas("zaragoza-centro, insurgentes,zaragoza-centro")).toEqual({
      ok: true,
      rutas: ["insurgentes", "zaragoza-centro"],
    });
  });

  it("sin lista no hay consulta: nunca «todas»", () => {
    expect(rutasPedidas(null).ok).toBe(false);
    expect(rutasPedidas("").ok).toBe(false);
    expect(rutasPedidas("*").ok).toBe(false);
  });

  it(`más de ${MAXIMO_RUTAS} rutas es barrer la ciudad, no seguir tus favoritas: 400`, () => {
    const muchas = Array.from({ length: MAXIMO_RUTAS + 1 }, (_, i) => `r${i}`).join(",");
    expect(rutasPedidas(muchas).ok).toBe(false);
  });

  it("el mismo conjunto de favoritas es la misma dirección, para que el CDN la comparta", () => {
    expect(direccionEnVivo(["b", "a", "b"])).toBe(direccionEnVivo(["a", "b"]));
    expect(direccionEnVivo(["a", "b"])).toBe("/api/circuitos/en-vivo?rutas=a,b");
  });
});

describe("todo lo que la app pide al servidor vive bajo el prefijo del firewall", () => {
  it("no hay consultas fuera de /api/circuitos/ (la regla del firewall sólo cubre ese prefijo)", () => {
    const api = readdirSync(new URL("../app/api/", import.meta.url));
    expect(api).toEqual(["circuitos"]);
  });

  it("las carpetas fijas bajo /api/circuitos/ son nombres que ninguna ruta puede usar como slug", () => {
    const fijas = readdirSync(new URL("../app/api/circuitos/", import.meta.url)).filter((d) => !d.startsWith("["));
    // Si agregas una, anótala aquí: un circuito con ese slug quedaría tapado por ella.
    expect(fijas.sort()).toEqual(["en-vivo", "paradas-de-la-ciudad"]);
  });
});
