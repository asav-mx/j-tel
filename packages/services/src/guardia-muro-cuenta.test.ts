import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * El muro de cuenta en la lectura de `telemetry_points`.
 *
 * **El IMEI no es el muro; la cuenta sí** (Pieza 1.C). Un aparato que cambió de
 * cuenta (6.14) conserva su IMEI, y sus puntos de antes del cambio se quedaron
 * archivados en la cuenta anterior. Una lectura por IMEI solo le entrega al
 * árbitro el recorrido de OTRO transportista, y el árbitro sella con él. El
 * resultado no es un error visible: es un hecho falso pero creíble, firmado, en
 * el expediente de un cliente. Es la clase de daño que no se ve revisando el
 * diff.
 *
 * Se cerró en tres tiempos. Las pantallas dejaron la lectura sin cuenta en el
 * #435. El motor —verificación, reverificación y el backfill de duraciones— en
 * el #441; se midió en producción el 17 de septiembre de 2026 antes de cerrar:
 * cero IMEIs con puntos en más de una cuenta, así que no movió ningún veredicto
 * ya sellado. Y el 18 de septiembre se borró `getForImeis` del repositorio: la
 * puerta que sigue en la pared, alguien la vuelve a abrir sin querer.
 *
 * ## Por qué esta prueba lee código y no comportamiento
 *
 * Una prueba de comportamiento comprueba el camino que hoy existe, no el que
 * alguien escriba mañana. Una lectura sin cuenta nueva pasaría verde y volvería
 * a abrir la puerta en silencio — igual que el `[0]` del #222, invisible
 * mientras haya una sola cuenta. Esta prueba lee el código fuente y exige la
 * regla, así que **una lectura sin muro nace en rojo**.
 *
 * Vigila dos cosas distintas:
 *
 *  1. **Que nadie reintroduzca la puerta.** Ningún paquete puede volver a
 *     definir ni llamar una lectura de `telemetry_points` por IMEI sin cuenta.
 *  2. **Que el camino del veredicto siga leyendo con el muro.** No basta con
 *     que no exista la puerta: los archivos que sellan hechos tienen que estar
 *     leyendo, y leyendo con cuenta.
 */

const SRC = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SRC, "../../..");

/**
 * Los árboles que se barren: la carpeta `src` de TODOS los paquetes y de todas
 * las apps, descubiertos leyendo el disco y no escritos a mano. Una lista fija
 * dejaría fuera el paquete que alguien cree el mes que viene — que es justo
 * donde la puerta volvería a abrirse sin que nadie lo note.
 */
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

/**
 * El camino del veredicto: todo lo que lee evidencia para sellar un hecho, o
 * para escribir un dato que el motor después usa para juzgar.
 */
const CAMINO_DEL_VEREDICTO = [
  "packages/services/src/verification.ts",
  "packages/services/src/reverificacion-zona-motor.ts",
  // No sella, pero escribe `route_traversal_measurements`, que dimensiona la
  // ventana derivada — o sea, entra al motor por la puerta de atrás.
  "packages/services/src/backfill-duraciones-ruta.ts",
];

/**
 * Esta prueba se nombra a sí misma para explicar la regla, así que no puede
 * medirse a sí misma. No hay más exentos: la lista de #441 tenía uno
 * —`medir-ventana-vs-ruta.ts`— y dejó de necesitarlo cuando pasó a llevar
 * cuenta. Lo que pudre una regla como ésta es la excepción que nadie escribió;
 * si algún día hace falta una, va aquí con nombre y motivo.
 */
const EXENTOS: Record<string, string> = {
  "packages/services/src/guardia-muro-cuenta.test.ts":
    "Esta misma prueba. Nombra la lectura prohibida para poder buscarla.",
};

function fuentes(arbol: string): string[] {
  const raiz = path.join(REPO, arbol);
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      if (entrada === "node_modules" || entrada === "dist" || entrada === ".next") continue;
      const completa = path.join(dir, entrada);
      if (statSync(completa).isDirectory()) recorrer(completa);
      else if (/\.(ts|tsx)$/.test(entrada)) salida.push(path.relative(REPO, completa));
    }
  };
  recorrer(raiz);
  return salida;
}

function leer(archivo: string): string {
  return readFileSync(path.join(REPO, archivo), "utf8");
}

/**
 * Cualquier mención de `getForImeis` que NO sea `getForImeisDeCuenta` — una
 * llamada, una definición, un mock en una prueba, un tipo. Deliberadamente
 * ancha: el método ya no existe, así que nombrarlo siquiera es la señal.
 */
function menciones(fuente: string): number {
  return (fuente.match(/getForImeis(?!DeCuenta)/g) ?? []).length;
}

describe("guardia · nadie reintroduce la lectura de telemetría sin cuenta", () => {
  const archivos = arboles().flatMap(fuentes).filter((a) => !(a in EXENTOS));

  it("el barrido encuentra código de verdad (guarda contra un falso verde)", () => {
    // Sin esto, una ruta mal escrita dejaría cero archivos que revisar y la
    // prueba de abajo pasaría por la razón equivocada.
    expect(archivos.length).toBeGreaterThan(300);
    expect(archivos).toContain("packages/db/src/repositories/index.ts");
    expect(archivos).toContain("packages/services/src/verification.ts");
    expect(archivos).toContain("apps/web/src/lib/monitoreo-data.ts");
    // Y los nueve paquetes más las dos apps siguen apareciendo.
    expect(arboles().length).toBeGreaterThanOrEqual(10);
  });

  it("ningún archivo nombra una lectura por IMEI sin cuenta", () => {
    const culpables = archivos.filter((a) => menciones(leer(a)) > 0);
    expect(
      culpables,
      "Estos archivos nombran una lectura de telemetry_points por IMEI sin cuenta. " +
        "El IMEI no es el muro: la única lectura válida es " +
        "repos.telemetry.getForImeisDeCuenta(carrierAccountId, imeis, desde, hasta). " +
        "Ver el comentario de ese método en packages/db/src/repositories/index.ts.",
    ).toEqual([]);
  });

  it("el repositorio ya no define getForImeis", () => {
    const repo = leer("packages/db/src/repositories/index.ts");
    expect(repo).not.toMatch(/async\s+getForImeis\s*\(/);
    // Y la que sí debe existir, existe: borrar las dos dejaría lo de arriba en verde.
    expect(repo).toMatch(/async\s+getForImeisDeCuenta\s*\(/);
  });

  it("los exentos siguen siendo exactamente los que están escritos aquí", () => {
    expect(Object.keys(EXENTOS)).toEqual([
      "packages/services/src/guardia-muro-cuenta.test.ts",
    ]);
  });
});

describe("guardia · el motor lee la evidencia con el muro de cuenta", () => {
  for (const archivo of CAMINO_DEL_VEREDICTO) {
    it(`${archivo} lee con getForImeisDeCuenta`, () => {
      // Que no exista la puerta no prueba que el motor esté leyendo: borrar la
      // lectura entera también quitaría la mención. Esto exige que lea, y con cuenta.
      expect(leer(archivo)).toContain("getForImeisDeCuenta(");
    });
  }
});

/**
 * El mismo muro, en `circuit_stop_passes` (los pasos por parada del detector).
 *
 * La tabla no lleva columna de cuenta: la visibilidad se deriva de los dos
 * dueños que sí existen —el del circuito y el de la unidad— y **tiene DOS
 * entradas** (Enmiendas de la Pieza 9, 9.14): la concesión dueña del circuito ve
 * todos los pasos; un carrier ve los de sus propias unidades, y nada más. Una
 * lectura por `stop_id` a secas le entrega a cualquier cuenta los pasos de las
 * paradas de otra, y una entrada abierta de más se abre para siempre. Esos pasos
 * son la evidencia de la comparación banda contra banda: el mismo daño que la
 * telemetría por IMEI, con la misma apariencia de dato correcto.
 *
 * Misma disciplina que arriba: la prueba lee el código, no el comportamiento,
 * para que una lectura nueva sin cuenta —o una cerradura aflojada— nazca en rojo.
 * El comportamiento lo mide, contra base de verdad, la matriz de
 * `paso-por-parada.integration.test.ts` (dos carriers en el mismo circuito); esta
 * valla corre sin base y exige que esa matriz siga existiendo.
 *
 *  1. **Nadie más toca la tabla.** Solo el esquema, el repositorio de pasos y
 *     la prueba de integración que siembra filas. Una pantalla o un servicio
 *     que la consulte por su cuenta se salta el muro: tiene que pasar por el
 *     repositorio.
 *  2. **Dentro del repositorio, todo lo que no sea insertar cruza con
 *     `pasosVisiblesParaCuenta`** — la única puerta. Insertar no lee; la cuenta
 *     la trae el circuito con el que el orquestador llama.
 *  3. **La puerta conserva sus tres piezas**: la concesión del circuito, y, para
 *     el carrier, que la unidad sea suya Y que él mismo la haya asignado a ESE
 *     circuito. Quitar una la deja abierta de más sin romper ninguna otra prueba
 *     que no siembre a dos carriers.
 *  4. **`compararPasosDeParada` sigue exclusivo de la concesión.** Que un carrier
 *     se mida contra los camiones de otro es comparación, valor reservado de
 *     J-Tel, por circuito y por acuerdo (9.14). Sobre las filas de un carrier el
 *     «paso anterior» se saltaría a los demás y daría un ATRASADA falso.
 */
const TOCAN_LA_TABLA_DE_PASOS: Record<string, string> = {
  "packages/db/src/schema/index.ts": "Define la tabla.",
  "packages/db/src/repositories/index.ts": "El único repositorio que la lee; su lectura se revisa abajo.",
  "packages/db/src/paso-por-parada.integration.test.ts":
    "Siembra y limpia filas en la base de prueba (nunca producción); no es un camino de la aplicación.",
  "packages/db/src/escenario-torre.ts":
    "Siembra el escenario para MIRAR la torre, sólo en la rama desechable (candado-desechable) y con --limpiar; no es un camino de la aplicación.",
};

/** Sin comentarios: uno que nombre una pieza del muro no puede contar como si estuviera. */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** El texto de un bloque, desde donde empieza hasta su cierre, sin comentarios; `""` si no lo encuentra. */
function cuerpoDe(fuente: string, inicio: RegExp, cierre: RegExp): string {
  const desde = fuente.search(inicio);
  if (desde < 0) return "";
  const resto = fuente.slice(desde);
  const hasta = resto.slice(1).search(cierre);
  return sinComentarios(hasta < 0 ? resto : resto.slice(0, hasta + 1 + 1));
}

function metodosDelRepositorioDePasos(): string[] {
  const repo = leer("packages/db/src/repositories/index.ts");
  const inicio = repo.indexOf("export class PasoPorParadaRepository");
  if (inicio < 0) return [];
  const resto = repo.slice(inicio);
  const fin = resto.indexOf("\nexport ", 1);
  // Sin comentarios: uno que nombre la tabla (o el muro) no puede contar como lectura (ni como muro).
  const clase = (fin < 0 ? resto : resto.slice(0, fin)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return clase.split(/\n(?=  (?:async\s+)?[a-zA-Z]+\()/);
}

describe("guardia · nadie lee los pasos por parada sin el muro de cuenta", () => {
  const archivos = arboles().flatMap(fuentes).filter((a) => !(a in EXENTOS));

  it("el repositorio de pasos existe y el barrido lo ve (guarda contra un falso verde)", () => {
    const metodos = metodosDelRepositorioDePasos();
    expect(metodos.length).toBeGreaterThan(2);
    expect(metodos.some((m) => /async\s+listarPasosDeParada\s*\(\s*cuentaId/.test(m))).toBe(true);
    for (const a of Object.keys(TOCAN_LA_TABLA_DE_PASOS)) expect(archivos).toContain(a);
  });

  it("ningún archivo fuera de la lista toca circuit_stop_passes", () => {
    const culpables = archivos.filter(
      (a) => !(a in TOCAN_LA_TABLA_DE_PASOS) && /circuitStopPasses|circuit_stop_passes/.test(leer(a)),
    );
    expect(
      culpables,
      "Estos archivos consultan circuit_stop_passes por su cuenta. La única lectura válida es " +
        "repos.pasosPorParada.listarPasosDeParada(concessionAccountId, stopId), que filtra por " +
        "la cuenta dueña del circuito. Ver el comentario de ese método.",
    ).toEqual([]);
  });

  it("todo método del repositorio que lee la tabla la cruza con pasosVisiblesParaCuenta", () => {
    const sinMuro = metodosDelRepositorioDePasos()
      .map((m) => m.replace(/\.insert\(circuitStopPasses\)/g, ""))
      .filter((m) => /circuitStopPasses|circuit_stop_passes/.test(m))
      .filter((m) => !m.includes("pasosVisiblesParaCuenta("))
      .map((m) => m.trim().split("\n")[0]);
    expect(
      sinMuro,
      "Estos métodos de PasoPorParadaRepository leen circuit_stop_passes sin pasar por " +
        "pasosVisiblesParaCuenta. Sin ese cruce, una cuenta lee los pasos de otra.",
    ).toEqual([]);
  });

  it("la puerta conserva sus tres piezas: la concesión, la unidad propia y la asignación propia", () => {
    const puerta = cuerpoDe(
      leer("packages/db/src/repositories/index.ts"),
      /^function pasosVisiblesParaCuenta\(/m,
      /^}\n/m,
    );
    expect(puerta, "no encuentro pasosVisiblesParaCuenta en el repositorio").not.toBe("");
    const piezas: Array<[string, RegExp]> = [
      [
        "la concesión dueña del circuito de ESE paso",
        /\$\{circuits\.id\}\s*=\s*\$\{circuitStopPasses\.circuitId\}\s*AND\s*\$\{circuits\.concessionAccountId\}\s*=\s*\$\{cuentaId\}/,
      ],
      [
        "la unidad del paso es del carrier",
        /\$\{units\.id\}\s*=\s*\$\{circuitStopPasses\.unitId\}\s*AND\s*\$\{units\.carrierAccountId\}\s*=\s*\$\{cuentaId\}/,
      ],
      [
        "el carrier asignó ESA unidad a ESE circuito (cerradura 2)",
        /\$\{circuitUnitAssignments\.circuitId\}\s*=\s*\$\{circuitStopPasses\.circuitId\}\s*AND\s*\$\{circuitUnitAssignments\.unitId\}\s*=\s*\$\{circuitStopPasses\.unitId\}\s*AND\s*\$\{circuitUnitAssignments\.carrierAccountId\}\s*=\s*\$\{cuentaId\}/,
      ],
      // Las dos cerraduras del carrier se juntan con AND: con OR bastaría una.
      ["las dos cerraduras del carrier van con AND, no con OR", /`,\s*and\(\s*sql`EXISTS[\s\S]*?`,\s*sql`EXISTS/],
    ];
    const faltan = piezas.filter(([, re]) => !re.test(puerta)).map(([nombre]) => nombre);
    expect(
      faltan,
      "pasosVisiblesParaCuenta perdió una cerradura. Sin ella el muro se abre de más — y lo que se abre " +
        "en un muro de cuenta se abre para siempre. Ver el comentario de la función y la 9.14.",
    ).toEqual([]);
  });

  it("el circuito responde como inexistente con las mismas dos cerraduras (getCircuitVisibleParaCuenta)", () => {
    const metodo = cuerpoDe(
      leer("packages/db/src/repositories/index.ts"),
      /^  async getCircuitVisibleParaCuenta\(/m,
      /^  }\n/m,
    );
    expect(metodo, "no encuentro getCircuitVisibleParaCuenta en el repositorio").not.toBe("");
    const piezas: Array<[string, RegExp]> = [
      ["la concesión dueña", /eq\(circuits\.concessionAccountId,\s*cuentaId\)/],
      [
        "la unidad es del carrier y la asignó él",
        /\$\{circuitUnitAssignments\.circuitId\}\s*=\s*\$\{circuits\.id\}\s*AND\s*\$\{circuitUnitAssignments\.carrierAccountId\}\s*=\s*\$\{cuentaId\}\s*AND\s*\$\{units\.carrierAccountId\}\s*=\s*\$\{cuentaId\}/,
      ],
      ["la asignación se junta con SU unidad", /\$\{units\.id\}\s*=\s*\$\{circuitUnitAssignments\.unitId\}/],
    ];
    const faltan = piezas.filter(([, re]) => !re.test(metodo)).map(([nombre]) => nombre);
    expect(faltan, "getCircuitVisibleParaCuenta perdió una cerradura: un circuito ajeno dejaría de responder como inexistente.").toEqual([]);
  });

  it("compararPasosDeParada sigue exclusivo de la concesión (9.14: la comparación entre carriers es de J-Tel)", () => {
    const servicio = sinComentarios(leer("packages/services/src/comparar-pasos-por-parada.ts"));
    // La comprobación de concesión sigue ahí...
    expect(servicio).toMatch(/circuito\.concessionAccountId\s*!==\s*input\.concessionAccountId/);
    // ...y nadie la cambió por la del carrier: eso abriría la comparación sobre un flujo incompleto.
    expect(
      servicio,
      "compararPasosDeParada ya no es exclusivo de la concesión. Sobre las filas de un carrier el «paso " +
        "anterior» se salta a los demás carriers y produce un ATRASADA falso; y medir a un carrier contra otro " +
        "es valor reservado de J-Tel (9.14), por circuito y por acuerdo. Si esto es a propósito, es otra " +
        "tarea con su propia decisión — no un cambio de una línea.",
    ).not.toContain("getCircuitVisibleParaCuenta");
  });

  it("la matriz sembrada de dos carriers en el mismo circuito sigue existiendo (esta valla no puede sembrar)", () => {
    const matriz = leer("packages/db/src/paso-por-parada.integration.test.ts");
    expect(matriz).toContain("dos carriers en el mismo circuito");
    expect(matriz).toContain("getCircuitVisibleParaCuenta(");
    expect(matriz).toContain("listarPasosDeParada(");
  });

  it("la lista de archivos que tocan la tabla es exactamente la escrita aquí", () => {
    expect(Object.keys(TOCAN_LA_TABLA_DE_PASOS)).toEqual([
      "packages/db/src/schema/index.ts",
      "packages/db/src/repositories/index.ts",
      "packages/db/src/paso-por-parada.integration.test.ts",
      "packages/db/src/escenario-torre.ts",
    ]);
  });
});

/**
 * El mismo muro, en la PUERTA DE POSICIONES de la torre (Paso 1.A).
 *
 * `listPlanDelCircuitoConPosicion` trae TODAS las unidades del circuito con el
 * nombre de su transportista. Es la vista de J-Staff y de la concesión, y para
 * el carrier es una fuga: en un circuito que corren dos, le entrega los
 * camiones del otro, dónde están y cómo se llama. Filtrarla en la pantalla deja
 * la garantía en el código de turno —el que cambia—, y la fuga vuelve con el
 * siguiente que escriba esa pantalla sin haber leído ésta.
 *
 * La puerta con muro es `planDelCircuitoParaCuenta(cuentaId, circuitId)`, y
 * esta valla exige cuatro cosas:
 *
 *  1. **Nadie más nombra la consulta sin cuenta.** Lista corta y escrita, como
 *     la de los pasos. Ninguna cara del carrier en ella.
 *  2. **La puerta conserva sus cerraduras**: la concesión dueña, y —para el
 *     carrier— que la unidad sea suya Y que él mismo la haya asignado a ESE
 *     circuito, juntas con `AND`. Con `OR` bastaría una.
 *  3. **El plan es lo VIGENTE** (`valid_to IS NULL`). Sin eso, la torre de hoy
 *     se llena de camiones que salieron del circuito hace un mes.
 *  4. **No se filtra por `live_positions.carrier_account_id`.** La columna
 *     existe y es cómoda, pero la escribe el recolector, no el alta: sería una
 *     tercera fuente de verdad sobre de quién es una unidad, y tres
 *     definiciones de lo mismo se separan igual que dos.
 *
 * Corre sin base, como el resto de esta valla; el comportamiento lo mide la
 * matriz sembrada de `paso-por-parada.integration.test.ts`, y aquí se exige que
 * siga existiendo.
 */
const VEN_EL_PLAN_COMPLETO: Record<string, string> = {
  "packages/db/src/repositories/index.ts": "Define las dos consultas; la de la cuenta se revisa abajo.",
  "apps/web/src/app/jstaff/circuitos/[id]/operar/page.tsx": "J-Staff, que ve todo (Pieza 4).",
  "apps/web/src/app/jstaff/circuitos/[id]/reporte/page.tsx": "J-Staff, que ve todo (Pieza 4).",
};

describe("guardia · nadie lee el plan del circuito sin el muro de cuenta", () => {
  const archivos = arboles().flatMap(fuentes).filter((a) => !(a in EXENTOS));
  const repo = () => leer("packages/db/src/repositories/index.ts");

  it("la puerta con muro existe y toma la cuenta PRIMERO (guarda contra un falso verde)", () => {
    expect(repo()).toMatch(/async\s+planDelCircuitoParaCuenta\(\s*cuentaId/);
    // Y la de J-Staff sigue existiendo: borrar las dos dejaría lo de abajo en verde.
    expect(repo()).toMatch(/async\s+listPlanDelCircuitoConPosicion\(/);
    for (const a of Object.keys(VEN_EL_PLAN_COMPLETO)) expect(archivos).toContain(a);
  });

  it("ningún archivo fuera de la lista nombra listPlanDelCircuitoConPosicion", () => {
    const culpables = archivos.filter(
      (a) => !(a in VEN_EL_PLAN_COMPLETO) && /listPlanDelCircuitoConPosicion/.test(leer(a)),
    );
    expect(
      culpables,
      "Estos archivos usan el plan SIN cuenta. Trae todas las unidades del circuito con el nombre de su " +
        "transportista: en un circuito que corren dos, le entrega a cada uno los camiones del otro. La " +
        "lectura con muro es repos.circuits.planDelCircuitoParaCuenta(cuentaId, circuitId).",
    ).toEqual([]);
  });

  it("ninguna cara del carrier la nombra — el daño tiene nombre y se busca por su nombre", () => {
    // Redundante con la de arriba a propósito: si algún día alguien agrega una
    // cara del carrier a la lista de exentos, esto sigue en rojo.
    const caras = archivos.filter((a) => /(^|\/)(carrier|transportista)(\/|$)/.test(a) || a.includes("/carrier/"));
    expect(caras.length, "no encuentro la cara del carrier: la ruta cambió y esta prueba dejó de medir").toBeGreaterThan(0);
    const culpables = caras.filter((a) => /listPlanDelCircuitoConPosicion/.test(leer(a)));
    expect(culpables, "Una cara del carrier está leyendo el plan sin cuenta.").toEqual([]);
  });

  it("la puerta conserva sus cerraduras y abre sólo después del muro del circuito", () => {
    const metodo = cuerpoDe(repo(), /^  async planDelCircuitoParaCuenta\(/m, /^  }\n/m);
    expect(metodo, "no encuentro planDelCircuitoParaCuenta en el repositorio").not.toBe("");
    const piezas: Array<[string, RegExp]> = [
      [
        "abre sólo después de que el circuito exista para esa cuenta",
        /getCircuitVisibleParaCuenta\(\s*cuentaId,\s*circuitId\s*\)/,
      ],
      ["y si no existe, responde como un circuito inexistente", /alcance:\s*"ninguno"/],
      [
        "la concesión dueña del circuito",
        /\$\{circuits\.concessionAccountId\}\s*=\s*\$\{cuentaId\}/,
      ],
      [
        "las DOS cerraduras del carrier, juntas con AND (con OR bastaría una)",
        /and\(\s*eq\(circuitUnitAssignments\.carrierAccountId,\s*cuentaId\),\s*eq\(units\.carrierAccountId,\s*cuentaId\),?\s*\)/,
      ],
      ["el plan es lo VIGENTE", /isNull\(circuitUnitAssignments\.validTo\)/],
      ["una sola fila por unidad (dos aparatos vigentes envenenan el conteo)", /porUnidad\.set\(/],
    ];
    const faltan = piezas.filter(([, re]) => !re.test(metodo)).map(([nombre]) => nombre);
    expect(
      faltan,
      "planDelCircuitoParaCuenta perdió una pieza. Lo que se abre en un muro de cuenta se abre para siempre.",
    ).toEqual([]);
  });

  it("la puerta NO filtra por live_positions.carrier_account_id (la tercera fuente de verdad)", () => {
    const metodo = cuerpoDe(repo(), /^  async planDelCircuitoParaCuenta\(/m, /^  }\n/m);
    expect(
      metodo,
      "La cuenta de live_positions la escribe el recolector, no el alta. Sería una tercera definición de " +
        "«de quién es esta unidad», al lado del alta y de la asignación — y se separa de las otras dos. " +
        "El muro va sobre units.carrier_account_id y circuit_unit_assignments.carrier_account_id.",
    ).not.toMatch(/livePositions\.carrierAccountId/);
  });

  it("la fila que recibe el carrier no tiene dónde colarse el nombre de otro transportista", () => {
    const tipo = cuerpoDe(repo(), /^export interface UnidadDelPlanConPosicion \{/m, /^}\n/m);
    expect(tipo, "no encuentro UnidadDelPlanConPosicion").not.toBe("");
    expect(
      tipo,
      "UnidadDelPlanConPosicion es la fila que ve el carrier: si gana un campo de transportista, hay dónde " +
        "escribir el de otro. El que lleva transportista es UnidadDelPlanConCarrier, y sólo la concesión lo recibe.",
    ).not.toMatch(/carrier/i);
  });

  it("la matriz sembrada mide también esta puerta (esta valla no puede sembrar)", () => {
    const matriz = leer("packages/db/src/paso-por-parada.integration.test.ts");
    expect(matriz).toContain("dos carriers en el mismo circuito");
    expect(matriz).toContain("planDelCircuitoParaCuenta(");
  });

  it("la lista de quienes ven el plan completo es exactamente la escrita aquí", () => {
    expect(Object.keys(VEN_EL_PLAN_COMPLETO)).toEqual([
      "packages/db/src/repositories/index.ts",
      "apps/web/src/app/jstaff/circuitos/[id]/operar/page.tsx",
      "apps/web/src/app/jstaff/circuitos/[id]/reporte/page.tsx",
    ]);
  });
});

/**
 * La TORRE: que nadie derive un estado sobre un flujo que no ve entero (9.14).
 *
 * Es el mismo daño del muro, una capa más arriba y con otra cara. El muro ya
 * impide que un carrier LEA los pasos de otro; lo que esta valla impide es que,
 * teniendo sólo los suyos, alguien calcule con ellos «el intervalo contra el
 * paso anterior» y pinte ATRASADA. El dato de entrada sería correcto y el
 * resultado, falso — la forma del Marco §D que más caro cuesta, porque se
 * defiende sola en una discusión.
 *
 * 9.14 lo dice como regla: **SIN DATOS antes que un número prestado.** La
 * comparación entre carriers es valor reservado de J-Tel, se habilita por
 * circuito y por acuerdo, nunca por default.
 *
 * Tres cosas se vigilan:
 *
 *  1. **La compuerta existe y se pasa hacia abajo.** No se consulta dentro de
 *     cada derivación —eso se puede borrar sin romper nada—: viaja como campo
 *     obligatorio, así que una derivación nueva que la olvide no compila.
 *  2. **La compuerta nace cerrada.** `comparacionCompartidaHabilitada` devuelve
 *     `false` hasta que el acuerdo por circuito exista en la base.
 *  3. **El vocabulario del motor no cruza el borde** (9.3b): `sostuvo`,
 *     `se_agujero` y «hueco» no salen de la capa de datos de la torre.
 */
const TORRE = "packages/services/src/torre-del-circuito.ts";

describe("guardia · la torre no deriva sobre un flujo que no ve entero (9.14)", () => {
  const archivos = arboles().flatMap(fuentes).filter((a) => !(a in EXENTOS));
  const torre = () => leer(TORRE);

  it("la capa de datos de la torre existe y el barrido la ve (guarda contra un falso verde)", () => {
    expect(archivos).toContain(TORRE);
    expect(torre()).toMatch(/export async function armarTorreDelCircuito\(/);
  });

  it("la compuerta se consulta una vez y la pasada de pasos nace vacía sin ella", () => {
    const fuente = sinComentarios(torre());
    expect(fuente, "la torre ya no le pregunta a la base si el circuito lo corren varios").toContain(
      "circuitoTieneMasDeUnCarrier(",
    );
    /*
     * La compuerta se aplica en la PASADA ÚNICA, y de ahí hereda todo lo demás:
     * con el flujo incompleto `medirTodosLosPasos` devuelve el arreglo vacío, y
     * ninguna cifra que coma de él puede inventar un veredicto. Es más fuerte
     * que preguntarle a cada derivación —ahí bastaba olvidar una—, pero sólo
     * mientras la pasada siga naciendo vacía: eso es lo que se vigila aquí.
     */
    // Exportada desde el 22-sep (la jornada la reusa: una sola vara); la regla que se vigila es la misma.
    const pasada = cuerpoDe(fuente, /^(?:export )?async function medirTodosLosPasos\(e: \{/m, /^\}\n/m);
    expect(pasada, "no encuentro medirTodosLosPasos").not.toBe("");
    expect(pasada, "medirTodosLosPasos dejó de recibir el flujo").toMatch(/flujo: FlujoDelServicio;/);
    expect(
      pasada.replace(/\s/g, ""),
      "Con el flujo incompleto, la pasada de pasos TIENE que nacer vacía. De ella comen el estado de cada " +
        "unidad, el sostenimiento y los dos detalles; si trae filas de un solo carrier, las tres afirman " +
        "sobre un flujo que la cuenta no ve entero y sale el ATRASADA falso (9.14).",
    ).toContain('if(e.flujo==="incompleto")return[];');
  });

  it("el veredicto de un paso se calcula en UN solo lugar", () => {
    /*
     * `ladoDeLaBanda` es lo que convierte un intervalo en ADELANTADA o ATRASADA.
     * Si aparece dos veces en este módulo, hay dos definiciones del mismo
     * veredicto: el día que se separen, la pieza dirá una cosa y el conteo de
     * arriba otra, las dos con cara de dato. Una sola llamada, en la pasada.
     */
    const veces = (sinComentarios(torre()).match(/ladoDeLaBanda\(/g) ?? []).length;
    expect(
      veces,
      "El lado de la banda se concluye más de una vez en la torre. Todo lo que se deriva de pasos sale de " +
        "`medirTodosLosPasos`; lo demás proyecta ese resultado, no lo recalcula.",
    ).toBe(1);
  });

  it("las derivaciones que todavía juzgan siguen recibiendo el flujo", () => {
    const fuente = sinComentarios(torre());
    const derivaciones = ["derivarUnidades", "derivarEsperas", "derivarRitmo"];
    const sinCompuerta = derivaciones.filter((d) => {
      const cuerpo = cuerpoDe(fuente, new RegExp(`^(?:async )?function ${d}\\(e: \\{`, "m"), /^\}\n/m);
      return !/flujo: FlujoDelServicio;/.test(cuerpo);
    });
    expect(
      sinCompuerta,
      "Estas derivaciones dejaron de recibir el flujo. La espera y el ritmo no salen de la pasada de pasos, " +
        "así que la compuerta tiene que llegarles por su cuenta (9.14).",
    ).toEqual([]);
  });

  it("la compuerta nace CERRADA: por default, nunca (9.14)", () => {
    const cuerpo = cuerpoDe(
      sinComentarios(torre()),
      /^function comparacionCompartidaHabilitada\(/m,
      /^\}\n/m,
    );
    expect(cuerpo, "no encuentro comparacionCompartidaHabilitada").not.toBe("");
    expect(
      cuerpo.replace(/\s/g, ""),
      "La comparación entre carriers es valor reservado de J-Tel: se habilita POR CIRCUITO y por acuerdo " +
        "de esa concesión, nunca por ley general ni por default (9.14). Si ya existe el acuerdo en la base, " +
        "esta función lo lee — no devuelve true a secas.",
    ).not.toMatch(/returntrue;/);
  });

  it("el vocabulario del motor no cruza el borde (9.3b)", () => {
    const fuente = sinComentarios(torre());
    for (const palabra of ["sostuvo", "se_agujero", "hueco"]) {
      expect(
        fuente,
        `«${palabra}» es nombre interno del motor y no sale de esta capa. En pantalla el vocabulario es ` +
          `EN RANGO · ADELANTADA · ATRASADA · SIN DATOS, y lo que una parada lleva sin que pase nadie se ` +
          `llama espera (9.3b).`,
      ).not.toContain(palabra);
    }
  });

  it("quien concluye un lado de la banda fuera del dominio, pasa por la compuerta", () => {
    const culpables = archivos.filter((a) => {
      if (a.startsWith("packages/domain/src")) return false; // ahí vive la función pura
      if (a.endsWith(".test.ts")) return false;
      const fuente = sinComentarios(leer(a));
      return /ladoDeLaBanda\(/.test(fuente) && !/FlujoDelServicio/.test(fuente);
    });
    expect(
      culpables,
      "Estos archivos concluyen ADELANTADA/ATRASADA sin declarar el flujo del servicio. Sobre los pasos de " +
        "un solo carrier de un circuito compartido, esa conclusión es falsa (9.14).",
    ).toEqual([]);
  });
});

/**
 * La LISTA de circuitos de una cuenta — el muro del cuarto (Paso 2).
 *
 * `listAllCircuits` trae todos los circuitos de la plataforma con el nombre de
 * su concesión: es de J-Staff, que ve todo. Si el cuarto del transportista la
 * usara y filtrara arriba, la fuga sería la de siempre — la garantía en el
 * código de turno— sólo que a nivel de lista: el menú de un carrier delataría
 * cuántos circuitos hay en la ciudad y de quién son.
 *
 * La lectura con muro es `listarCircuitosVisiblesParaCuenta(cuentaId)`, con las
 * mismas dos cerraduras de `getCircuitVisibleParaCuenta`. **Y contesta también
 * si la cuenta opera transporte público**, que es cómo el menú decide dibujar
 * el cuarto: una bandera aparte sería una segunda definición de lo mismo.
 */
const VEN_TODOS_LOS_CIRCUITOS: Record<string, string> = {
  "packages/db/src/repositories/index.ts": "Define las dos lecturas; la de la cuenta se revisa abajo.",
  "apps/web/src/app/jstaff/circuitos/page.tsx": "J-Staff, que ve todo (Pieza 4).",
  "apps/web/src/app/casa/jstaff/circuitos/page.tsx": "J-Staff en su casa nueva, que ve todo (Pieza 4).",
};

describe("guardia · nadie lista circuitos de otra cuenta", () => {
  const archivos = arboles().flatMap(fuentes).filter((a) => !(a in EXENTOS));
  const repo = () => leer("packages/db/src/repositories/index.ts");

  it("la lista con muro existe y toma la cuenta primero (guarda contra un falso verde)", () => {
    expect(repo()).toMatch(/async\s+listarCircuitosVisiblesParaCuenta\(\s*cuentaId/);
    expect(repo()).toMatch(/async\s+listAllCircuits\(/);
    for (const a of Object.keys(VEN_TODOS_LOS_CIRCUITOS)) expect(archivos).toContain(a);
  });

  it("ningún archivo fuera de la lista LLAMA a listAllCircuits ni a listCircuitsForConcession", () => {
    /*
     * Sin comentarios, y a diferencia de la valla de `getForImeis`: aquel
     * método ya no existe, así que nombrarlo siquiera es la señal. Éstos sí
     * existen —son de J-Staff, que ve todo—, y un comentario que explique por
     * qué NO se usan aquí es justo lo que uno quiere encontrar en un cuarto de
     * carrier, no una infracción que lo tumbe.
     */
    const culpables = archivos.filter(
      (a) =>
        !(a in VEN_TODOS_LOS_CIRCUITOS) &&
        /listAllCircuits|listCircuitsForConcession|resumenDeCircuitosParaJStaff/.test(sinComentarios(leer(a))),
    );
    expect(
      culpables,
      "Estos archivos listan circuitos SIN cuenta. `listAllCircuits` trae los de toda la plataforma con el " +
        "nombre de su concesión; la lectura con muro es " +
        "repos.circuits.listarCircuitosVisiblesParaCuenta(cuentaId).",
    ).toEqual([]);
  });

  it("la lista con muro conserva sus dos cerraduras", () => {
    const metodo = cuerpoDe(
      leer("packages/db/src/repositories/index.ts"),
      /^  async listarCircuitosVisiblesParaCuenta\(/m,
      /^  }\n/m,
    );
    expect(metodo, "no encuentro listarCircuitosVisiblesParaCuenta").not.toBe("");
    const piezas: Array<[string, RegExp]> = [
      ["la concesión dueña", /eq\(circuits\.concessionAccountId,\s*cuentaId\)/],
      [
        "la unidad es del carrier Y la asignó él (las dos, con AND)",
        /\$\{circuitUnitAssignments\.circuitId\}\s*=\s*\$\{circuits\.id\}\s*AND\s*\$\{circuitUnitAssignments\.carrierAccountId\}\s*=\s*\$\{cuentaId\}\s*AND\s*\$\{units\.carrierAccountId\}\s*=\s*\$\{cuentaId\}/,
      ],
      ["la asignación se junta con SU unidad", /\$\{units\.id\}\s*=\s*\$\{circuitUnitAssignments\.unitId\}/],
    ];
    const faltan = piezas.filter(([, re]) => !re.test(metodo)).map(([nombre]) => nombre);
    expect(
      faltan,
      "listarCircuitosVisiblesParaCuenta perdió una cerradura: el cuarto le enseñaría a una cuenta los " +
        "circuitos de otra.",
    ).toEqual([]);
  });

  it("«opera público» sale de la lista con muro, no de una bandera aparte", () => {
    const fuente = sinComentarios(leer("apps/web/src/lib/casa/cuenta-del-cuarto.ts"));
    expect(
      fuente,
      "operaPublico decide si el menú dibuja el cuarto Circuitos. Tiene que salir de " +
        "listarCircuitosVisiblesParaCuenta —la misma lectura que llena el cuarto—: con una bandera aparte, " +
        "el día que las dos se separen el menú enseña un cuarto vacío o esconde uno lleno.",
    ).toContain("listarCircuitosVisiblesParaCuenta(");
    expect(fuente, "operaPublico volvió a estar horneado en false").not.toMatch(/operaPublico:\s*false/);
  });

  it("la lista de quienes ven todos los circuitos es exactamente la escrita aquí", () => {
    expect(Object.keys(VEN_TODOS_LOS_CIRCUITOS)).toEqual([
      "packages/db/src/repositories/index.ts",
      "apps/web/src/app/jstaff/circuitos/page.tsx",
      // El cuarto Circuitos en la casa nueva de J-Staff (21-sep-2026); la vieja se retira en el PR D.
      "apps/web/src/app/casa/jstaff/circuitos/page.tsx",
    ]);
  });
});
