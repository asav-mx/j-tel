/**
 * ¿En qué difieren dos contratos, y qué corre con el valor de fábrica?
 *
 * SOLO LECTURA. Es el sensor de **divergencias de política** del frente «ver el
 * instrumento, no solo el veredicto», en su mitad de medición — el tablero
 * espera al rediseño, igual que el de cadencia.
 *
 * ---
 *
 * **Por qué existe, y es C16.** El árbitro aplica la política del contrato. Si
 * esa política no dice lo que las partes pactaron, **el veredicto se emite con
 * una regla que nadie acordó** — y como `contract_policy_history` estuvo vacía
 * hasta la migración 0020, **no hay forma de leer del sistema qué se pactó**.
 * Lo único que se puede hacer hoy es poner enfrente qué está corriendo, campo
 * por campo, para que la conversación con la Planta sea concreta.
 *
 * **Y la distinción que este guion existe para hacer visible, porque es la que
 * se pierde al mirar un JSON:** un campo puede diferir de tres maneras y las
 * tres se ven igual en pantalla.
 *
 *   · **difiere** — los dos contratos lo declaran, con valores distintos.
 *     Alguien decidió dos veces, y quizá bien.
 *   · **solo en uno** — un contrato lo declara y el otro no. El que no lo
 *     declara **corre con el valor de fábrica sin que nadie lo eligiera**, y
 *     eso no es un acuerdo: es una omisión que se comporta como acuerdo.
 *   · **igual** — los dos lo declaran con el mismo valor.
 *
 * Un campo ausente **no es un campo en blanco**: es el `default` del esquema
 * aplicándose en silencio. Por eso se imprime el valor efectivo al lado del
 * declarado — quien lee tiene que poder distinguir «se pactó 120» de «nadie
 * dijo nada y quedó 120».
 *
 * **Lo que este guion NO hace:** no dice qué se pactó. Eso no está en la base
 * —ésa es C16 entera— y sale de una conversación con la Planta.
 *
 *   pnpm --filter @jtel/db comparar-politicas
 *
 * Va por `DATABASE_URL_READONLY`. Ver `verificar-solo-lectura.ts`.
 */
import { existsSync } from "node:fs";
import postgres from "postgres";
import { contractPolicySchema } from "@jtel/domain";

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

/**
 * Los campos que deciden un veredicto, marcados aparte.
 *
 * No es decoración: un `timeZone` distinto y un `kmlMatchMinPct` distinto se
 * leen igual en una tabla de diferencias, y **solo uno de los dos cambia quién
 * queda acusado**. Mezclarlos es la §D del Marco aplicada a una lista.
 */
const DECIDEN_VEREDICTO = new Set([
  "routeStrictness",
  "kmlMatchMinPct",
  "kmlCorridorMinPct",
  "kmlCorridorMeters",
  "kmlOriginToleranceFraction",
  "toleranceMinutes",
  "arrivalAnticipationMinutes",
  "verificationGraceMinutes",
  "evidenceMinCoveragePct",
  "evidenceMaxGapMinutes",
  "excusableReasons",
  "permitirConsolidacion",
  "timeZone",
]);

export type Clase = "difiere" | "solo en uno" | "igual";

export type Comparacion = {
  campo: string;
  clase: Clase;
  decide: boolean;
  /** Lo que el contrato declara. `undefined` = no lo declara. */
  declarado: Array<unknown>;
  /** Lo que el motor termina aplicando (declarado, o el default del esquema). */
  efectivo: Array<unknown>;
};

export function representar(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  // `[object Object]` sería un valor correcto convertido en una afirmación
  // vacía: la regla que dice que un contrato tiene reglas de enforcement y la
  // que dice cuáles se verían idénticas.
  if (Array.isArray(v)) {
    return v.length === 0 ? "[] (vacío)" : `[${v.map((x) => representar(x)).join(", ")}]`;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Compara dos políticas campo por campo sobre el esquema, no sobre las llaves
 * que traigan los JSON.
 *
 * La diferencia importa: recorrer las llaves presentes **no puede ver un campo
 * que ninguno de los dos declara**, y ése es justo el caso que interesa —el
 * valor de fábrica corriendo sin que nadie lo eligiera—. El esquema es la lista
 * completa; los JSON son lo que alguien alcanzó a escribir.
 */
export function compararPoliticas(
  politicas: Array<Record<string, unknown>>,
  campos: string[],
): Comparacion[] {
  const salida: Comparacion[] = [];
  for (const campo of campos) {
    const declarado = politicas.map((p) =>
      Object.prototype.hasOwnProperty.call(p, campo) ? p[campo] : undefined,
    );
    /*
     * El valor de fábrica se saca del esquema DE ESE CAMPO, no de parsear la
     * política entera.
     *
     * La primera versión parseaba entera y, si fallaba —basta que falte un
     * campo requerido—, caía al valor declarado. Con eso, la columna «fábrica»
     * habría dicho «—» justo donde tenía que decir qué se está aplicando: **el
     * caso que este guion existe para enseñar habría salido en blanco**, y con
     * las dos políticas completas de hoy nadie lo habría notado. Lo atrapó la
     * prueba, no la corrida.
     */
    const forma = (contractPolicySchema.shape as Record<string, { safeParse(v: unknown): { success: boolean; data?: unknown } }>)[campo];
    const deFabrica = forma?.safeParse(undefined);
    const fabrica = deFabrica?.success ? deFabrica.data : undefined;
    const efectivo = declarado.map((d) => (d === undefined ? fabrica : d));

    const presentes = declarado.filter((d) => d !== undefined).length;
    const efectivoIgual =
      new Set(efectivo.map((e) => JSON.stringify(e ?? null))).size === 1;

    let clase: Clase;
    if (presentes > 0 && presentes < politicas.length) clase = "solo en uno";
    else if (!efectivoIgual) clase = "difiere";
    else clase = "igual";

    salida.push({
      campo,
      clase,
      decide: DECIDEN_VEREDICTO.has(campo),
      declarado,
      efectivo,
    });
  }
  return salida;
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL_READONLY. Sin ella esta lectura correría con el usuario dueño.",
    );
  }

  const sql = postgres(url, { max: 1 });

  try {
    const contratos = await sql<Array<{ nombre: string; policy: Record<string, unknown> }>>`
      SELECT sc.name AS nombre, sc.policy AS policy
        FROM service_contracts sc
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cli.is_demo = false AND car.is_demo = false
       ORDER BY sc.name`;

    if (contratos.length < 2) {
      console.log(
        `\n  Hacen falta al menos dos contratos reales para comparar; hay ${contratos.length}.\n`,
      );
      await sql.end();
      return;
    }

    const campos = Object.keys(contractPolicySchema.shape).sort();
    const comp = compararPoliticas(
      contratos.map((c) => c.policy),
      campos,
    );

    const anchoNombre = Math.max(...contratos.map((c) => c.nombre.length), 18);
    console.log(`\n  Divergencias de política — C16`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo`);
    console.log(`  ${campos.length} campos del esquema · ${contratos.length} contratos reales\n`);
    for (const [i, c] of contratos.entries()) console.log(`    (${i + 1}) ${c.nombre}`);

    const orden: Clase[] = ["difiere", "solo en uno", "igual"];
    for (const clase of orden) {
      const delGrupo = comp.filter((c) => c.clase === clase);
      if (delGrupo.length === 0) continue;
      console.log(`\n  ── ${clase.toUpperCase()} · ${delGrupo.length} campos ${"─".repeat(30)}`);
      console.log(
        `  ${"".padEnd(2)}${"campo".padEnd(32)}` +
          contratos.map((_, i) => `(${i + 1}) declarado / efectivo`.padEnd(anchoNombre)).join(""),
      );
      for (const c of delGrupo) {
        const marca = c.decide ? "⚖" : " ";
        const celdas = c.declarado.map((d, i) =>
          d === undefined ? `— (fábrica: ${representar(c.efectivo[i])})` : representar(d),
        );
        // Un valor largo —una lista de motivos excusables— no se recorta: se
        // baja de renglón. Recortarlo escondería justo la diferencia que esta
        // tabla existe para enseñar.
        const cabe = celdas.every((t) => t.length <= anchoNombre - 2);
        if (cabe) {
          console.log(
            `  ${marca} ${c.campo.padEnd(31)}${celdas.map((t) => t.padEnd(anchoNombre)).join("")}`,
          );
        } else {
          console.log(`  ${marca} ${c.campo}`);
          for (const [i, t] of celdas.entries()) console.log(`      (${i + 1}) ${t}`);
        }
      }
    }

    const decidenYDifieren = comp.filter(
      (c) => c.decide && c.clase !== "igual",
    );
    const soloEnUno = comp.filter((c) => c.clase === "solo en uno");
    console.log(
      `\n  ⚖ = el campo decide un veredicto. ${decidenYDifieren.length} de los ` +
        `${comp.filter((c) => c.clase !== "igual").length} campos que no coinciden lo hacen.`,
    );
    console.log(
      `  «— (fábrica: X)» = el contrato NO declara el campo y el motor aplica X\n` +
        `  sin que nadie lo haya elegido. Son ${soloEnUno.length}.\n`,
    );

    await sql.end();
  } catch (e) {
    await sql.end();
    throw e;
  }
}

// Sólo corre como guion; importado desde una prueba, no se conecta a nada.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
