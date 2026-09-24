import { NextResponse } from "next/server";
import { LLAVE_DE_LABORATORIO } from "@jtel/domain/boleto";
import type { LoteDelLector } from "@jtel/domain/sincronizacion";
import { getRepos } from "@/lib/db";

/**
 * **La entrega del lector** — Ontoy 3.0 · PR P3.5.
 *
 * Por aquí un lector le cuenta a J-Tel lo que quemó sin red. Es la puerta por
 * la que se escribe el libro de boletos, que no se puede editar después.
 *
 * ## Abierta, y por qué eso no es un descuido
 *
 * Vive en la app pública (decisión de Asav, 23-sep-2026, opción d1): el lector
 * corre en un teléfono cualquiera, sin sesión y sin cuenta, y ponerle el SSO
 * de la cara interna lo dejaría fuera justo cuando recupera señal en la calle.
 *
 * Lo que decide quién puede escribir **no es una sesión, es una firma**: el
 * lote viene firmado con la llave privada del lector, y J-Tel la compara
 * contra la pública que registró al darlo de alta. Un lector dado de baja
 * queda revocado en el instante, y su intento **queda escrito**.
 *
 * Lo que esto no frena es el ruido: alguien puede mandar lotes basura y
 * gastarnos función. Contra eso va la regla del firewall sobre `/api/boletos/`
 * (`docs/Procedimiento-Firewall-Publico.md`), que **hay que poner a mano** —
 * como la de `/api/circuitos/`, y por la misma razón que aquel archivo existe.
 *
 * ## Lo que el servidor NO decide aquí
 *
 * No decide si el boleto valía: eso lo decidió el aparato, sin red, en el
 * momento, y volver a juzgarlo con el reloj del servidor sería juzgar con una
 * hora que nadie tenía. Lo único que se vuelve a mirar es **que el folio
 * exista** —la firma de J-Tel sobre el boleto—, porque un lector robado tiene
 * su propia llave y podría inventar folios con ella.
 *
 * Y no decide de quién es el dinero. Eso es la Pieza 10 (8.14) y ni siquiera
 * está diseñado.
 */
export async function POST(request: Request) {
  let cuerpo: { lote?: LoteDelLector; firma?: string };
  try {
    cuerpo = (await request.json()) as { lote?: LoteDelLector; firma?: string };
  } catch {
    return json({ error: "cuerpo_ilegible" }, 400);
  }

  const { lote, firma } = cuerpo;
  if (!lote || typeof firma !== "string") {
    return json({ error: "falta_el_lote_o_la_firma" }, 400);
  }
  /*
   * El tope de renglones por lote. No es una regla del negocio: es que un
   * cuerpo sin límite es una función sin límite. Un lector con el día lleno
   * trae 20 pasos (`TOPE_SIN_SENAL`); 200 es holgura de sobra para un aparato
   * que estuvo días sin hablar, y sigue siendo un número.
   */
  if (!Array.isArray(lote.pasos) || lote.pasos.length > 200) {
    return json({ error: "lote_demasiado_grande" }, 413);
  }

  const resultado = await getRepos().libroDeBoletos.recibirLote({
    lote,
    firma,
    /*
     * La llave de LABORATORIO, dicha aquí en el sitio donde se usa: hoy los
     * boletos los firma el teléfono del pasajero con ella (P2). Cuando J-Tel
     * emita de su lado, ésta es la línea que cambia — y `boleto-llave.ts`
     * explica por qué ninguna función la toma por omisión.
     */
    llavePublicaDeJTel: LLAVE_DE_LABORATORIO.publica,
  });

  if (!resultado.ok) {
    /* Un lector que no existe o que está de baja no se distingue por el código:
       los dos son «tu llave no vale aquí». El motivo sí se dice, porque el
       aparato honesto necesita saber si tiene que pedir que lo den de alta. */
    const estado = resultado.error === "entrega_simultanea" ? 409 : 403;
    return json({ error: resultado.error }, estado);
  }

  /*
   * `acusados` son los renglones de los que el lector ya no tiene que
   * responder: los que entraron ahora **y los que ya estaban**. Un reenvío
   * tiene que poder cerrar el ciclo igual que la primera entrega, o el aparato
   * los cargaría para siempre.
   */
  const rechazados = resultado.rechazados.map((r) => ({ paso: r.paso, motivo: r.motivo }));
  const noAcusados = new Set(rechazados.map((r) => r.paso));
  const acusados = lote.pasos.map((p) => p.paso).filter((paso) => !noAcusados.has(paso));

  return json({
    acusados,
    rechazados,
    /* Cuántos hallazgos levantó esta entrega. El aparato no los muestra —no es
       asunto del chofer— pero el número no se esconde de quien pregunta. */
    hallazgos: resultado.hallazgos.length,
  });
}

/** Nada de esto se cachea: una entrega servida del CDN sería una que no se guardó. */
function json(cuerpo: unknown, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { "cache-control": "no-store" } });
}
