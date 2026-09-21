import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * El muro de ESCRITURA del circuito: el carrier asigna y suelta sus unidades
 * (ficha de huecos de «asignar unidad», PR 2, 21 sep 2026).
 *
 * Hasta hoy asignar a un circuito era sólo de J-Staff, y las tres puertas del
 * repositorio —`assignUnit`, `endAssignment`, `listAssignments`— no preguntan de
 * quién es nada. Daba igual mientras la única mano fuera la de J-Staff. En
 * cuanto el carrier escribe, cualquiera de las tres llamada desde una ruta de
 * carrier es la puerta por la que suelta, asigna o lee la unidad de OTRO carrier
 * con sólo mandar un uuid.
 *
 * Misma disciplina que `guardia-muro-cuenta.test.ts`: la prueba **lee el
 * código**, para que un camino nuevo sin muro nazca en rojo. El comportamiento
 * —dos carriers en el mismo circuito, ninguno toca lo del otro— lo mide contra
 * base de verdad la matriz de `asignacion-carrier.integration.test.ts`, y esta
 * valla exige que siga existiendo.
 *
 * Vigila:
 *
 *  1. **Las puertas sin muro sólo las usa J-Staff.** `endAssignment` y
 *     `listAssignments` sólo desde `/jstaff/` o `/api/jstaff/`; `assignUnit` desde ahí y
 *     desde el servicio del carrier, que antes le pasa el universo con muro.
 *  2. **Las puertas con muro conservan sus cerraduras.** Quitar una la deja
 *     abierta de más sin romper ninguna otra prueba que no siembre dos carriers.
 *  3. **La ruta del carrier pregunta como debe**: guardia de flota, quién sale
 *     de la sesión, y la cuenta de la asignación nunca viene del formulario.
 */

const SRC = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SRC, "../../..");

function arboles(): string[] {
  const salida: string[] = [];
  for (const grupo of ["packages", "apps"]) {
    for (const nombre of readdirSync(path.join(REPO, grupo))) {
      const src = path.join(REPO, grupo, nombre, "src");
      if (existsSync(src) && statSync(src).isDirectory()) salida.push(`${grupo}/${nombre}/src`);
    }
  }
  return salida;
}

function fuentes(arbol: string): string[] {
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      if (entrada === "node_modules" || entrada === "dist" || entrada === ".next") continue;
      const completa = path.join(dir, entrada);
      if (statSync(completa).isDirectory()) recorrer(completa);
      else if (/\.(ts|tsx)$/.test(entrada)) salida.push(path.relative(REPO, completa));
    }
  };
  recorrer(path.join(REPO, arbol));
  return salida;
}

const leer = (archivo: string) => readFileSync(path.join(REPO, archivo), "utf8");

/** Sin comentarios: uno que nombre una puerta no cuenta como llamada, ni una cerradura como puesta. */
const sinComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const REPO_DB = "packages/db/src/repositories/index.ts";
const ESTA = "packages/services/src/guardia-asignar-circuito.test.ts";
/**
 * La cara de J-Staff: sus rutas de API y sus páginas, que viven tras su propia
 * guardia — el árbol viejo (`/jstaff/`) y su casa nueva (`/casa/jstaff/`, donde
 * se muda el cuarto Circuitos, 21-sep-2026). La casa nueva entra con condición:
 * la prueba de abajo exige que TODA página suya tenga la guardia de J-Staff.
 */
const RUTA_JSTAFF = /^apps\/web\/src\/app\/(?:api\/|casa\/)?jstaff\//;
/** Pruebas que siembran en la base desechable o usan dobles: no son caminos de la aplicación. */
const PRUEBA = /\.test\.tsx?$/;

function llamadores(metodo: string): string[] {
  const patron = new RegExp(`\\.${metodo}\\s*\\(`);
  return arboles()
    .flatMap(fuentes)
    .filter((a) => a !== REPO_DB && a !== ESTA && !PRUEBA.test(a))
    .filter((a) => patron.test(sinComentarios(leer(a))));
}

/** El cuerpo de un método del repositorio, sin comentarios. */
function metodo(nombre: string): string {
  const repo = leer(REPO_DB);
  const desde = repo.search(new RegExp(`\\n  async ${nombre}\\s*\\(`));
  if (desde < 0) return "";
  const resto = repo.slice(desde + 1);
  const fin = resto.slice(1).search(/\n  (?:async\s+)?[a-zA-Z]+\s*\(|\n  \/\*\*/);
  return sinComentarios(fin < 0 ? resto : resto.slice(0, fin + 1));
}

describe("guardia · la casa nueva de J-Staff es cara de J-Staff sólo con su guardia", () => {
  it("toda página bajo /casa/jstaff/ exige la sesión de J-Staff", () => {
    const paginas = arboles()
      .flatMap(fuentes)
      .filter((a) => /^apps\/web\/src\/app\/casa\/jstaff\/.*page\.tsx$/.test(a));
    expect(paginas.length).toBeGreaterThan(0);
    const sinGuardia = paginas.filter(
      (a) => !/exigirEnPagina\(\s*\{\s*tipo:\s*"jstaff"\s*\}\s*\)/.test(sinComentarios(leer(a))),
    );
    expect(
      sinGuardia,
      "Estas páginas viven en la casa de J-Staff —donde se leen puertas sin muro— y no exigen su sesión.",
    ).toEqual([]);
  });
});

describe("guardia · las puertas sin muro del circuito son sólo de J-Staff", () => {
  it("el barrido encuentra código de verdad (guarda contra un falso verde)", () => {
    expect(llamadores("assignUnit").length).toBeGreaterThan(0);
    expect(metodo("endAssignment")).toContain("circuitUnitAssignments");
  });

  it("endAssignment sólo se llama desde la cara de J-Staff", () => {
    const fuera = llamadores("endAssignment").filter((a) => !RUTA_JSTAFF.test(a));
    expect(
      fuera,
      "endAssignment cierra una asignación por id sin preguntar de quién es. Fuera de J-Staff se suelta con " +
        "repos.circuits.soltarAsignacionDeCuenta(cuentaId, circuitId, assignmentId, …).",
    ).toEqual([]);
  });

  it("listAssignments sólo se llama desde la cara de J-Staff", () => {
    const fuera = llamadores("listAssignments").filter((a) => !RUTA_JSTAFF.test(a));
    expect(
      fuera,
      "listAssignments entrega las asignaciones de TODOS los carriers del circuito. Fuera de J-Staff se lee " +
        "con repos.circuits.listAsignacionesDeCuenta(cuentaId, circuitId).",
    ).toEqual([]);
  });

  it("assignUnit sólo desde J-Staff y desde el servicio del carrier", () => {
    const fuera = llamadores("assignUnit").filter(
      (a) => !RUTA_JSTAFF.test(a) && a !== "packages/services/src/acciones-circuito.ts",
    );
    expect(
      fuera,
      "assignUnit no comprueba de quién es la unidad. El carrier asigna por asignarUnidadACircuito, que antes " +
        "saca la unidad de listUnidadesAsignablesDelCarrier.",
    ).toEqual([]);
  });

  it("el servicio del carrier saca la unidad del universo con muro antes de asignar", () => {
    const servicio = sinComentarios(leer("packages/services/src/acciones-circuito.ts"));
    expect(servicio).toContain("listUnidadesAsignablesDelCarrier(");
    expect(servicio).toContain("soltarAsignacionDeCuenta(");
    expect(servicio).not.toMatch(/\.endAssignment\s*\(/);
    // La cuenta de la fila sale de la unidad del universo, nunca de los datos de entrada.
    expect(servicio).toMatch(/carrierAccountId:\s*unidad\.carrierAccountId/);
  });
});

describe("guardia · las puertas con muro conservan sus cerraduras", () => {
  it("soltarAsignacionDeCuenta: la asignación es de la cuenta, la unidad es suya y el circuito es éste", () => {
    const m = metodo("soltarAsignacionDeCuenta");
    expect(m).toMatch(/eq\(circuitUnitAssignments\.carrierAccountId,\s*cuentaId\)/);
    expect(m).toMatch(/\$\{units\.carrierAccountId\}\s*=\s*\$\{cuentaId\}/);
    expect(m).toMatch(/eq\(circuitUnitAssignments\.circuitId,\s*circuitId\)/);
    expect(m).toMatch(/isNull\(circuitUnitAssignments\.validTo\)/);
  });

  it("listUnidadesAsignablesDelCarrier: la unidad es suya y la concesión de ESTE circuito lo liga, vigente", () => {
    const m = metodo("listUnidadesAsignablesDelCarrier");
    expect(m).toMatch(/eq\(units\.carrierAccountId,\s*carrierAccountId\)/);
    expect(m).toMatch(/\$\{circuits\.id\}\s*=\s*\$\{circuitId\}/);
    expect(m).toMatch(/\$\{concessionCarriers\.carrierAccountId\}\s*=\s*\$\{carrierAccountId\}/);
    expect(m).toMatch(/\$\{concessionCarriers\.validTo\}\s+IS NULL/);
  });

  it("listAsignacionesDeCuenta: la asignación es de la cuenta y la unidad es suya", () => {
    const m = metodo("listAsignacionesDeCuenta");
    expect(m).toMatch(/eq\(circuitUnitAssignments\.carrierAccountId,\s*cuentaId\)/);
    expect(m).toMatch(/eq\(units\.carrierAccountId,\s*cuentaId\)/);
    expect(m).toMatch(/eq\(circuitUnitAssignments\.circuitId,\s*circuitId\)/);
  });
});

describe("guardia · la ruta del carrier pregunta como debe", () => {
  const RUTA = "apps/web/src/app/api/casa/circuitos/route.ts";

  it("exige manejar la flota, toma quién de la sesión y no deja elegir cuenta de la fila", () => {
    const ruta = sinComentarios(leer(RUTA));
    expect(ruta).toContain('tipo: "carrier-maneja-flota"');
    expect(ruta).toContain("g.identidad.userId");
    expect(ruta).not.toMatch(/form\.get\(\s*["']carrierAccountId["']\s*\)/);
    expect(ruta).not.toMatch(/form\.get\(\s*["']por["']\s*\)/);
    expect(ruta).not.toMatch(/repos\.circuits\.(assignUnit|endAssignment|listAssignments)\s*\(/);
  });

  it("la matriz sembrada sigue existiendo", () => {
    expect(existsSync(path.join(REPO, "packages/db/src/asignacion-carrier.integration.test.ts"))).toBe(true);
  });
});
