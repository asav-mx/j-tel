import { createUmbrellaProvider } from "@jtel/gps-umbrella";
import { createTraccarProvider } from "@jtel/gps-traccar";
import type { Repositories } from "@jtel/db";

/**
 * La conexión de plataforma a Compás: una sola para todas las cuentas.
 *
 * Compás es el Traccar de J-Tel, no de un cliente. Su credencial vive en el
 * ambiente del servidor (`COMPAS_GPS_URL`, `COMPAS_GPS_USERID`,
 * `COMPAS_GPS_PASSWORD`) y **nunca en una cuenta**: si viviera en cada
 * `carrier_profiles`, el secreto del servidor quedaría copiado tantas veces
 * como clientes haya, y cada cuenta nueva nacería ciega hasta que alguien lo
 * pegara a mano. Eso fue lo que pasó el 14 de septiembre de 2026 con la cuenta
 * asav: sus aparatos transmitían a Compás y J-Tel los buscaba en Umbrella.
 */
export interface CompasConfig {
  baseUrl: string;
  userId: string;
  password: string;
}

export interface GpsBackendConfig {
  umbrellaBaseUrl: string;
  umbrellaUserId?: string;
  umbrellaPassword?: string;
  /** Ausente si el ambiente no la trae. Ver `PROVEEDOR_COMPAS`. */
  compas?: CompasConfig;
}

/**
 * El valor de `carrier_profiles.gps_provider` que significa «la conexión de
 * plataforma». Es el valor por omisión de una cuenta nueva desde la 0035.
 *
 * Distinto de `traccar` a propósito: `traccar` es un Traccar cualquiera con la
 * credencial guardada en la cuenta, que sigue siendo posible para un cliente
 * que traiga el suyo. `compas` no lleva credencial en la cuenta.
 */
export const PROVEEDOR_COMPAS = "compas";

/** Construye un proveedor GPS a partir de su nombre y credenciales. */
export function buildProvider(
  provider: string,
  baseUrl: string,
  userId: string,
  password: string,
) {
  switch (provider) {
    case "umbrella":
      return createUmbrellaProvider({ baseUrl, credentials: { userId, password } });
    /*
     * Compás — el camino propio, contra un Traccar nuestro. Entró por el corte
     * de Umbrella del 5 de septiembre de 2026.
     *
     * Que esto sea un renglón es el punto: el recolector y el archivador pasan
     * los dos por aquí, así que un carrier cambia de fuente de evidencia
     * moviendo una columna, sin desplegar nada. Ver `gps_provider` en el
     * esquema.
     */
    case "traccar":
      return createTraccarProvider({ baseUrl, credentials: { userId, password } });
    default:
      throw new Error(`Proveedor GPS no soportado todavía: ${provider}`);
  }
}

export type GpsProviderInstance = ReturnType<typeof buildProvider>;

/**
 * El proveedor de la conexión de plataforma.
 *
 * Lanza si el ambiente no la trae, con el nombre de las variables: una cuenta
 * que apunta a Compás sin conexión configurada es un error de despliegue, y
 * caer a otro proveedor en silencio es justo el fallo mudo que esto elimina.
 */
export function getCompasProvider(config: GpsBackendConfig): GpsProviderInstance {
  const c = config.compas;
  if (!c?.baseUrl || !c.userId || !c.password) {
    throw new Error(
      "Falta la conexión de plataforma a Compás: COMPAS_GPS_URL, COMPAS_GPS_USERID y COMPAS_GPS_PASSWORD en el ambiente.",
    );
  }
  return buildProvider("traccar", c.baseUrl, c.userId, c.password);
}

/** Si el carrier lee de la conexión de plataforma. Sin perfil, no. */
export function usaCompas(perfil: { gpsProvider?: string | null } | null | undefined): boolean {
  return perfil?.gpsProvider === PROVEEDOR_COMPAS;
}

/**
 * Si el carrier tiene de dónde leer GPS: la conexión de plataforma, o una
 * credencial propia guardada en su cuenta.
 *
 * Es la pregunta que el archivador y el rellenador de huecos se hacían con
 * «¿tiene credenciales?», y que dejó de ser la misma: una cuenta en Compás no
 * guarda credencial y sí tiene conexión.
 */
export async function tieneConexionGps(
  repos: Repositories,
  carrierAccountId: string,
): Promise<boolean> {
  const perfil = await repos.carriers.getProfileByAccountId(carrierAccountId);
  if (usaCompas(perfil)) return true;
  return (await repos.carriers.getGpsCredentials(carrierAccountId)) !== null;
}

/**
 * Devuelve el proveedor GPS de un carrier.
 *
 * Una cuenta en Compás usa la conexión de plataforma. Cualquier otra usa la
 * credencial guardada en su cuenta; si no la tiene, cae al respaldo por
 * variables de entorno de Umbrella (transición, y lo que dejó ciega a la
 * cuenta asav: por eso las cuentas nuevas nacen en Compás).
 */
export async function getProviderForCarrier(
  repos: Repositories,
  config: GpsBackendConfig,
  carrierAccountId: string,
): Promise<GpsProviderInstance> {
  const perfil = await repos.carriers.getProfileByAccountId(carrierAccountId);
  if (usaCompas(perfil)) return getCompasProvider(config);

  const creds = await repos.carriers.getGpsCredentials(carrierAccountId);
  if (creds) {
    return buildProvider(
      creds.provider,
      creds.baseUrl ?? config.umbrellaBaseUrl,
      creds.userId,
      creds.password,
    );
  }
  return buildProvider(
    "umbrella",
    config.umbrellaBaseUrl,
    config.umbrellaUserId ?? "demo_user",
    config.umbrellaPassword ?? "demo_pass",
  );
}
