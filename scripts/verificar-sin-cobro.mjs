/**
 * ¿Alguien conectó un cobro de verdad?
 *
 *   pnpm cobro:check
 *
 * Sale con código 1 si cualquier `package.json` de `apps/` o `packages/` depende
 * de un procesador de pagos, o si cualquier archivo de código lo importa.
 *
 * ## Por qué
 *
 * Ontoy 3.0 se construye **para probar la mecánica, no para cobrar**
 * (`docs/Ficha-Construccion-Ontoy-3-Pagos.md`, §1). La raya la fijó Asav y es
 * innegociable: boletos, saldos y cobros son de mentira, y **no se toca dinero
 * real de una persona real** hasta que responda el abogado.
 *
 * Una regla que sólo vive en un documento se rompe sin que nadie lo note. Ésta
 * corre en CI: **el código no debe poder cobrar aunque alguien se equivoque.**
 *
 * Al escribirla (23-sep-2026) el repo no tenía ninguna de estas dependencias,
 * así que la valla nace en verde. Su trabajo no es limpiar nada: es que el
 * primero que entre se lea con su nombre, en el PR que lo metió, y no seis
 * meses después.
 *
 * ## Qué NO es
 *
 * No es una valla de seguridad: quien quiera cobrar puede llamar a una API por
 * `fetch` sin nombrarla. Es una valla contra **el descuido** —instalar el SDK y
 * seguirle— que es la forma realista en que esto se rompería.
 *
 * Mira las dependencias y las importaciones, **no el texto**: la ficha nombra
 * Stripe, Conekta y Mercado Pago en prosa, y los comentarios que expliquen por
 * qué no se usan tienen que poder nombrarlos. Un comentario nunca cobró nada.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXTENSIONES = /\.(tsx?|jsx?|mjs|cjs)$/;

/**
 * Los paquetes que mueven dinero de verdad. La lista no pretende ser completa
 * —ninguna lo sería—: cubre lo que alguien instalaría sin pensarlo mucho.
 */
export const PASARELAS = [
  "stripe",
  "@stripe/stripe-js",
  "@stripe/react-stripe-js",
  "conekta",
  "mercadopago",
  "openpay",
  "@paypal/checkout-server-sdk",
  "@paypal/react-paypal-js",
  "paypal-rest-sdk",
  "braintree",
  "square",
  "@square/web-sdk",
  "adyen",
  "@adyen/api-library",
  "razorpay",
  "culqi",
  "dlocal",
  "ebanx",
  "payu",
  "clip-sdk",
];

/** `@scope/nombre` y `nombre`, más cualquier subruta: `stripe/lib/x`. */
function patronDeImportacion(paquetes) {
  const alternativas = paquetes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(
    `(?:\\bfrom\\s*|\\bimport\\s*\\(?\\s*|\\brequire\\s*\\(\\s*)["'](?:${alternativas})(?:\\/[^"']*)?["']`,
  );
}

const IMPORTACION = patronDeImportacion(PASARELAS);

/** Quita comentarios de bloque y de línea, conservando los saltos de línea. */
function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Los números de línea (desde 1) donde el texto importa una pasarela. */
export function lineasQueImportanUnCobro(texto) {
  return sinComentarios(texto)
    .split("\n")
    .flatMap((linea, i) => (IMPORTACION.test(linea) ? [i + 1] : []));
}

/** Las pasarelas declaradas como dependencia en un `package.json` ya leído. */
export function pasarelasEnLasDependencias(paquete) {
  const declaradas = {
    ...(paquete.dependencies ?? {}),
    ...(paquete.devDependencies ?? {}),
    ...(paquete.peerDependencies ?? {}),
    ...(paquete.optionalDependencies ?? {}),
  };
  return PASARELAS.filter((p) => Object.hasOwn(declaradas, p));
}

/** Archivos de `apps/` y `packages/`, versionados o nuevos sin ignorar. */
function archivosVersionados() {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "apps", "packages"],
    { encoding: "utf8" },
  ).split("\n");
}

function main() {
  const hallazgos = [];

  for (const archivo of archivosVersionados()) {
    let texto;
    try {
      texto = readFileSync(archivo, "utf8");
    } catch {
      continue; // borrado en el árbol de trabajo y aún versionado
    }

    if (archivo.endsWith("package.json")) {
      let paquete;
      try {
        paquete = JSON.parse(texto);
      } catch {
        continue; // no es asunto de esta valla
      }
      for (const p of pasarelasEnLasDependencias(paquete)) {
        hallazgos.push(`${archivo} → depende de ${p}`);
      }
      continue;
    }

    if (!EXTENSIONES.test(archivo)) continue;
    for (const linea of lineasQueImportanUnCobro(texto)) {
      hallazgos.push(`${archivo}:${linea} → importa una pasarela`);
    }
  }

  if (hallazgos.length === 0) {
    console.log("Nada en el repo puede cobrar dinero real.");
    return;
  }

  console.error(
    `✗ ${hallazgos.length} conexión(es) a un cobro real:\n\n` +
      hallazgos.map((h) => `  ${h}`).join("\n") +
      `\n\nOntoy 3.0 se construye para probar la mecánica, NO para cobrar: boletos,\n` +
      `saldos y cobros son de mentira, y no se toca dinero real de una persona\n` +
      `real hasta que responda el abogado. Es decisión de Asav y no se rodea\n` +
      `desde un PR — ver docs/Ficha-Construccion-Ontoy-3-Pagos.md, §1.\n\n` +
      `Si de verdad llegó el momento de cobrar, esa conversación va antes que\n` +
      `este código, y esta valla se quita a propósito y por separado.`,
  );
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
