/**
 * ¿Cada base tiene lo que las migraciones del repo dicen que debería tener?
 *
 * SOLO LECTURA. Sale con código 1 si a alguna base le falta algo.
 *
 * ---
 *
 * ## Por qué existe, y por qué `esquema.yml` no lo cubre
 *
 * El workflow `esquema` construye una base **desde cero** con las migraciones y
 * comprueba que sirva para lo que el código pide. Es la puerta correcta para
 * «¿las migraciones son coherentes con el esquema?» — y **no puede ver** la otra
 * pregunta: **«¿esta base de aquí las tiene aplicadas?»**. Una base que existe y
 * se quedó atrás pasa ese workflow en verde todos los días.
 *
 * 🟢 **Y ya mordió dos veces.** El 2 de agosto de 2026 la cara cliente entera
 * devolvió 500 con `column compliance_facts.declared_driver_name does not exist`:
 * la `0016` estaba commiteada y **nadie la había aplicado**. El 13 de agosto,
 * las pruebas de integración reventaron con `column candidatas_snapshot does not
 * exist` — **la rama desechable estaba DOS migraciones atrás**, y nada lo
 * vigilaba.
 *
 * ## Cómo sabe si una migración está aplicada
 *
 * **Producción no tiene la bitácora del migrador** (`__drizzle_migrations` no
 * existe ahí; el esquema se construyó por otro camino). Así que no hay una lista
 * de «lo aplicado» que consultar.
 *
 * Se pregunta por el EFECTO: de cada `.sql` se extraen los objetos que crea
 * —tablas, columnas, tipos, índices, triggers, funciones— y se comprueba contra
 * el catálogo de Postgres. **La huella se deriva del propio SQL commiteado**, así
 * que no puede quedarse vieja: si alguien agrega una migración, su huella sale
 * sola.
 *
 * ⚠ **Lo que esto NO dice, y hay que leerlo antes que los resultados:** detecta
 * que los objetos EXISTEN, no que la migración se haya ejecutado. Si alguien
 * creó la columna a mano, aquí sale «aplicada» — y para la pregunta que importa
 * («¿esta base tiene lo que el código necesita?») **eso es la respuesta
 * correcta**. Para «¿quién y cuándo?» no sirve, y no pretende.
 *
 * ⚠ **Y una migración que solo mueve datos no crea objetos:** sale como «sin
 * objetos que comprobar» y **se declara**, no se cuenta como aprobada. Un cero
 * disfrazado de verde es justo lo que este repo ya pagó.
 *
 *   pnpm --filter @jtel/db verificar-migraciones
 *
 * Mira `DATABASE_URL_READONLY` (producción) y `DATABASE_URL_TEST` (desechable).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {
      /* ignore */
    }
  }
}

export type ObjetoEsperado =
  | { tipo: "tabla"; nombre: string }
  | { tipo: "columna"; tabla: string; nombre: string }
  | { tipo: "tipo"; nombre: string }
  | { tipo: "indice"; nombre: string }
  | { tipo: "trigger"; nombre: string }
  | { tipo: "funcion"; nombre: string }
  | { tipo: "valor_enum"; tipo_enum: string; nombre: string };

/**
 * El nombre del objeto, sin comillas ni esquema.
 *
 * ⚠ Tiene que partir por el punto DESPUÉS de quitar las comillas: los
 * identificadores calificados vienen como `"public"."evidence_status"`, y una
 * primera versión que solo quitaba el prefijo `public.` sin comillas dejaba
 * **`public`** como nombre del objeto — y reportaba «falta tipo public» ocho
 * veces. El síntoma era ruidoso y por eso se cachó; si hubiera sido silencioso,
 * la valla habría aprobado bases incompletas.
 */
function limpio(ident: string): string {
  const partes = ident.replace(/"/g, "").trim().split(".");
  return partes[partes.length - 1]!;
}

/** Un identificador, con o sin esquema, con o sin comillas. */
const IDENT = String.raw`(?:"?\w+"?\.)?"?\w+"?`;

/**
 * Los objetos que una migración crea, sacados de su propio SQL.
 *
 * Deliberadamente **solo lo que CREA**. Un `DROP` no deja huella que comprobar
 * —su efecto es una ausencia— y confundir «no está porque se borró» con «no está
 * porque falta» sería peor que no mirar.
 */
export function objetosDe(sql: string): ObjetoEsperado[] {
  const fuera: ObjetoEsperado[] = [];
  // Se ignoran los comentarios: los encabezados de este repo traen SQL de
  // ejemplo dentro, y contarlo daría objetos que la migración no crea.
  const limpiado = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

  for (const m of limpiado.matchAll(
    new RegExp(String.raw`CREATE TABLE (?:IF NOT EXISTS )?(${IDENT})`, "gi"),
  )) {
    fuera.push({ tipo: "tabla", nombre: limpio(m[1]!) });
  }
  for (const m of limpiado.matchAll(
    new RegExp(String.raw`ALTER TABLE (${IDENT})\s+ADD COLUMN (?:IF NOT EXISTS )?("?\w+"?)`, "gi"),
  )) {
    fuera.push({ tipo: "columna", tabla: limpio(m[1]!), nombre: limpio(m[2]!) });
  }
  for (const m of limpiado.matchAll(new RegExp(String.raw`CREATE TYPE (${IDENT})`, "gi"))) {
    fuera.push({ tipo: "tipo", nombre: limpio(m[1]!) });
  }
  for (const m of limpiado.matchAll(
    /CREATE (?:UNIQUE )?INDEX (?:CONCURRENTLY )?(?:IF NOT EXISTS )?("?\w+"?)/gi,
  )) {
    fuera.push({ tipo: "indice", nombre: limpio(m[1]!) });
  }
  for (const m of limpiado.matchAll(/CREATE TRIGGER ("?\w+"?)/gi)) {
    fuera.push({ tipo: "trigger", nombre: limpio(m[1]!) });
  }
  for (const m of limpiado.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ("?\w+"?)/gi)) {
    fuera.push({ tipo: "funcion", nombre: limpio(m[1]!) });
  }
  for (const m of limpiado.matchAll(
    new RegExp(String.raw`ALTER TYPE (${IDENT})\s+ADD VALUE (?:IF NOT EXISTS )?'([^']+)'`, "gi"),
  )) {
    fuera.push({ tipo: "valor_enum", tipo_enum: limpio(m[1]!), nombre: m[2]! });
  }
  return fuera;
}

/**
 * Lo que una migración BORRA, para descontarlo de lo que se espera encontrar.
 *
 * ⚠ **Esto no es un detalle: sin ello la valla miente.** La `0000` crea
 * `route_shift_kml_versions` y la `0003` la borra — así que esa tabla **no debe
 * existir**, y una valla que solo mira lo creado la reporta como faltante **en
 * las dos bases**, que es exactamente el falso positivo con el que arrancó.
 *
 * Un falso positivo aquí es caro de otra forma que en otras vallas: enseña a
 * ignorarla, y una valla que se ignora ya no es una valla.
 */
export function borradosDe(sql: string): ObjetoEsperado[] {
  const fuera: ObjetoEsperado[] = [];
  const limpiado = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

  for (const m of limpiado.matchAll(
    new RegExp(String.raw`DROP TABLE (?:IF EXISTS )?(${IDENT})`, "gi"),
  )) {
    fuera.push({ tipo: "tabla", nombre: limpio(m[1]!) });
  }
  for (const m of limpiado.matchAll(
    new RegExp(String.raw`ALTER TABLE (${IDENT})\s+DROP COLUMN (?:IF EXISTS )?("?\w+"?)`, "gi"),
  )) {
    fuera.push({ tipo: "columna", tabla: limpio(m[1]!), nombre: limpio(m[2]!) });
  }
  for (const m of limpiado.matchAll(
    new RegExp(String.raw`DROP INDEX (?:CONCURRENTLY )?(?:IF EXISTS )?(${IDENT})`, "gi"),
  )) {
    fuera.push({ tipo: "indice", nombre: limpio(m[1]!) });
  }
  for (const m of limpiado.matchAll(
    new RegExp(String.raw`DROP TYPE (?:IF EXISTS )?(${IDENT})`, "gi"),
  )) {
    fuera.push({ tipo: "tipo", nombre: limpio(m[1]!) });
  }
  return fuera;
}

/** Clave estable de un objeto, para poder descontar los borrados. */
export function claveDe(o: ObjetoEsperado): string {
  if (o.tipo === "columna") return `columna:${o.tabla}.${o.nombre}`;
  if (o.tipo === "valor_enum") return `valor_enum:${o.tipo_enum}.${o.nombre}`;
  return `${o.tipo}:${o.nombre}`;
}

type Catalogo = {
  tablas: Set<string>;
  columnas: Set<string>;
  tipos: Set<string>;
  indices: Set<string>;
  triggers: Set<string>;
  funciones: Set<string>;
  valoresEnum: Set<string>;
};

async function leerCatalogo(url: string): Promise<Catalogo> {
  const sql = postgres(url, { max: 1 });
  try {
    const tablas = await sql<Array<{ n: string }>>`
      SELECT table_name AS n FROM information_schema.tables WHERE table_schema='public'`;
    const columnas = await sql<Array<{ t: string; c: string }>>`
      SELECT table_name AS t, column_name AS c FROM information_schema.columns
       WHERE table_schema='public'`;
    const tipos = await sql<Array<{ n: string }>>`
      SELECT typname AS n FROM pg_type t
       JOIN pg_namespace ns ON ns.oid = t.typnamespace WHERE ns.nspname='public'`;
    const indices = await sql<Array<{ n: string }>>`
      SELECT indexname AS n FROM pg_indexes WHERE schemaname='public'`;
    const triggers = await sql<Array<{ n: string }>>`
      SELECT tgname AS n FROM pg_trigger WHERE NOT tgisinternal`;
    const funciones = await sql<Array<{ n: string }>>`
      SELECT proname AS n FROM pg_proc p
       JOIN pg_namespace ns ON ns.oid = p.pronamespace WHERE ns.nspname='public'`;
    const valores = await sql<Array<{ t: string; v: string }>>`
      SELECT t.typname AS t, e.enumlabel AS v FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid`;
    return {
      tablas: new Set(tablas.map((r) => r.n)),
      columnas: new Set(columnas.map((r) => `${r.t}.${r.c}`)),
      tipos: new Set(tipos.map((r) => r.n)),
      indices: new Set(indices.map((r) => r.n)),
      triggers: new Set(triggers.map((r) => r.n)),
      funciones: new Set(funciones.map((r) => r.n)),
      valoresEnum: new Set(valores.map((r) => `${r.t}.${r.v}`)),
    };
  } finally {
    await sql.end();
  }
}

export function falta(o: ObjetoEsperado, c: Catalogo): boolean {
  switch (o.tipo) {
    case "tabla":
      return !c.tablas.has(o.nombre);
    case "columna":
      return !c.columnas.has(`${o.tabla}.${o.nombre}`);
    case "tipo":
      return !c.tipos.has(o.nombre);
    case "indice":
      return !c.indices.has(o.nombre);
    case "trigger":
      return !c.triggers.has(o.nombre);
    case "funcion":
      return !c.funciones.has(o.nombre);
    case "valor_enum":
      return !c.valoresEnum.has(`${o.tipo_enum}.${o.nombre}`);
  }
}

function describir(o: ObjetoEsperado): string {
  if (o.tipo === "columna") return `columna ${o.tabla}.${o.nombre}`;
  if (o.tipo === "valor_enum") return `valor ${o.tipo_enum}='${o.nombre}'`;
  return `${o.tipo} ${o.nombre}`;
}

async function main() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
  const archivos = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const bases: Array<{ nombre: string; url: string | undefined }> = [
    { nombre: "producción", url: process.env.DATABASE_URL_READONLY },
    { nombre: "desechable", url: process.env.DATABASE_URL_TEST },
  ];

  console.log(`\n  ¿Cada base tiene lo que las migraciones dicen?`);
  console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura`);
  console.log(`  Migraciones en el repo: ${archivos.length}\n`);

  let problemas = 0;

  for (const base of bases) {
    if (!base.url) {
      console.log(`  ${base.nombre}: sin URL configurada — no se pudo mirar\n`);
      /*
       * No mirar NO es aprobar. Se cuenta como problema: una base que nadie
       * revisó se ve igual de verde que una al día, y ése es justo el fallo que
       * esta valla existe para no repetir.
       */
      problemas++;
      continue;
    }

    const catalogo = await leerCatalogo(base.url);
    const faltantes: Array<{ archivo: string; objetos: string[] }> = [];
    const sinObjetos: string[] = [];

    /*
     * Lo que CUALQUIER migración borra deja de esperarse — aunque la borre una
     * posterior a la que lo creó, que es el caso real: la 0000 crea
     * `route_shift_kml_versions` y la 0003 la borra.
     */
    const borrados = new Set<string>();
    for (const archivo of archivos) {
      for (const b of borradosDe(readFileSync(join(dir, archivo), "utf8"))) {
        borrados.add(claveDe(b));
      }
    }

    for (const archivo of archivos) {
      const objetos = objetosDe(readFileSync(join(dir, archivo), "utf8")).filter(
        (o) => !borrados.has(claveDe(o)),
      );
      if (objetos.length === 0) {
        sinObjetos.push(archivo);
        continue;
      }
      const ausentes = objetos.filter((o) => falta(o, catalogo)).map(describir);
      if (ausentes.length > 0) faltantes.push({ archivo, objetos: ausentes });
    }

    const alDia = archivos.length - faltantes.length - sinObjetos.length;
    console.log(`  ${base.nombre}`);
    console.log(`    al día ....................... ${alDia}`);
    console.log(`    con algo faltante ............ ${faltantes.length}`);
    console.log(`    sin objetos que comprobar .... ${sinObjetos.length}`);
    if (sinObjetos.length > 0) {
      // Se declaran: no crean nada, así que su verde no significa «aplicada».
      console.log(`      (${sinObjetos.join(", ")})`);
    }
    for (const f of faltantes) {
      console.log(`\n    ✗ ${f.archivo}`);
      for (const o of f.objetos.slice(0, 8)) console.log(`        falta ${o}`);
      if (f.objetos.length > 8) console.log(`        …y ${f.objetos.length - 8} más`);
    }
    if (faltantes.length > 0) problemas++;
    console.log("");
  }

  if (problemas === 0) {
    console.log(`  ✓ las dos bases tienen lo que el repo dice\n`);
  } else {
    console.log(
      `  ✗ ${problemas} base(s) con problemas.\n\n` +
        `  Un .sql commiteado NO es una migración aplicada. Aplícala con SQL\n` +
        `  directo —ver docs/Procedimiento-Migraciones.md— y vuelve a correr esto.\n`,
    );
  }
  process.exit(problemas === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
