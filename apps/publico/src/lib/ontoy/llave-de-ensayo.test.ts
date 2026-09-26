import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CABECERA_DE_ENSAYO,
  direccionDeEnsayo,
  direccionSinLaLlave,
  leerEnsayoDeLaDireccion,
} from "./llave-de-ensayo";
import { direccionEnVivo } from "@/lib/rutas-pedidas";

/* Una llave de a mentiras con la forma de una de verdad. */
const LLAVE = "a".repeat(20) + "B".repeat(20);

describe("la llave de ensayo, en la dirección", () => {
  it("se guarda sólo si puede ser una llave", () => {
    expect(leerEnsayoDeLaDireccion(`#ensayo=${LLAVE}`)).toEqual({ accion: "guardar", llave: LLAVE });
    expect(leerEnsayoDeLaDireccion("#ensayo=pruebas")).toEqual({ accion: "nada" });
    expect(leerEnsayoDeLaDireccion("")).toEqual({ accion: "nada" });
  });

  it("`#ensayo=salir` la olvida", () => {
    expect(leerEnsayoDeLaDireccion("#ensayo=salir")).toEqual({ accion: "olvidar" });
  });

  it("sólo se lee del fragmento, que el navegador nunca manda al servidor", () => {
    const codigo = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "llave-de-ensayo.ts"), "utf8");
    expect(codigo).toContain("leerEnsayoDeLaDireccion(window.location.hash)");
    expect(codigo).not.toMatch(/location\.search/);
  });

  it("se borra de la barra en cuanto se lee, y lo demás de la dirección se queda", () => {
    expect(direccionSinLaLlave(`https://ontoy.app/rutas?ruta=51#ensayo=${LLAVE}`)).toBe("/rutas?ruta=51");
    expect(direccionSinLaLlave(`https://ontoy.app/rutas#ensayo=${LLAVE}&x=1`)).toBe("/rutas#x=1");
  });
});

describe("a dónde pregunta un teléfono de ensayo", () => {
  it("a la puerta aparte, con la misma lista, y la llave NUNCA en la dirección", () => {
    const publica = direccionEnVivo(["norte", "centro"]);
    const deEnsayo = direccionDeEnsayo(publica);
    expect(deEnsayo).toBe("/api/circuitos/en-vivo/ensayo?rutas=centro,norte");
    expect(deEnsayo).not.toContain("ensayo=");
  });

  it("el teléfono y el servidor nombran la misma cabecera", () => {
    const AQUI = path.dirname(fileURLToPath(import.meta.url));
    const servidor = readFileSync(path.join(AQUI, "../ensayo.ts"), "utf8");
    expect(/CABECERA_DE_LA_LLAVE = "([^"]+)"/.exec(servidor)?.[1]).toBe(CABECERA_DE_ENSAYO);
  });
});
