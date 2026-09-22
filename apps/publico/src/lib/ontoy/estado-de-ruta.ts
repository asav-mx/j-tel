/**
 * Lo que el servidor ya resolvió del horario de cada ruta. **La pantalla lee,
 * no deduce** — la escalera de estados (8.9) se resuelve allá, con la zona
 * horaria del circuito.
 *
 * Vivía dentro de `vista-rutas.tsx`. Salió aquí cuando esa pantalla se retiró y
 * las rutas subieron a Inicio (22-sep-2026): un contrato que leen la portada y
 * dos componentes no vive dentro de uno de ellos.
 */
export interface EstadoDeRuta {
  circuito_id: string;
  /** `abierto` · `cerrado` · `por_arrancar`. Resuelto en el servidor con la zona del circuito. */
  situacion: "abierto" | "cerrado" | "por_arrancar";
  /** A qué hora abre, para poder decirlo cuando está cerrada. */
  abre_a: string;
  /** El día que arranca, cuando todavía no opera. */
  arranca_el: string | null;
}
