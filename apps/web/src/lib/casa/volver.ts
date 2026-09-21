/**
 * A dónde regresa una escritura de circuitos cuando la pidió la casa nueva de
 * J-Staff (21-sep-2026).
 *
 * Las rutas de `/api/jstaff/circuitos/*` son de la pantalla vieja y regresan a
 * ella. El cuarto nuevo usa **las mismas escrituras** —no se duplica ninguna—
 * y sólo les pide otro destino con el campo `volver`. Se acepta **sólo** un
 * camino relativo bajo `/casa/jstaff/circuitos`: cualquier otra cosa (otro
 * sitio, `//dominio`, un camino fuera del cuarto) se ignora y la ruta regresa a
 * donde siempre. Sin `volver`, nada cambia para la pantalla vieja.
 */
export function destinoDeVuelta(form: FormData): string | null {
  const v = String(form.get("volver") ?? "").trim();
  if (!/^\/casa\/jstaff\/circuitos(\/[a-z0-9-]+)*$/.test(v)) return null;
  return v;
}
