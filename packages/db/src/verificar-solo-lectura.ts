/**
 * ¿El usuario de solo lectura de verdad no puede escribir?
 *
 * `DATABASE_URL_READONLY` existe para que las lecturas de verificación contra
 * producción —las de antes y después de una migración, las de un diagnóstico—
 * no puedan tocar nada ni por accidente. Pero "solo lectura" es una afirmación
 * sobre permisos, y una afirmación sin comprobar es una suposición: basta que
 * a alguien se le pase un `GRANT` de más, o que la variable apunte al usuario
 * dueño por un copiar-pegar, para que la red de seguridad no exista y nadie se
 * entere hasta que sea tarde.
 *
 * Esto lo comprueba preguntándole al catálogo de Postgres, que es quien decide.
 * **No intenta escribir nada**: un `INSERT` de prueba contra producción, aunque
 * se revierta, es exactamente lo que este archivo existe para evitar.
 *
 *   DATABASE_URL_READONLY=... pnpm --filter @jtel/db verificar-solo-lectura
 *
 * Sale con código 1 si algo no cuadra, para poder encadenarlo.
 */
import { existsSync } from "node:fs";
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

const ESCRITURAS = ["INSERT", "UPDATE", "DELETE", "TRUNCATE"] as const;

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL_READONLY. Es la credencial de solo lectura: sin ella, " +
        "las verificaciones contra producción corren con el usuario dueño y la " +
        "red de seguridad no existe.",
    );
  }

  /*
   * El error más caro no es un GRANT de más: es que la variable apunte al
   * dueño por un copiar-pegar. Eso no lo detecta ninguna revisión de permisos
   * —el dueño pasa todas las pruebas de "¿puede leer?"— así que se compara
   * antes que nada.
   */
  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL) {
    console.error(
      "\n  ✗ DATABASE_URL_READONLY es IDÉNTICA a DATABASE_URL.\n" +
        "    No es una credencial de solo lectura: es la del dueño con otro nombre.\n",
    );
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  const problemas: string[] = [];

  try {
    const [quien] = await sql<
      Array<{ usuario: string; base: string; conecta: boolean; usa: boolean; crea: boolean }>
    >`
      SELECT current_user                                        AS usuario,
             current_database()                                  AS base,
             has_database_privilege(current_database(), 'CONNECT') AS conecta,
             has_schema_privilege('public', 'USAGE')             AS usa,
             has_schema_privilege('public', 'CREATE')            AS crea`;

    console.log(`\n  usuario: ${quien!.usuario} · base: ${quien!.base}`);
    console.log(
      `  conecta: ${quien!.conecta} · usa el esquema: ${quien!.usa} · puede CREAR en él: ${quien!.crea}`,
    );
    if (quien!.crea) {
      problemas.push(
        `${quien!.usuario} puede CREATE en el esquema public: podría crear tablas propias`,
      );
    }

    // Tablas. Se pregunta por oid y no por nombre para no armar identificadores.
    const tablas = await sql<
      Array<{ relname: string; lee: boolean; escribe: boolean }>
    >`
      SELECT c.relname,
             has_table_privilege(c.oid, 'SELECT') AS lee,
             (has_table_privilege(c.oid, 'INSERT')
           OR has_table_privilege(c.oid, 'UPDATE')
           OR has_table_privilege(c.oid, 'DELETE')
           OR has_table_privilege(c.oid, 'TRUNCATE')) AS escribe
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
       ORDER BY c.relname`;

    const sinLeer = tablas.filter((t) => !t.lee).map((t) => t.relname);
    const conEscritura = tablas.filter((t) => t.escribe).map((t) => t.relname);

    console.log(`\n  tablas en public: ${tablas.length}`);
    console.log(`  puede leer:       ${tablas.length - sinLeer.length}`);
    console.log(
      `  NO puede leer:    ${sinLeer.length === 0 ? "ninguna" : sinLeer.join(", ")}`,
    );
    console.log(
      `  PODRÍA escribir:  ${conEscritura.length === 0 ? "ninguna" : conEscritura.join(", ")}`,
    );

    if (conEscritura.length > 0) {
      problemas.push(
        `tiene permiso de ${ESCRITURAS.join("/")} sobre ${conEscritura.length} tabla(s): ${conEscritura.join(", ")}`,
      );
    }
    if (sinLeer.length > 0) {
      // No es un riesgo, pero sí un hoyo: una verificación que no puede leer
      // una tabla no puede afirmar nada sobre ella.
      problemas.push(
        `no puede leer ${sinLeer.length} tabla(s): ${sinLeer.join(", ")} — las verificaciones sobre ellas serían ciegas`,
      );
    }

    /*
     * Las secuencias van en dos pasos a propósito: `has_sequence_privilege`
     * revienta si le llega algo que no es secuencia, y meter el filtro y la
     * función en la misma consulta deja el orden de evaluación al planificador.
     */
    const oids = await sql<Array<{ oid: number }>>`
      SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'S'`;
    if (oids.length > 0) {
      const secuencias = await sql<Array<{ relname: string }>>`
        SELECT c.relname FROM pg_class c
         WHERE c.oid = ANY(${oids.map((o) => o.oid)}::oid[])
           AND has_sequence_privilege(c.oid, 'UPDATE')`;
      console.log(
        `  secuencias que podría avanzar: ${secuencias.length === 0 ? "ninguna" : secuencias.map((s) => s.relname).join(", ")}`,
      );
      if (secuencias.length > 0) {
        problemas.push(`puede avanzar ${secuencias.length} secuencia(s)`);
      }
    }

    /*
     * Lo que decide si esto sigue sirviendo el mes que viene: sin privilegios
     * por defecto, la próxima migración crea una tabla que el usuario de solo
     * lectura NO puede leer, y la verificación de la migración siguiente sale
     * ciega justo donde importa.
     */
    const futuros = await sql<Array<{ acl: string }>>`
      SELECT d.defaclacl::text AS acl
        FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace
       WHERE n.nspname = 'public' AND d.defaclobjtype = 'r'`;
    const heredaLectura = futuros.some((f) => f.acl.includes(`${quien!.usuario}=r`));
    console.log(
      `  leerá las tablas FUTURAS sin que nadie haga GRANT: ${heredaLectura ? "sí" : "NO"}`,
    );
    if (!heredaLectura) {
      problemas.push(
        "no hay ALTER DEFAULT PRIVILEGES: la próxima tabla que se cree será invisible para este usuario",
      );
    }

    if (problemas.length === 0) {
      console.log("\n  ✓ es de solo lectura, lee todo, y heredará lo que se cree después\n");
    } else {
      console.error("\n  ✗ no cumple:");
      for (const p of problemas) console.error(`    · ${p}`);
      console.error("");
    }

    await sql.end();
    process.exit(problemas.length === 0 ? 0 : 1);
  } catch (e) {
    await sql.end();
    throw e;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
