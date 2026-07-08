import { createUmbrellaProvider } from "@jtel/gps-umbrella";
import type { Repositories } from "@jtel/db";

export interface GpsBackendConfig {
  umbrellaBaseUrl: string;
  umbrellaUserId?: string;
  umbrellaPassword?: string;
}

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
    default:
      throw new Error(`Proveedor GPS no soportado todavía: ${provider}`);
  }
}

export type GpsProviderInstance = ReturnType<typeof buildProvider>;

/**
 * Devuelve el proveedor GPS de un carrier usando sus credenciales guardadas en
 * la base. Si el carrier todavía no configuró credenciales, cae al respaldo por
 * variables de entorno globales (transición).
 */
export async function getProviderForCarrier(
  repos: Repositories,
  config: GpsBackendConfig,
  carrierAccountId: string,
): Promise<GpsProviderInstance> {
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
