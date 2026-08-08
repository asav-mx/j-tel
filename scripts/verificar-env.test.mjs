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

import {
  GRUPOS,
  OPCIONALES,
  REQUERIDAS,
  REQUERIDAS_EN_DESPLIEGUE,
  parsear,
  revisar,
} from "./verificar-env.mjs";

/** Contrato con todos los nombres declarados: así ningún aviso ensucia. */
const CONTRATO = parsear(
  [...REQUERIDAS, ...REQUERIDAS_EN_DESPLIEGUE, ...OPCIONALES, ...GRUPOS.flat()]
    .map((n) => `${n}=`)
    .join("\n"),
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
    // El canal de alertas. Requeridas desde el 8 de agosto de 2026, el día que
    // un aviso de este sistema llegó por primera vez a una bandeja.
    // `RESEND_API_KEY` NO va aquí a propósito: es sensitive en Vercel y no
    // baja: vive en REQUERIDAS_EN_DESPLIEGUE, y su ausencia de este fixture es
    // parte de lo que las pruebas de abajo comprueban.
    'ALERTAS_REMITENTE="J-Telemetry <alertas@j-telemetry.com>"',
    'ALERTAS_DESTINATARIOS="staff@j-telemetry.com"',
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

/*
 * La categoría que nació el 8 de agosto de 2026: requerida en el despliegue y
 * ausente en local a propósito.
 *
 * Existe por `RESEND_API_KEY`, que está marcada sensitive en Vercel y no se
 * puede volver a leer ni con `env pull`. Ponerla en REQUERIDAS habría dejado
 * `env:check` en rojo permanente en toda máquina local — y un check que siempre
 * está rojo enseña a ignorarlo, que es la lección del vigilante del lado del
 * que mira.
 */
test("una requerida de despliegue sin valor local NO es error", () => {
  const local = parsear(envDe());
  for (const n of REQUERIDAS_EN_DESPLIEGUE) {
    assert.ok(!local.get(n), `${n} no debería tener valor en el .env de prueba`);
  }

  const { errores } = revisar({ contrato: CONTRATO, local });

  for (const n of REQUERIDAS_EN_DESPLIEGUE) {
    assert.ok(
      !errores.some((e) => e.includes(n)),
      `${n} no debe salir como error por no tener valor local`,
    );
  }
});

test("pero su ausencia de valor se DICE, no se calla", () => {
  const { avisos } = revisar({ contrato: CONTRATO, local: parsear(envDe()) });

  // Un silencio aquí se lee igual que «está puesta». La diferencia entre «no
  // la verifiqué» y «la verifiqué y está bien» tiene que ser visible.
  for (const n of REQUERIDAS_EN_DESPLIEGUE) {
    const aviso = avisos.find((a) => a.includes(n));
    assert.ok(aviso, `${n} debería producir un aviso`);
    assert.match(aviso, /NO lo comprueba este script/);
  }
});

test("si sale del contrato SÍ es error: el nombre tiene que estar declarado", () => {
  const [primera] = REQUERIDAS_EN_DESPLIEGUE;
  const contratoIncompleto = parsear(
    [...REQUERIDAS, ...OPCIONALES, ...GRUPOS.flat()].map((n) => `${n}=`).join("\n"),
  );

  const { errores } = revisar({ contrato: contratoIncompleto, local: parsear(envDe()) });

  assert.ok(
    errores.some((e) => e.includes(primera) && e.includes(".env.example")),
    "quitarla del contrato tiene que ponerse en rojo",
  );
});

test("las dos del canal que SÍ se bajan siguen siendo requeridas de verdad", () => {
  // El control de la categoría nueva: si todo el canal se hubiera mudado a
  // "requerida en despliegue", quitarles el valor no pondría nada en rojo y
  // nadie notaría que faltan las que sí bajan.
  for (const n of ["ALERTAS_REMITENTE", "ALERTAS_DESTINATARIOS"]) {
    assert.ok(REQUERIDAS.includes(n), `${n} debe estar en REQUERIDAS`);
  }

  const sinCanal = parsear(
    envDe()
      .split("\n")
      .filter((l) => !l.startsWith("ALERTAS_"))
      .join("\n"),
  );
  const { errores } = revisar({ contrato: CONTRATO, local: sinCanal });

  assert.ok(errores.some((e) => e.includes("ALERTAS_REMITENTE")));
  assert.ok(errores.some((e) => e.includes("ALERTAS_DESTINATARIOS")));
});
