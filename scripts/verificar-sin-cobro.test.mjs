/**
 * Que la valla anti-cobro vea lo que tiene que ver, y nada más.
 *
 * El bloque que más importa es el tercero: la ficha de pagos y los comentarios
 * del código **nombran** Stripe, Conekta y Mercado Pago para explicar por qué no
 * se usan. Una valla que se cayera con esos comentarios se desactivaría en el
 * primer PR que la tropezara, y entonces no protegería nada.
 *
 *   pnpm cobro:test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  lineasQueImportanUnCobro,
  pasarelasEnLasDependencias,
  PASARELAS,
} from "./verificar-sin-cobro.mjs";

test("ve cada forma de importar una pasarela", () => {
  const formas = [
    'import Stripe from "stripe";',
    "import { loadStripe } from '@stripe/stripe-js'",
    'import {\n  MercadoPagoConfig,\n} from "mercadopago";',
    'import "conekta";',
    'const s = await import("stripe");',
    'const Stripe = require("stripe");',
    'export { loadStripe } from "@stripe/stripe-js";',
    'import x from "stripe/lib/resources";',
    'import { Client } from "@adyen/api-library";',
  ];
  for (const f of formas) {
    assert.ok(lineasQueImportanUnCobro(f).length > 0, f);
  }
});

test("dice en qué línea", () => {
  const texto = 'import { z } from "zod";\nimport Stripe from "stripe";\n';
  assert.deepEqual(lineasQueImportanUnCobro(texto), [2]);
});

test("no se cae con los comentarios que explican por qué no se cobra", () => {
  const textos = [
    '/*\n * Nada de esto cobra: no se conecta Stripe ni Conekta ni mercadopago.\n */',
    '// nunca: import Stripe from "stripe";',
    '/** La ficha prohíbe require("conekta") hasta que responda el abogado */',
  ];
  for (const t of textos) {
    assert.deepEqual(lineasQueImportanUnCobro(t), [], t);
  }
});

test("una URL en el mismo renglón no se come la importación que sigue", () => {
  const t = 'const u = "https://x"; import Stripe from "stripe";';
  assert.deepEqual(lineasQueImportanUnCobro(t), [1]);
});

test("deja pasar lo que sólo se parece en el nombre", () => {
  const inocentes = [
    'import { Square } from "./formas.js";',
    'import x from "@jtel/domain/boleto";',
    'import { sha256 } from "@noble/hashes/sha2.js";',
    'import clip from "./clip-de-video.js";',
  ];
  for (const t of inocentes) {
    assert.deepEqual(lineasQueImportanUnCobro(t), [], t);
  }
});

test("ve una pasarela en cualquiera de los cuatro tipos de dependencia", () => {
  assert.deepEqual(pasarelasEnLasDependencias({ dependencies: { stripe: "^1" } }), ["stripe"]);
  assert.deepEqual(pasarelasEnLasDependencias({ devDependencies: { conekta: "^1" } }), ["conekta"]);
  assert.deepEqual(pasarelasEnLasDependencias({ peerDependencies: { openpay: "^1" } }), ["openpay"]);
  assert.deepEqual(pasarelasEnLasDependencias({ optionalDependencies: { culqi: "^1" } }), ["culqi"]);
});

test("un package.json sin pasarelas no levanta nada", () => {
  const paquete = { dependencies: { zod: "^3", "@noble/curves": "^2" }, devDependencies: {} };
  assert.deepEqual(pasarelasEnLasDependencias(paquete), []);
});

test("la lista no trae duplicados ni cadenas vacías", () => {
  assert.equal(new Set(PASARELAS).size, PASARELAS.length);
  assert.ok(PASARELAS.every((p) => typeof p === "string" && p.length > 0));
});
