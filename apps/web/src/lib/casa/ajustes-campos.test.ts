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
  expect(enPagina.length).toBe(8);
  expect(enPagina.filter((c) => !enRuta.has(c))).toEqual([]);
});

it("los campos de la identidad también son los que la ruta lee", () => {
  const ruta = leer("api/jstaff/circuitos/[id]/route.ts");
  /*
   * **Dos archivos, un formulario.** El color salió a su propio componente
   * cuando dejó de ser un selector libre y pasó a ser una lista
   * (`selector-de-color-de-ruta.tsx`, enmienda (a) de ASAV 23-sep-2026), y su
   * `name="colorHex"` se fue con él. Si esta prueba sólo leyera el archivo de la
   * identidad, dejaría de vigilar justo el campo que se acaba de mover — que es
   * cuando un campo se escribe distinto y nadie lo nota.
   */
  const COMPONENTES = ["identidad-del-circuito.tsx", "selector-de-color-de-ruta.tsx"];
  const formulario = COMPONENTES.map((c) => readFileSync(path.resolve(APP, "../components/casa", c), "utf8")).join("\n");
  const campos = [...formulario.matchAll(/name="([a-zA-Z]+)"/g)].map((m) => m[1]!).filter((c) => !["volver", "seccion"].includes(c));
  expect(campos.sort()).toEqual(["arrancaEl", "colorHex", "horaFin", "horaInicio", "motivo", "nombre", "zonaHoraria"]);
  for (const c of campos) expect(ruta, c).toContain(`"${c}"`);
});
