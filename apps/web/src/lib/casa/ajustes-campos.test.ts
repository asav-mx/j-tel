import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/*
 * Los ajustes del expediente nuevo mandan sus números a la ruta de siempre por
 * NOMBRE DE CAMPO. Si uno se escribe distinto, la ruta no lo lee, no lo guarda
 * y no dice nada — el ajuste parece guardado y no lo está. Esta prueba lee las
 * dos fuentes y exige que cada campo del formulario sea uno que la ruta lee.
 */
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../app");
const leer = (r: string) => readFileSync(path.join(APP, r), "utf8");

it("cada ajuste del expediente es un campo que la ruta de siempre lee", () => {
  const pagina = leer("casa/jstaff/circuitos/[id]/page.tsx");
  const ruta = leer("api/jstaff/circuitos/[id]/route.ts");
  const enPagina = [...pagina.matchAll(/campo: "([a-zA-Z]+)"/g)].map((m) => m[1]!);
  const enRuta = new Set([...ruta.matchAll(/campo: "([a-zA-Z]+)"/g)].map((m) => m[1]!));
  expect(enPagina.length).toBe(6);
  expect(enPagina.filter((c) => !enRuta.has(c))).toEqual([]);
});

it("los campos de la identidad también son los que la ruta lee", () => {
  const ruta = leer("api/jstaff/circuitos/[id]/route.ts");
  const identidad = readFileSync(path.resolve(APP, "../components/casa/identidad-del-circuito.tsx"), "utf8");
  const campos = [...identidad.matchAll(/name="([a-zA-Z]+)"/g)].map((m) => m[1]!).filter((c) => !["volver", "seccion"].includes(c));
  expect(campos.sort()).toEqual(["arrancaEl", "colorHex", "horaFin", "horaInicio", "nombre", "zonaHoraria"]);
  for (const c of campos) expect(ruta, c).toContain(`"${c}"`);
});
