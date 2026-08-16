/**
 * La muestra de salud de la plataforma: se arma UNA vez, aquí, y la leen los
 * dos que preguntan por ella —`/api/salud` y el canal de alertas—.
 *
 * ── Por qué existe este archivo ─────────────────────────────────────────────
 *
 * Hasta hoy había dos armados paralelos de la misma muestra: el de la ruta y
 * el de `lib/alertas/datos.ts`. El comentario del segundo decía «armada igual
 * que en `/api/salud`» y no lo estaba: cuando se agregó el chequeo de
 * verificación —los servicios vencidos SIN ningún hecho— solo se actualizó el
 * de la ruta.
 *
 * Lo que costó: el resumen diario del 15 de agosto llegó a la bandeja
 * reportando «no se pudo contar los servicios vencidos sin veredicto». No
 * había error de base, ni timeout, ni excepción tragada. **Faltaba la
 * consulta.** El correo se declaró enfermo por no poder medirse, no por estar
 * mal, y eso arrastró el título entero a la rama de incidentes.
 *
 * Dos armados de la misma muestra son dos oportunidades de olvidar el chequeo
 * siguiente, y quien lo olvide no va a ser quien lo escribió. Es la misma
 * lección que ya obligó a mudar el filtro de cuentas demo a un solo lugar
 * (`deCuentaReal`, en `packages/db`), ahora sobre la muestra completa.
 *
 * ── Dónde va el corte ───────────────────────────────────────────────────────
 *
 * Aquí vive lo común: reunir los datos y evaluarlos. NO vive aquí la envoltura
 * HTTP de la ruta —sonda de esquema, forma de la respuesta, códigos 200/503,
 * detalle del error según autenticación—: eso es contrato con el vigilante
 * externo y se queda en la ruta. El juicio tampoco vive aquí; es una función
 * pura de `@jtel/services` y se prueba sin base de datos.
 */

import type { Repositories } from "@jtel/db";
import { evaluarSalud, UMBRALES_SALUD, HORAS_FALLO_MUDO } from "@jtel/services";

/**
 * Lee la muestra y la evalúa.
 *
 * Las cuentas demo no se vigilan —archivarlas fue sacarlas de la vista, y una
 * demo sin telemetría no es una falla de plataforma—, pero ese filtro NO se
 * aplica aquí a mano: vive en `deCuentaReal`, dentro de `packages/db`, y lo
 * heredan las tres consultas de abajo. Filtrarlo en el llamador era
 * exactamente lo que dejaba que un chequeo nuevo se olvidara de hacerlo.
 *
 * Devuelve, además del veredicto, las marcas y las alertas abiertas tal como
 * se leyeron: quien llama ya las reusaba, y volver a pedirlas sería otra
 * consulta que puede divergir.
 *
 * `fallosMudos` también sale por aquí, y por la misma razón. Ya estaba medido
 * —se calcula tres líneas arriba— pero solo salía convertido en la prosa de
 * `lectura` del chequeo. Un número que solo existe dentro de una frase no lo
 * puede comparar nadie: para que el título del resumen dejara de contradecir
 * al desglose, la única alternativa habría sido leer el conteo de vuelta de su
 * propio texto. Se devuelve como número y el problema no existe.
 */
export async function leerMuestraDeSalud(repos: Repositories, ahora: Date) {
  const carriers = await repos.accounts.listByType("carrier", { includeDemo: false });

  const [marcasTodas, abiertas, fallosMudos] = await Promise.all([
    repos.telemetry.listWatermarks(),
    repos.ingestAlerts.listUnresolved(100),
    // El chequeo que faltaba en el camino del correo: si el árbitro llegó a
    // dictar. Todo lo demás que se vigila aquí es INGESTA, y por eso la muestra
    // pudo decir "sano" durante 35 días con ocho servicios de un cliente vivo
    // sin veredicto.
    repos.occurrences.contarFallosMudos(HORAS_FALLO_MUDO),
  ]);

  const marcas = marcasTodas.map((m) => ({
    lastRecordedAt: m.lastRecordedAt,
    updatedAt: m.updatedAt,
  }));

  const criticas = abiertas.filter((a) => a.severity === "critical");

  const resultado = evaluarSalud(
    {
      ahora,
      marcas,
      carriersEsperados: carriers.length,
      alertasCriticasAbiertas: criticas.length,
      alertaCriticaMasAntigua: criticas.length
        ? criticas.reduce((v, a) => (a.createdAt < v ? a.createdAt : v), criticas[0]!.createdAt)
        : null,
      verificacion: {
        fallosMudos: fallosMudos.total,
        masAntiguoHoras: fallosMudos.masAntiguoHoras,
      },
    },
    UMBRALES_SALUD,
  );

  return { resultado, marcas, abiertas, fallosMudos };
}
