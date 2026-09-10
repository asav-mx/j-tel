import { describe, expect, it, vi } from "vitest";
import { TraccarGpsProvider, kmhDesdeNudos } from "./index.js";

/**
 * Estas pruebas corren contra respuestas **con la forma que declara el OpenAPI
 * de Traccar**, no contra un servidor real. Eso es lo que se puede sostener hoy
 * y así queda dicho: lo que prueban es que el mapeo respeta el contrato
 * publicado, no que un FTC927 en la calle produzca justo esto.
 *
 * La comprobación contra fierro es otra, es la que de verdad cierra el frente,
 * y no la sustituye ninguna prueba de aquí.
 */

function servidorFalso(rutas: Record<string, unknown>, espia?: (url: string) => void) {
  return vi.fn(async (url: string | URL | Request) => {
    const texto = String(url);
    espia?.(texto);
    const ruta = texto.replace(/^https?:\/\/[^/]+/, "");
    const cuerpo = rutas[ruta];
    if (cuerpo === undefined) {
      return new Response("no encontrado", { status: 404 });
    }
    return new Response(JSON.stringify(cuerpo), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const CONFIG = {
  baseUrl: "https://traccar.ejemplo.mx",
  credentials: { userId: "jtel", password: "secreto" },
};

const DOS_APARATOS = [
  { id: 7, name: "Bus 101", uniqueId: "352093081234567", lastUpdate: "2026-09-10T18:00:00Z" },
  { id: 9, name: "Bus 102", uniqueId: "352093089999999", lastUpdate: "2026-09-10T18:01:00Z" },
];

describe("la unidad de la velocidad", () => {
  it("un nudo es 1.852 km/h", () => {
    expect(kmhDesdeNudos(1)).toBeCloseTo(1.852, 6);
    expect(kmhDesdeNudos(0)).toBe(0);
  });

  /**
   * La valla del punto 1 del encabezado. Si alguien «simplifica» pasando
   * `speed` tal cual, esto se cae — y sin ella el error es invisible: el número
   * sigue siendo un número plausible.
   */
  it("convierte la velocidad de Traccar a km/h, no la pasa tal cual", async () => {
    const fetchImpl = servidorFalso({
      "/api/session": { id: 1 },
      "/api/devices": DOS_APARATOS,
      "/api/positions": [
        {
          deviceId: 7,
          fixTime: "2026-09-10T18:00:00Z",
          valid: true,
          latitude: 31.7,
          longitude: -106.45,
          speed: 30, // nudos
          course: 180,
        },
      ],
    });

    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    const token = await p.login();
    const puntos = await p.getLastLocations(token);

    expect(puntos).toHaveLength(1);
    // 30 nudos = 55.56 km/h. Si saliera 30, la conversión se perdió.
    expect(puntos[0]!.speed).toBeCloseTo(55.56, 1);
    expect(puntos[0]!.speed).not.toBe(30);
  });

  it("el rumbo NO se convierte: los dos proveedores hablan grados", async () => {
    const fetchImpl = servidorFalso({
      "/api/session": { id: 1 },
      "/api/devices": DOS_APARATOS,
      "/api/positions": [
        {
          deviceId: 7,
          fixTime: "2026-09-10T18:00:00Z",
          valid: true,
          latitude: 31.7,
          longitude: -106.45,
          course: 271.5,
        },
      ],
    });
    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    const puntos = await p.getLastLocations(await p.login());
    expect(puntos[0]!.heading).toBe(271.5);
  });
});

describe("el deviceId de Traccar no es el IMEI", () => {
  /**
   * La valla del punto 2. Escribir el `deviceId` como imei compila, corre, y
   * envenena el índice único de `telemetry_points`, que va sobre
   * (imei, recorded_at).
   */
  it("resuelve el imei por el catálogo, nunca usa el deviceId", async () => {
    const fetchImpl = servidorFalso({
      "/api/session": { id: 1 },
      "/api/devices": DOS_APARATOS,
      "/api/positions": [
        { deviceId: 9, fixTime: "2026-09-10T18:00:00Z", valid: true, latitude: 31.7, longitude: -106.4 },
      ],
    });
    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    const puntos = await p.getLastLocations(await p.login());

    expect(puntos[0]!.imei).toBe("352093089999999");
    expect(puntos[0]!.imei).not.toBe("9");
  });

  it("descarta la posición de un aparato que no está en el catálogo", async () => {
    const fetchImpl = servidorFalso({
      "/api/session": { id: 1 },
      "/api/devices": DOS_APARATOS,
      "/api/positions": [
        { deviceId: 404, fixTime: "2026-09-10T18:00:00Z", valid: true, latitude: 31.7, longitude: -106.4 },
      ],
    });
    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    expect(await p.getLastLocations(await p.login())).toEqual([]);
  });
});

describe("lo que no se midió no se escribe", () => {
  /** La valla del punto 3, que es §E: una posición inválida no es una posición. */
  it("tira las posiciones marcadas inválidas por el equipo", async () => {
    const fetchImpl = servidorFalso({
      "/api/session": { id: 1 },
      "/api/devices": DOS_APARATOS,
      "/api/positions": [
        { deviceId: 7, fixTime: "2026-09-10T18:00:00Z", valid: false, latitude: 0, longitude: 0 },
        { deviceId: 9, fixTime: "2026-09-10T18:00:00Z", valid: true, latitude: 31.7, longitude: -106.4 },
      ],
    });
    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    const puntos = await p.getLastLocations(await p.login());

    expect(puntos).toHaveLength(1);
    expect(puntos[0]!.imei).toBe("352093089999999");
  });

  it("tira la posición sin hora utilizable", async () => {
    const fetchImpl = servidorFalso({
      "/api/session": { id: 1 },
      "/api/devices": DOS_APARATOS,
      "/api/positions": [
        { deviceId: 7, valid: true, latitude: 31.7, longitude: -106.4 },
        { deviceId: 9, fixTime: "no es una fecha", valid: true, latitude: 31.7, longitude: -106.4 },
      ],
    });
    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    expect(await p.getLastLocations(await p.login())).toEqual([]);
  });

  /**
   * `serverTime` es cuándo lo recibió el servidor, no cuándo el equipo tomó el
   * fix. Usarlo metería el retraso de la red dentro de la hora del punto, que
   * es la falla que el archivador ya paga por su lado.
   */
  it("prefiere fixTime, cae a deviceTime, y NUNCA usa serverTime", async () => {
    const fetchImpl = servidorFalso({
      "/api/session": { id: 1 },
      "/api/devices": DOS_APARATOS,
      "/api/positions": [
        {
          deviceId: 7,
          fixTime: "2026-09-10T18:00:00Z",
          deviceTime: "2026-09-10T18:00:30Z",
          serverTime: "2026-09-10T18:09:00Z",
          valid: true, latitude: 31.7, longitude: -106.4,
        },
        {
          deviceId: 9,
          deviceTime: "2026-09-10T18:02:00Z",
          serverTime: "2026-09-10T18:11:00Z",
          valid: true, latitude: 31.7, longitude: -106.4,
        },
      ],
    });
    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    const puntos = await p.getLastLocations(await p.login());

    expect(puntos[0]!.timestamp.toISOString()).toBe("2026-09-10T18:00:00.000Z");
    expect(puntos[1]!.timestamp.toISOString()).toBe("2026-09-10T18:02:00.000Z");
  });
});

describe("una credencial revocada falla ruidosa", () => {
  /**
   * Es la razón entera de que `login` hable con el servidor. Sin esto una
   * credencial mala devuelve listas vacías y la ingesta se detiene en silencio
   * — que es como se habría perdido el corte de Umbrella si su login no
   * fallara.
   */
  it("login revienta si /api/session no autoriza", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("Unauthorized", { status: 401 }),
    ) as unknown as typeof fetch;

    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    await expect(p.login()).rejects.toThrow(/No se obtuvo sesión de Traccar/);
  });

  it("el mensaje trae el código y la causa, para que sirva en ingest_alerts", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("Account is disabled", { status: 403 }),
    ) as unknown as typeof fetch;

    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    await expect(p.login()).rejects.toThrow(/403/);
    await expect(p.login()).rejects.toThrow(/Account is disabled/);
  });
});

describe("autorización", () => {
  it("usa básica cuando hay usuario y secreto", async () => {
    const vistas: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      vistas.push(String((init?.headers as Record<string, string>).Authorization));
      return new Response(JSON.stringify({ id: 1 }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    await p.login();
    expect(vistas[0]).toBe(`Basic ${Buffer.from("jtel:secreto").toString("base64")}`);
  });

  /** Un secreto sin usuario es un token de cuenta. Traccar los acepta así. */
  it("usa bearer cuando hay secreto y no hay usuario", async () => {
    const vistas: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      vistas.push(String((init?.headers as Record<string, string>).Authorization));
      return new Response(JSON.stringify({ id: 1 }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const p = new TraccarGpsProvider(
      { baseUrl: CONFIG.baseUrl, credentials: { userId: "", password: "T0K3N" } },
      { fetchImpl },
    );
    await p.login();
    expect(vistas[0]).toBe("Bearer T0K3N");
  });
});

describe("el histórico", () => {
  it("pide por deviceId con from y to, un aparato a la vez", async () => {
    const urls: string[] = [];
    const fetchImpl = servidorFalso(
      {
        "/api/session": { id: 1 },
        "/api/devices": DOS_APARATOS,
        "/api/positions?deviceId=7&from=2026-09-10T00%3A00%3A00.000Z&to=2026-09-10T01%3A00%3A00.000Z": [
          { deviceId: 7, fixTime: "2026-09-10T00:30:00Z", valid: true, latitude: 31.7, longitude: -106.4 },
        ],
        "/api/positions?deviceId=9&from=2026-09-10T00%3A00%3A00.000Z&to=2026-09-10T01%3A00%3A00.000Z": [
          { deviceId: 9, fixTime: "2026-09-10T00:10:00Z", valid: true, latitude: 31.7, longitude: -106.4 },
        ],
      },
      (u) => urls.push(u),
    );

    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    const puntos = await p.getHistoryLocations(await p.login(), {
      beginGmt: new Date("2026-09-10T00:00:00Z"),
      endGmt: new Date("2026-09-10T01:00:00Z"),
    });

    expect(puntos).toHaveLength(2);
    // Ordenado por hora, como los devuelve Umbrella.
    expect(puntos[0]!.timestamp.toISOString()).toBe("2026-09-10T00:10:00.000Z");
    expect(urls.filter((u) => u.includes("deviceId="))).toHaveLength(2);
  });

  it("sólo pide los imeis que le pasan", async () => {
    const urls: string[] = [];
    const fetchImpl = servidorFalso(
      {
        "/api/session": { id: 1 },
        "/api/devices": DOS_APARATOS,
        "/api/positions?deviceId=9&from=2026-09-10T00%3A00%3A00.000Z&to=2026-09-10T01%3A00%3A00.000Z": [],
      },
      (u) => urls.push(u),
    );

    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    await p.getHistoryLocations(await p.login(), {
      imeis: ["352093089999999"],
      beginGmt: new Date("2026-09-10T00:00:00Z"),
      endGmt: new Date("2026-09-10T01:00:00Z"),
    });

    const pedidas = urls.filter((u) => u.includes("deviceId="));
    expect(pedidas).toHaveLength(1);
    expect(pedidas[0]).toContain("deviceId=9");
  });
});

describe("el catálogo de aparatos", () => {
  it("se cachea dentro de su ventana y se vuelve a pedir después", async () => {
    const urls: string[] = [];
    const fetchImpl = servidorFalso(
      { "/api/session": { id: 1 }, "/api/devices": DOS_APARATOS, "/api/positions": [] },
      (u) => urls.push(u),
    );

    const p = new TraccarGpsProvider(CONFIG, { fetchImpl, catalogoTtlMs: 60_000 });
    const token = await p.login();
    await p.getLastLocations(token);
    await p.getLastLocations(token);

    expect(urls.filter((u) => u.endsWith("/api/devices"))).toHaveLength(1);
  });

  it("con ttl cero lo vuelve a pedir cada vez, para que un alta se vea", async () => {
    const urls: string[] = [];
    const fetchImpl = servidorFalso(
      { "/api/session": { id: 1 }, "/api/devices": DOS_APARATOS, "/api/positions": [] },
      (u) => urls.push(u),
    );

    const p = new TraccarGpsProvider(CONFIG, { fetchImpl, catalogoTtlMs: 0 });
    const token = await p.login();
    await p.getLastLocations(token);
    await p.getLastLocations(token);

    expect(urls.filter((u) => u.endsWith("/api/devices"))).toHaveLength(2);
  });
});

describe("getDevices", () => {
  it("mapea uniqueId a imei y descarta los que no lo traen", async () => {
    const fetchImpl = servidorFalso({
      "/api/session": { id: 1 },
      "/api/devices": [...DOS_APARATOS, { id: 11, name: "Sin identificador" }],
    });
    const p = new TraccarGpsProvider(CONFIG, { fetchImpl });
    const aparatos = await p.getDevices(await p.login());

    expect(aparatos).toHaveLength(2);
    expect(aparatos.map((a) => a.imei)).toEqual(["352093081234567", "352093089999999"]);
    expect(aparatos[0]!.label).toBe("Bus 101");
  });
});
