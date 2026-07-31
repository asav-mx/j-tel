/**
 * Que el árbitro sepa fallar.
 *
 * El agujero que motivó estas pruebas: `vercel env pull` —el comando que este
 * mismo procedimiento recomienda— escribe `CLAVE="valor"`, y con las comillas
 * puestas `new URL()` no podía parsear la conexión. La comprobación del
 * password compartido se saltaba en silencio y el árbitro anunciaba verde
 * justo en el flujo para el que fue escrito. Un detector que se apaga solo al
 * usarlo como está documentado no sirve de nada, así que el caso con comillas
 * queda clavado aquí.
 *
 *   pnpm env:test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { GRUPOS, OPCIONALES, REQUERIDAS, parsear, revisar } from "./verificar-env.mjs";

/** Contrato con todos los nombres declarados: así ningún aviso ensucia. */
const CONTRATO = parsear(
  [...REQUERIDAS, ...OPCIONALES, ...GRUPOS.flat()].map((n) => `${n}=`).join("\n"),
);

const HOST = "ep-fancy.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

/** Un `.env` sano, en el formato que escribe `vercel env pull`. */
function envDe({ passwordLectura = "pass_lectura", extra = "" } = {}) {
  return [
    `DATABASE_URL="postgresql://neondb_owner:pass_dueno@${HOST}"`,
    `DATABASE_URL_READONLY="postgresql://jtel_readonly:${passwordLectura}@${HOST}"`,
    'CRON_SECRET="jtel-cron-2026"',
    'JTEL_SECRET_KEY="80b6ef40d16d1675"',
    'UMBRELLA_GPS_URL="http://gps2.umbrellasoluciones.com/openapi"',
    'UMBRELLA_GPS_USERID="A1339"',
    'UMBRELLA_GPS_PASSWORD="admin1"',
    extra,
  ].join("\n");
}

const revisarTexto = (texto) => revisar({ contrato: CONTRATO, local: parsear(texto) });
const hay = (errores, fragmento) => errores.some((e) => e.includes(fragmento));

test("con comillas —el formato de env pull— detecta el password compartido", () => {
  const { errores } = revisarTexto(envDe({ passwordLectura: "pass_dueno" }));
  assert.ok(
    hay(errores, "comparte el password"),
    `debía detectarlo y no lo hizo. errores: ${JSON.stringify(errores)}`,
  );
});

test("con comillas y passwords distintos, pasa en verde", () => {
  const { errores } = revisarTexto(envDe());
  assert.deepEqual(errores, []);
});

test("sin comillas sigue detectando el password compartido", () => {
  const sinComillas = envDe({ passwordLectura: "pass_dueno" }).replaceAll('"', "");
  assert.ok(hay(revisarTexto(sinComillas).errores, "comparte el password"));
});

test("con comillas simples también", () => {
  const simples = envDe({ passwordLectura: "pass_dueno" }).replaceAll('"', "'");
  assert.ok(hay(revisarTexto(simples).errores, "comparte el password"));
});

test("la URL de solo lectura idéntica a la del dueño se detecta aparte", () => {
  const texto = envDe().replace(
    /^DATABASE_URL_READONLY=.*$/m,
    `DATABASE_URL_READONLY="postgresql://neondb_owner:pass_dueno@${HOST}"`,
  );
  assert.ok(hay(revisarTexto(texto).errores, "es idéntica a DATABASE_URL"));
});

test('dos comillas vacías son un valor vacío, no un valor presente', () => {
  const texto = envDe().replace(/^CRON_SECRET=.*$/m, 'CRON_SECRET=""');
  assert.ok(hay(revisarTexto(texto).errores, "falta CRON_SECRET"));
});

test("la conexión a la base la puede satisfacer cualquiera del grupo", () => {
  const soloPostgres = envDe()
    .replace(/^DATABASE_URL=.*$/m, `POSTGRES_URL="postgresql://neondb_owner:pass_dueno@${HOST}"`);
  assert.deepEqual(revisarTexto(soloPostgres).errores, []);

  const ninguna = envDe().replace(/^DATABASE_URL=.*$/m, "");
  assert.ok(hay(revisarTexto(ninguna).errores, "falta la conexión a la base"));
});

test("una variable fuera del contrato sale como aviso, no como error", () => {
  const { errores, avisos } = revisarTexto(envDe({ extra: 'VARIABLE_INVENTADA="x"' }));
  assert.deepEqual(errores, []);
  assert.ok(avisos.some((a) => a.includes("VARIABLE_INVENTADA")));
});

test("parsear quita las comillas envolventes y acepta el prefijo export", () => {
  const p = parsear(
    [
      'CON_DOBLES="valor"',
      "CON_SIMPLES='valor'",
      "SIN_COMILLAS=valor",
      'export EXPORTADA="valor"',
      "  CON_ESPACIOS  =  valor  ",
      'VACIA=""',
      "SIN_VALOR=",
    ].join("\n"),
  );
  assert.equal(p.get("CON_DOBLES"), "valor");
  assert.equal(p.get("CON_SIMPLES"), "valor");
  assert.equal(p.get("SIN_COMILLAS"), "valor");
  assert.equal(p.get("EXPORTADA"), "valor");
  assert.equal(p.get("CON_ESPACIOS"), "valor");
  assert.equal(p.get("VACIA"), "");
  assert.equal(p.get("SIN_VALOR"), "");
});

test("parsear no toca las comillas de en medio ni los signos del password", () => {
  const p = parsear('CLAVE="npg_a@b/c#d"\nOTRA=npg_x"y');
  assert.equal(p.get("CLAVE"), "npg_a@b/c#d");
  assert.equal(p.get("OTRA"), 'npg_x"y');
});
