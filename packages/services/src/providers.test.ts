import { describe, expect, it, vi } from "vitest";
import { getCompasProvider, getProviderForCarrier, tieneConexionGps } from "./providers.js";

function repos(perfil: { gpsProvider: string } | undefined, creds: unknown = null) {
  const getGpsCredentials = vi.fn(async () => creds);
  return {
    getGpsCredentials,
    repos: {
      carriers: { getProfileByAccountId: async () => perfil, getGpsCredentials },
    } as never,
  };
}

const compas = { baseUrl: "https://compas.ejemplo", userId: "repo@compas.local", password: "x" };
const base = { umbrellaBaseUrl: "https://umbrella.ejemplo" };

describe("la conexión de plataforma a Compás", () => {
  it("una cuenta en Compás usa la conexión del ambiente y NO lee credencial de la cuenta", async () => {
    const f = repos({ gpsProvider: "compas" });
    const p = await getProviderForCarrier(f.repos, { ...base, compas }, "cuenta");
    expect(p.name).toBe("traccar");
    expect(f.getGpsCredentials).not.toHaveBeenCalled();
  });

  it("sin conexión en el ambiente, lanza nombrando las variables: no cae a Umbrella en silencio", async () => {
    const f = repos({ gpsProvider: "compas" });
    await expect(getProviderForCarrier(f.repos, base, "cuenta")).rejects.toThrow(
      /COMPAS_GPS_URL, COMPAS_GPS_USERID y COMPAS_GPS_PASSWORD/,
    );
    expect(() => getCompasProvider({ ...base, compas: { ...compas, password: "" } })).toThrow(
      /COMPAS_GPS_PASSWORD/,
    );
  });

  it("otro proveedor sigue siendo posible: una cuenta con Traccar propio usa SU credencial", async () => {
    const f = repos(
      { gpsProvider: "traccar" },
      { provider: "traccar", userId: "u", password: "p", baseUrl: "https://ajeno.ejemplo" },
    );
    const p = await getProviderForCarrier(f.repos, { ...base, compas }, "cuenta");
    expect(p.name).toBe("traccar");
    expect(f.getGpsCredentials).toHaveBeenCalled();
  });

  it("¿tiene conexión? Compás sin credencial sí; otro proveedor sin credencial no", async () => {
    expect(await tieneConexionGps(repos({ gpsProvider: "compas" }).repos, "c")).toBe(true);
    expect(await tieneConexionGps(repos({ gpsProvider: "umbrella" }).repos, "c")).toBe(false);
    expect(
      await tieneConexionGps(
        repos({ gpsProvider: "umbrella" }, { provider: "umbrella", userId: "u", password: "p" }).repos,
        "c",
      ),
    ).toBe(true);
  });
});
