/**
 * ¿El `.env` local cumple el contrato de `.env.example`?
 *
 * Las credenciales se pegaban a mano en dos lugares —el `.env` y Vercel— y se
 * separaban en cada rotación. La cura es que `.env.example` sea la lista
 * autorizada de nombres y que los valores vengan de Vercel (`pnpm env:pull`).
 * Este script es lo que hace que el contrato se note cuando se rompe: compara
 * los dos archivos, exige las variables que la app no puede arrancar sin ellas,
 * y revisa las trampas que ya nos costaron tiempo.
 *
 *   pnpm env:check    lo corre
 *   pnpm env:test     comprueba que sabe fallar
 *
 * Sale con código 1 si algo no cuadra, para poder encadenarlo en CI.
 *
 * La lógica se exporta y el arranque va al final, detrás de una guarda, para
 * que las pruebas puedan importar `parsear` y `revisar` sin ejecutar nada.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Las que la app no puede arrancar sin ellas. */
export const REQUERIDAS = [
  "DATABASE_URL_READONLY",
  "CRON_SECRET",
  "JTEL_SECRET_KEY",
  "UMBRELLA_GPS_URL",
  "UMBRELLA_GPS_USERID",
  "UMBRELLA_GPS_PASSWORD",
  /*
   * El canal de alertas. Pasan a requeridas el 8 de agosto de 2026, el día que
   * un aviso de este sistema llegó por primera vez a una bandeja — dos
   * generaciones del vigilante no lo habían logrado. El comentario que estaba
   * aquí decía «cuando la clave viva en Vercel, mover las tres a REQUERIDAS es
   * una línea»; ese momento llegó.
   *
   * Son dos y no tres: `RESEND_API_KEY` está aparte, abajo, y la razón no es de
   * estilo.
   */
  "ALERTAS_REMITENTE",
  "ALERTAS_DESTINATARIOS",
];

/**
 * Requeridas EN EL DESPLIEGUE, y que un `.env` local legítimamente no puede
 * tener.
 *
 * La categoría nace de un caso concreto: `RESEND_API_KEY` está marcada
 * *sensitive* en Vercel, y una variable sensitive **no se puede volver a
 * leer** — ni siquiera con `vercel env pull`. Meterla en `REQUERIDAS` dejaría
 * `pnpm env:check` en rojo para siempre en toda máquina local, y **un check que
 * siempre está rojo enseña a ignorarlo**: es la lección del vigilante otra vez,
 * ahora del lado del que mira.
 *
 * Qué se exige, entonces, y qué no:
 *
 *  · **Sí** que esté declarada en `.env.example`. El contrato es la lista de
 *    nombres autorizados, y una variable que la app necesita tiene que estar
 *    en él aunque su valor no viaje.
 *  · **No** que tenga valor en el `.env` local. No lo puede tener.
 *
 * Y lo que **no** hace este script, dicho para que nadie lo suponga: **no puede
 * comprobar que exista en producción.** Eso lo comprueba quien sí lo ve —
 * `resolverCanal` contesta 503 nombrando la que falta, y Vercel marca la
 * corrida del cron como fallida—. La comprobación vive donde el dato existe, no
 * donde se desea que exista.
 */
export const REQUERIDAS_EN_DESPLIEGUE = ["RESEND_API_KEY"];

/**
 * Con que una del grupo tenga valor basta. `apps/web/src/lib/db.ts` cae por
 * esta lista en orden, así que exigir DATABASE_URL a secas daría un falso
 * negativo en Vercel, donde la integración de Neon inyecta las POSTGRES_*.
 */
export const GRUPOS = [
  ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"],
];

/** Se declaran en el contrato pero pueden ir vacías sin romper nada. */
export const OPCIONALES = [
  "DATABASE_URL_TEST",
  "SEED_DATABASE_URL",
  "JRZ_OLD_MEMORY_DATABASE_URL",
  "UMBRELLA_GPS_BASE_URL",
  "UMBRELLA_USER_ID",
  "UMBRELLA_PASSWORD",
  "SALUD_TOKEN",
  "JTEL_DEV_USER",
  "JTEL_DEV_TOKEN",
  /*
   * Identidad. Opcionales mientras dure el Paso 1 de auth-rbac: la app está
   * construida para arrancar sin ellas —sin llaves no se monta el proveedor y
   * la identidad cae al bypass de desarrollo—, así que exigirlas hoy rompería
   * el env:check de todo el mundo por una integración a medio conectar. Su
   * ausencia no pasa desapercibida: /quien-soy dice "sin llaves" en la cara.
   * Cuando /carrier quede cerrado, mover las dos a REQUERIDAS es una línea.
   */
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
];

/**
 * Nombre y valor de cada línea declarada.
 *
 * Las comillas se quitan a propósito, y no es cosmético: `vercel env pull`
 * escribe `CLAVE="valor"`, que es justo el formato que produce el flujo que
 * este archivo recomienda. Conservándolas, `new URL()` no podía parsear la
 * conexión, la comprobación del password compartido se saltaba en silencio y
 * el árbitro anunciaba verde — un detector que se apaga solo al usarlo como
 * está documentado. Por lo mismo se acepta el prefijo `export`, y un valor de
 * dos comillas vacías queda como cadena vacía, que es lo que de verdad es.
 */
export function parsear(texto) {
  const pares = new Map();
  for (const linea of texto.split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=(.*)$/.exec(linea);
    if (m) {
      const bruto = m[2].trim();
      const sinComillas = /^(["'])([\s\S]*)\1$/.exec(bruto);
      pares.set(m[1], sinComillas ? sinComillas[2] : bruto);
    }
  }
  return pares;
}

function leerNombres(ruta) {
  if (!existsSync(ruta)) return null;
  return parsear(readFileSync(ruta, "utf8"));
}

/** El password de una URL de conexión, o "" si no se puede leer. */
function passwordDe(url) {
  try {
    return decodeURIComponent(new URL(url).password);
  } catch {
    return "";
  }
}

/** Devuelve lo que está mal (`errores`) y lo que conviene saber (`avisos`). */
export function revisar({ contrato, local }) {
  const errores = [];
  const avisos = [];
  const conValor = (n) => Boolean(local.get(n));

  for (const n of REQUERIDAS) {
    if (!conValor(n)) errores.push(`falta ${n} (requerida, y está vacía o ausente en .env)`);
  }

  /*
   * De las de despliegue se exige que estén EN EL CONTRATO, no que tengan valor
   * local: no lo pueden tener. Y su ausencia de valor se dice como aviso en vez
   * de callarse — un silencio aquí se lee igual que «está puesta».
   */
  for (const n of REQUERIDAS_EN_DESPLIEGUE) {
    if (!contrato.has(n)) {
      errores.push(
        `falta ${n} en .env.example (requerida en el despliegue: el contrato tiene que nombrarla aunque su valor no baje)`,
      );
    } else if (!conValor(n)) {
      avisos.push(
        `${n} no tiene valor local, y así es correcto: es sensitive en Vercel y no se puede bajar. ` +
          `Que esté puesta en el despliegue NO lo comprueba este script — lo comprueba el 503 de las rutas que la usan`,
      );
    }
  }

  for (const grupo of GRUPOS) {
    if (!grupo.some(conValor)) {
      errores.push(`falta la conexión a la base: ninguna de ${grupo.join(" / ")} tiene valor`);
    }
  }

  /*
   * La trampa que nos mordió: DATABASE_URL_READONLY apuntando al dueño, o —más
   * sutil— con distinto usuario pero el MISMO password. Lo segundo pasa todas
   * las pruebas de permisos y aun así regala la credencial del dueño, porque
   * basta cambiar el usuario en la URL para escribir.
   */
  const duenio = local.get("DATABASE_URL");
  const lectura = local.get("DATABASE_URL_READONLY");
  if (duenio && lectura) {
    if (duenio === lectura) {
      errores.push(
        "DATABASE_URL_READONLY es idéntica a DATABASE_URL: es la del dueño con otro nombre",
      );
    } else {
      const pd = passwordDe(duenio);
      const pl = passwordDe(lectura);
      if (pd && pl && pd === pl) {
        errores.push(
          "DATABASE_URL_READONLY comparte el password de DATABASE_URL: quien tenga la " +
            "de solo lectura puede escribir cambiando el usuario. Rota jtel_readonly.",
        );
      }
    }
  }

  // Contrato contra realidad, en los dos sentidos.
  const declaradas = new Set([
    ...REQUERIDAS,
    ...REQUERIDAS_EN_DESPLIEGUE,
    ...OPCIONALES,
    ...GRUPOS.flat(),
  ]);
  for (const n of contrato.keys()) {
    if (!declaradas.has(n)) {
      avisos.push(`${n} está en .env.example pero este script no la clasifica`);
    }
  }
  for (const n of local.keys()) {
    if (!contrato.has(n)) {
      avisos.push(`${n} está en tu .env pero no en .env.example — agrégala al contrato`);
    }
  }

  return { errores, avisos };
}

function main() {
  const contrato = leerNombres(join(RAIZ, ".env.example"));
  const local = leerNombres(join(RAIZ, ".env"));

  if (!contrato) {
    console.error("No existe .env.example: sin contrato no hay nada que verificar.");
    process.exit(1);
  }
  if (!local) {
    console.error(
      "\n  ✗ No existe .env.\n" +
        "    Los valores viven en Vercel. Tráelos con:  pnpm env:pull\n",
    );
    process.exit(1);
  }

  const { errores, avisos } = revisar({ contrato, local });

  if (avisos.length > 0) {
    console.warn("\n  avisos:");
    for (const a of avisos) console.warn(`    · ${a}`);
  }

  if (errores.length > 0) {
    console.error("\n  ✗ el .env no cumple el contrato:");
    for (const e of errores) console.error(`    · ${e}`);
    console.error("\n    Los valores vienen de Vercel:  pnpm env:pull\n");
    process.exit(1);
  }

  console.log(
    `\n  ✓ .env cumple el contrato — ${REQUERIDAS.length + GRUPOS.length} requeridas presentes` +
      `, ${REQUERIDAS_EN_DESPLIEGUE.length} requerida(s) solo en el despliegue (no verificable desde aquí)` +
      `${avisos.length > 0 ? `, con ${avisos.length} aviso(s)` : ""}\n`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
