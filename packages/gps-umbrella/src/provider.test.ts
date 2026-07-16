import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createUmbrellaProvider,
  clearUmbrellaTokenCache,
  ingestEvidenceForTrip,
  _resetRateLimitForTests,
  type UmbrellaGpsProvider,
} from "./index.js";

function okJson(value: unknown, state = true, message = "ok") {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ state, message, value }),
    text: async () => "",
    headers: { get: () => null },
  };
}

function errorResponse(status: number, statusText = "Error", body = "boom") {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({}),
    text: async () => body,
    headers: { get: () => null },
  };
}

const config = {
  baseUrl: "http://gps.example.com",
  credentials: { userId: "user@x", password: "p@ss w/rd" },
};

let fetchMock: ReturnType<typeof vi.fn>;

function makeProvider(): UmbrellaGpsProvider {
  return createUmbrellaProvider(config);
}

beforeEach(() => {
  _resetRateLimitForTests();
  clearUmbrellaTokenCache();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("login", () => {
  it("obtiene token y normaliza baseUrl con /openapi", async () => {
    fetchMock.mockResolvedValueOnce(okJson("tok-123"));
    const provider = makeProvider();
    const token = await provider.login();
    expect(token).toBe("tok-123");
    const calledUrl = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("/openapi/api/Login");
    expect(calledUrl).toContain("userid=user%40x");
    expect(calledUrl).toContain("password=p%40ss%20w%2Frd");
  });

  it("no duplica /openapi si ya viene en la baseUrl", async () => {
    fetchMock.mockResolvedValueOnce(okJson("tok"));
    const provider = createUmbrellaProvider({
      ...config,
      baseUrl: "http://gps.example.com/openapi/",
    });
    await provider.login();
    const calledUrl = fetchMock.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("/openapi/api/Login");
    expect(calledUrl).not.toContain("/openapi/openapi");
  });

  it("cachea el token entre llamadas", async () => {
    fetchMock.mockResolvedValueOnce(okJson("tok-cache"));
    const provider = makeProvider();
    await provider.login();
    const second = await provider.login();
    expect(second).toBe("tok-cache");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clearUmbrellaTokenCache fuerza un nuevo login", async () => {
    fetchMock.mockResolvedValue(okJson("tok"));
    const provider = makeProvider();
    await provider.login();
    clearUmbrellaTokenCache();
    await provider.login();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lanza error cuando state es false", async () => {
    fetchMock.mockResolvedValueOnce(okJson(null, false, "credenciales malas"));
    const provider = makeProvider();
    await expect(provider.login()).rejects.toThrow(/credenciales malas/);
  });
});

describe("getDevices", () => {
  it("mapea imei/label y filtra dispositivos sin imei", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        { sn_imei_id: "111", tracker_name: "Bus 1" },
        { sn_imei_id: "", tracker_name: "sin imei" },
        { tracker_name: "sin imei tampoco" },
      ]),
    );
    const provider = makeProvider();
    const devices = await provider.getDevices("tok");
    expect(devices).toEqual([{ imei: "111", label: "Bus 1" }]);
  });
});

describe("getLastLocations", () => {
  it("convierte ubicaciones y filtra inválidas", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        {
          sn_imei_id: "111",
          gps_info: { latitude: 31.7, longitude: -106.4, speed: 40, l_datetime: "2024-01-15 06:30:00" },
        },
        { sn_imei_id: "222", gps_info: { latitude: 0, longitude: 0 } },
        { sn_imei_id: "333" },
        { sn_imei_id: "444", gps_info: { latitude: 10, longitude: 20, l_datetime: "no-fecha" } },
      ]),
    );
    const provider = makeProvider();
    const points = await provider.getLastLocations("tok", ["111"]);
    expect(points).toHaveLength(1);
    expect(points[0]!.imei).toBe("111");
    expect(points[0]!.latitude).toBe(31.7);
    expect(points[0]!.speed).toBe(40);
    // Fecha sin zona se interpreta como UTC.
    expect(points[0]!.timestamp.toISOString()).toBe("2024-01-15T06:30:00.000Z");
  });

  it("respeta zona horaria explícita en el timestamp", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson([
        {
          sn_imei_id: "111",
          gps_info: { latitude: 31.7, longitude: -106.4, l_datetime: "2024-01-15T06:30:00Z" },
        },
      ]),
    );
    const provider = makeProvider();
    const points = await provider.getLastLocations("tok");
    expect(points[0]!.timestamp.toISOString()).toBe("2024-01-15T06:30:00.000Z");
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).not.toContain("Imeis=");
  });
});

describe("getHistoryLocations", () => {
  it("pagina hasta una página incompleta y ordena por timestamp", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      sn_imei_id: "111",
      gps_info: {
        latitude: 31 + i / 1000,
        longitude: -106,
        l_datetime: `2024-01-15T06:${String(i % 60).padStart(2, "0")}:00Z`,
      },
    }));
    const page2 = [
      {
        sn_imei_id: "111",
        gps_info: { latitude: 31.5, longitude: -106, l_datetime: "2024-01-15T05:00:00Z" },
      },
    ];
    fetchMock.mockResolvedValueOnce(okJson(page1)).mockResolvedValueOnce(okJson(page2));

    const provider = makeProvider();
    const points = await provider.getHistoryLocations("tok", {
      imeis: ["111"],
      beginGmt: new Date("2024-01-15T00:00:00Z"),
      endGmt: new Date("2024-01-16T00:00:00Z"),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(points).toHaveLength(101);
    // Ordenado ascendente: el punto de las 05:00 queda primero.
    expect(points[0]!.timestamp.toISOString()).toBe("2024-01-15T05:00:00.000Z");
  });

  it("lanza error cuando la respuesta trae state:false", async () => {
    fetchMock.mockResolvedValueOnce(okJson([], false, "token vencido"));
    const provider = makeProvider();
    await expect(
      provider.getHistoryLocations("tok", {
        beginGmt: new Date("2024-01-15T00:00:00Z"),
        endGmt: new Date("2024-01-16T00:00:00Z"),
      }),
    ).rejects.toThrow(/token vencido/);
  });
});

describe("fetchJson error handling", () => {
  it("lanza inmediatamente en errores no reintentables", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(400, "Bad Request", "parametro malo"));
    const provider = makeProvider();
    await expect(provider.login()).rejects.toThrow(/Umbrella API error: 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ingestEvidenceForTrip", () => {
  const baseInput = {
    tripId: "trip-1",
    imeis: ["111", "222"],
    windowStart: new Date("2024-01-15T05:30:00Z"),
    windowEnd: new Date("2024-01-15T07:15:00Z"),
  };

  it("guarda puntos y marca disponible cuando resuelve unidad", async () => {
    fetchMock
      .mockResolvedValueOnce(okJson("tok")) // login
      .mockResolvedValueOnce(
        okJson([
          {
            sn_imei_id: "111",
            gps_info: { latitude: 31.7, longitude: -106.4, l_datetime: "2024-01-15T06:30:00Z" },
          },
        ]),
      );
    const savePoints = vi.fn().mockResolvedValue(undefined);
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const provider = makeProvider();

    const result = await ingestEvidenceForTrip(provider, {
      ...baseInput,
      imeis: ["111"],
      resolveUnit: async () => ({ unitId: "u-1", deviceId: "d-1" }),
      savePoints,
      updateStatus,
    });

    expect(result).toEqual({ pointCount: 1, status: "disponible" });
    expect(savePoints).toHaveBeenCalledOnce();
    expect(updateStatus).toHaveBeenCalledWith("disponible");
  });

  it("marca parcial cuando no puede resolver la unidad", async () => {
    fetchMock
      .mockResolvedValueOnce(okJson("tok"))
      .mockResolvedValueOnce(
        okJson([
          {
            sn_imei_id: "111",
            gps_info: { latitude: 31.7, longitude: -106.4, l_datetime: "2024-01-15T06:30:00Z" },
          },
        ]),
      );
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const provider = makeProvider();

    const result = await ingestEvidenceForTrip(provider, {
      ...baseInput,
      imeis: ["111"],
      resolveUnit: async () => null,
      savePoints: vi.fn().mockResolvedValue(undefined),
      updateStatus,
    });

    expect(result.status).toBe("parcial");
    expect(updateStatus).toHaveBeenCalledWith("parcial");
  });

  it("marca indisponible cuando no hay puntos", async () => {
    fetchMock.mockResolvedValueOnce(okJson("tok")).mockResolvedValueOnce(okJson([]));
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const savePoints = vi.fn().mockResolvedValue(undefined);
    const provider = makeProvider();

    const result = await ingestEvidenceForTrip(provider, {
      ...baseInput,
      imeis: ["111"],
      resolveUnit: async () => ({ unitId: "u-1", deviceId: "d-1" }),
      savePoints,
      updateStatus,
    });

    expect(result).toEqual({ pointCount: 0, status: "indisponible" });
    expect(savePoints).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalledWith("indisponible");
  });

  it("marca indisponible cuando la API falla", async () => {
    fetchMock
      .mockResolvedValueOnce(okJson("tok"))
      .mockResolvedValueOnce(errorResponse(400, "Bad Request"));
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const provider = makeProvider();

    const result = await ingestEvidenceForTrip(provider, {
      ...baseInput,
      imeis: ["111"],
      resolveUnit: async () => null,
      savePoints: vi.fn().mockResolvedValue(undefined),
      updateStatus,
    });

    expect(result.status).toBe("indisponible");
    expect(updateStatus).toHaveBeenCalledWith("indisponible");
  });
});
