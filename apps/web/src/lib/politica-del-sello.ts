import { contractPolicySchema, type ContractPolicy } from "@jtel/domain";

/**
 * Qué política gobierna la LECTURA de un servicio — C24.
 *
 * Vive aparte de `service-detail-data.ts` a propósito, y por la misma razón que
 * `identidad-dev.ts` vive aparte de `auth.ts`: es una decisión pura, es la que
 * si se equivoca hace que una pantalla mienta sobre un hecho sellado, y así
 * puede probarse sola. La que toca la base queda del otro lado.
 *
 * ## La regla
 *
 * **Un hecho sellado se explica con la política con la que se juzgó, no con la
 * de hoy.** El hecho la congela byte a byte en `contractPolicySnapshot`
 * justamente para eso: para que el auditado pueda reconstruir con qué regla se
 * le midió. Leer la política viva hace que el número y su lectura dejen de
 * corresponderse — la medición es de entonces y el umbral de ahora.
 *
 * Sin hecho no hay sello, y entonces la política viva **sí** es la correcta: es
 * la que se le va a aplicar cuando se juzgue.
 *
 * ## Por qué existe este archivo y no fue solo cambiar una línea
 *
 * La regla ya estaba escrita en `no-cumplido-motivo.ts` y la cumplían tres
 * pantallas —cierre, diagnóstico, tabla de ocurrencias—; **la incumplía justo
 * el expediente**, que es la pantalla cuyo trabajo entero es explicar un hecho.
 * 🟢 Medido el 12 de agosto de 2026: **197 de 1 194 hechos sellados (16.5 %)**
 * mostraban un margen posterior que no era el suyo —124 congelados en 30 contra
 * 45 vivos, 73 en 0 contra 45—.
 *
 * Una regla que vive en la cabeza de quien la recuerda se vuelve a romper
 * (regla 14). Aquí queda con prueba propia: si alguien devuelve la política
 * viva para un hecho sellado, la suite se pone roja.
 */

export type LecturaDePolitica = {
  /** La que hay que usar para leer este servicio. */
  politica: ContractPolicy;
  /**
   * De dónde salió. Se declara en vez de adivinarse después, igual que
   * `ObservationWindowBasis` en el dominio.
   *
   *   sello    — del hecho, congelada. Es lo normal en un servicio ya juzgado.
   *   contrato — la viva. Correcta solo cuando todavía no hay hecho.
   */
  origen: "sello" | "contrato";
  /**
   * El contrato cambió desde que este hecho se selló.
   *
   * `false` cuando se lee del contrato —no hay dos cosas que comparar— y
   * cuando el sello y el contrato coinciden.
   */
  contratoCambioDesdeElSello: boolean;
};

/**
 * Las llaves cuyo cambio mueve algo que el expediente enseña. No se comparan
 * los dos objetos enteros: dos `jsonb` pueden diferir en una llave que ninguna
 * pantalla lee, y eso no es una divergencia — es ruido con cara de hallazgo.
 */
const LLAVES_QUE_SE_LEEN = [
  "toleranceMinutes",
  "evidenceMarginMinutesBefore",
  "verificationGraceMinutes",
  "evidenceMarginMinutesAfter",
  "timeZone",
  "enforcementRules",
] as const satisfies ReadonlyArray<keyof ContractPolicy>;

/**
 * `contractPolicySnapshot` es `jsonb`: llega sin garantía de forma.
 *
 * Se pasa por el esquema para que las llaves que se agregaron DESPUÉS de este
 * sello tomen su valor de fábrica — que es exactamente lo que el motor hizo al
 * leerlas ese día (`policy.verificationGraceMinutes ?? 15` y sus hermanas), así
 * que aplicar el default reproduce la lectura de entonces y no la inventa.
 *
 * Si no parsea se usa tal cual y NO se cae a la política viva: un snapshot
 * corrupto sigue siendo la mejor evidencia de con qué se juzgó, y caer a la
 * viva sería reintroducir en silencio el defecto que este archivo existe para
 * cerrar.
 */
function normalizar(crudo: unknown): ContractPolicy {
  const parsed = contractPolicySchema.safeParse(crudo);
  return parsed.success ? (parsed.data as ContractPolicy) : (crudo as ContractPolicy);
}

export function politicaDelSello(
  hecho: { contractPolicySnapshot?: unknown } | null | undefined,
  politicaDelContrato: ContractPolicy,
): LecturaDePolitica {
  const snapshot = hecho?.contractPolicySnapshot;

  // Sin hecho —o con un hecho sin snapshot, que solo puede ser dato viejo— la
  // única política que existe es la viva, y ahí sí es la correcta.
  if (snapshot === null || snapshot === undefined) {
    return {
      politica: politicaDelContrato,
      origen: "contrato",
      contratoCambioDesdeElSello: false,
    };
  }

  const politica = normalizar(snapshot);
  /*
   * Los DOS lados normalizados, y no solo el sello.
   *
   * Comparar el snapshot pasado por el esquema contra la política viva en crudo
   * es la misma trampa que el sensor de C24 se comió del lado de SQL: el
   * esquema completa las llaves ausentes de un lado y del otro no, así que dos
   * políticas idénticas salen «divergentes» por una llave que ninguno de los
   * dos declaró. La primera versión de este archivo lo hacía y su propia
   * prueba lo atrapó — la de «si el sello y el contrato coinciden».
   */
  const vivaNormalizada = normalizar(politicaDelContrato);
  const contratoCambioDesdeElSello = LLAVES_QUE_SE_LEEN.some(
    (llave) =>
      JSON.stringify(politica?.[llave] ?? null) !==
      JSON.stringify(vivaNormalizada?.[llave] ?? null),
  );

  return { politica, origen: "sello", contratoCambioDesdeElSello };
}
