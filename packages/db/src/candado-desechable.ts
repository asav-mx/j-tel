/**
 * El candado de los guiones que SIEMBRAN.
 *
 * Un guion que escribe datos y vive en el repo es un arma cargada: se corre con
 * el `.env` de quien lo corra, y ese `.env` trae la conexión de producción a dos
 * líneas de distancia. El #206 ya enseñó lo que cuesta equivocarse —una cuenta
 * de mentiras en producción, con 84 hechos sellados encima, 52 de ellos
 * acusaciones formales por servicios que nadie prestó—.
 *
 * Por eso esto **no es una advertencia en un comentario**: es una función que se
 * niega y sale con código 1. Misma lógica que la valla de tipos del rango — no
 * confiar en que nadie se equivoque.
 *
 * ## Lo que comprueba, y por qué así
 *
 * **1. No hay respaldo.** Sólo se lee `DATABASE_URL_TEST`. Nunca hay una caída a
 * `DATABASE_URL` «si la otra no está»: esa caída es exactamente el accidente.
 *
 * **2. Se compara la IDENTIDAD, no la cadena.** Dos URLs distintas pueden ser la
 * misma base: distinto usuario, distinta contraseña, el parámetro `sslmode`
 * puesto o no. Comparar texto con texto deja pasar todos esos casos. Se comparan
 * host, puerto y nombre de base.
 *
 * Y el host se **normaliza quitándole el sufijo `-pooler`**, que es la trampa
 * concreta de Neon: `ep-x-123-pooler.neon.tech` y `ep-x-123.neon.tech` se ven
 * distintos y son la misma base. Sin esto, apuntar el guion al puerto agrupado
 * de producción pasaría el candado.
 *
 * **3. No se actúa a ciegas.** Si en el ambiente no hay ninguna otra conexión
 * contra la cual comparar, el candado no puede afirmar que el objetivo no es
 * producción — y entonces **exige que quien lo corre nombre el destino** con
 * `--base <fragmento-del-host>`. Es el mismo principio que publicar un circuito:
 * un acto explícito, que no se satisface por descuido.
 *
 * ## Lo que este candado NO prueba, y conviene decirlo
 *
 * Que la base de destino sea *la* rama desechable. Prueba que **no es ninguna de
 * las que el ambiente conoce**, que es lo que ataja el accidente real. Una rama
 * desechable es una copia de producción, así que **ningún dato de adentro las
 * distingue**: el discriminador es la conexión, y ahí es donde mira esto.
 */

/** Host, puerto y base: lo que de verdad identifica a dónde se va a escribir. */
export interface IdentidadDeBase {
  host: string;
  puerto: string;
  base: string;
}

/**
 * De dónde salió una conexión, para poder nombrarla en el mensaje de rechazo.
 * Un candado que dice «no» sin decir contra qué chocó obliga a adivinar.
 */
export interface ConexionConocida {
  nombre: string;
  url: string | undefined;
}

/**
 * El sufijo del punto de conexión agrupado de Neon. Se quita para comparar: es
 * la misma base servida por otra puerta.
 */
const SUFIJO_AGRUPADO = "-pooler";

export function identidadDeBase(url: string | undefined): IdentidadDeBase | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!u.hostname) return null;

  const partes = u.hostname.toLowerCase().split(".");
  if (partes[0]?.endsWith(SUFIJO_AGRUPADO)) {
    partes[0] = partes[0]!.slice(0, -SUFIJO_AGRUPADO.length);
  }

  return {
    host: partes.join("."),
    // Sin puerto explícito, el de Postgres. Si no, `5432` y `` compararían distinto.
    puerto: u.port || "5432",
    base: decodeURIComponent(u.pathname.replace(/^\//, "")).toLowerCase(),
  };
}

export function mismaBase(a: IdentidadDeBase, b: IdentidadDeBase): boolean {
  return a.host === b.host && a.puerto === b.puerto && a.base === b.base;
}

export type Veredicto =
  | { ok: true; identidad: IdentidadDeBase; comparadaCon: string[] }
  | { ok: false; motivo: string };

/**
 * ¿Se puede sembrar en esta base?
 *
 * `confirmacion` es el valor de `--base`: un fragmento del host que quien corre
 * el guion escribió a mano. Sólo hace falta cuando no hay contra qué comparar.
 */
export function revisarDesechable(entrada: {
  objetivo: string | undefined;
  otras: ConexionConocida[];
  confirmacion?: string;
}): Veredicto {
  const { objetivo, otras, confirmacion } = entrada;

  if (!objetivo) {
    return {
      ok: false,
      motivo:
        "DATABASE_URL_TEST no está definida. Este guion NO cae a DATABASE_URL: esa caída " +
        "es justo el accidente que el candado existe para impedir.",
    };
  }

  const yo = identidadDeBase(objetivo);
  if (!yo) {
    return { ok: false, motivo: "DATABASE_URL_TEST no se puede leer como una URL de Postgres." };
  }

  const conocidas = otras.filter((o) => o.url);
  const comparadaCon: string[] = [];

  for (const otra of conocidas) {
    const suya = identidadDeBase(otra.url);
    if (!suya) continue;
    comparadaCon.push(otra.nombre);
    if (mismaBase(yo, suya)) {
      return {
        ok: false,
        motivo:
          `DATABASE_URL_TEST apunta a LA MISMA BASE que ${otra.nombre} ` +
          `(${yo.host}:${yo.puerto}/${yo.base}). No se siembra ahí. ` +
          "Si las dos URLs se ven distintas, es por el usuario, la contraseña o el " +
          "sufijo -pooler: el candado compara host, puerto y base, no el texto.",
      };
    }
  }

  if (comparadaCon.length === 0) {
    if (!confirmacion) {
      return {
        ok: false,
        motivo:
          "No hay ninguna otra conexión en el ambiente contra la cual comparar, así que el " +
          `candado NO puede afirmar que ${yo.host}:${yo.puerto}/${yo.base} no sea producción. ` +
          `Nombra el destino a mano para seguir:  --base <fragmento-del-host>`,
      };
    }
    if (!yo.host.includes(confirmacion.toLowerCase())) {
      return {
        ok: false,
        motivo:
          `El destino es ${yo.host}, y --base dice «${confirmacion}», que no aparece ahí. ` +
          "O la variable apunta a otro lado del que crees, o el fragmento está mal escrito.",
      };
    }
  }

  return { ok: true, identidad: yo, comparadaCon };
}

/** Las conexiones que este repo puede traer en el `.env`. Todas son «no aquí». */
export function conexionesDelAmbiente(env: NodeJS.ProcessEnv): ConexionConocida[] {
  return [
    { nombre: "DATABASE_URL (dueño de producción)", url: env.DATABASE_URL },
    { nombre: "DATABASE_URL_READONLY (producción)", url: env.DATABASE_URL_READONLY },
    { nombre: "POSTGRES_URL", url: env.POSTGRES_URL },
    { nombre: "POSTGRES_URL_NON_POOLING", url: env.POSTGRES_URL_NON_POOLING },
    { nombre: "POSTGRES_PRISMA_URL", url: env.POSTGRES_PRISMA_URL },
    { nombre: "SEED_DATABASE_URL", url: env.SEED_DATABASE_URL },
    { nombre: "JRZ_OLD_MEMORY_DATABASE_URL", url: env.JRZ_OLD_MEMORY_DATABASE_URL },
  ];
}
