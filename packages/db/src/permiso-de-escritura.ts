/**
 * El permiso de escribir, pedido explícitamente.
 *
 * Regla de Asav, 14 de septiembre de 2026: **nada que escriba en producción
 * corre sin pedirlo explícitamente.** El barrido de ese día encontró ocho
 * herramientas del repo que escribían con sólo correrlas —rellenos de GPS,
 * la copia de la memoria vieja, las duraciones de ruta, las etiquetas de
 * residuales, el recorte de servicios futuros, y el worker que sella
 * veredictos—, cada una contra el `DATABASE_URL` del `.env` de quien la
 * corriera, que es producción.
 *
 * Ninguna fabricaba datos. Todas tocaban datos reales con un solo comando, y
 * un comando se corre por costumbre, por copiar la línea equivocada del
 * historial o por probar «a ver qué hace».
 *
 * Sin `--aplicar`, la herramienta dice qué haría y contra qué base, y sale sin
 * tocar nada. Con `--aplicar`, lo dice igual y lo hace.
 *
 * Lo que re-sella veredictos va un paso más allá —lista y sí tecleado—; ver
 * `packages/services/src/resello.ts`.
 */

/** Sin `--aplicar`, nunca. Ni `-y`, ni `--force`, ni `--apply`. */
export function quiereAplicar(argv: string[]): boolean {
  return argv.includes("--aplicar");
}

/** A dónde va a escribir, sin usuario ni contraseña: lo que se puede imprimir. */
export function destinoLegible(url: string | undefined): string {
  if (!url) return "(sin URL de base)";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return "(URL de base ilegible)";
  }
}

/**
 * Lo que llaman las herramientas antes de abrir la base. Devuelve `true` sólo
 * con `--aplicar`; sin él imprime qué habría hecho y la herramienta sale.
 */
export function pedirAplicar(entrada: {
  guion: string;
  /** Qué escribe, en una frase. */
  queEscribe: string;
  url: string | undefined;
  /** Los parámetros que definen el alcance, para que se lean antes de aplicar. */
  alcance?: Record<string, string | number | boolean | null | undefined>;
  argv?: string[];
}): boolean {
  const argv = entrada.argv ?? process.argv;
  const aplicar = quiereAplicar(argv);
  const alcance = Object.entries(entrada.alcance ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(" · ");

  console.log(
    `\n  [${entrada.guion}] ${entrada.queEscribe}\n` +
      `  destino: ${destinoLegible(entrada.url)}${alcance ? `\n  alcance: ${alcance}` : ""}`,
  );
  if (!aplicar) {
    console.log("  SIMULACIÓN: no se ejecutó nada. Para escribir, vuelve a correrlo con --aplicar.\n");
  } else {
    console.log("  --aplicar: escribiendo.\n");
  }
  return aplicar;
}
