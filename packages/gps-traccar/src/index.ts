import type {
  GpsProvider,
  GpsCredentials,
  HistoryLocationQuery,
  DeviceInfo,
  GpsProviderConfig,
} from "@jtel/gps-core";
import type { GpsPoint } from "@jtel/domain";

/**
 * Proveedor GPS contra un servidor **Traccar** propio — el camino de Compás.
 *
 * ## Por qué existe
 *
 * Umbrella cortó la transmisión el 5 de septiembre de 2026 y es definitivo.
 * Los equipos Teltonika hablan directo contra un Traccar nuestro, y este
 * archivo es todo el puente que hace falta del lado del repo: el recolector y
 * el archivador ya pasan los dos por `buildProvider`, así que registrar el caso
 * los alimenta a ambos sin tocar ninguno.
 *
 * ## Lo que este archivo NO hace, y es a propósito
 *
 * **No resuelve aparato → unidad.** Devuelve puntos con su IMEI y su hora, que
 * es lo que el contrato pide. La resolución vive en el archivador
 * (`resolveUnitAtTime(deviceId, timestamp)`) y usa la asignación vigente **al
 * instante observado**, que es la ley de la Pieza 1: cambiar de aparato no
 * reescribe el historial. Duplicarla aquí sería abrir una segunda verdad.
 *
 * **No decide qué unidades se sondean.** El recolector ya trae la lista de
 * IMEI del carrier y la pasa; este archivo sólo filtra por ella.
 *
 * ══════════════════════════════════════════════════════════════════════
 * Las tres diferencias con Umbrella que se pagan si se ignoran
 * ══════════════════════════════════════════════════════════════════════
 *
 * **1 · La velocidad de Traccar viene en NUDOS.** Está en su OpenAPI, en la
 * propiedad `speed` de `Position`: «in knots». Umbrella la manda en km/h y el
 * proveedor viejo la pasa tal cual. Pasar la de Traccar tal cual metería dos
 * unidades distintas en la misma columna, con el mismo nombre y sin que nada
 * truene — §D del Marco en su eje de la UNIDAD, dentro de la base.
 *
 * Hoy **nadie lee `speed`**: se escribe en `telemetry_points` y en
 * `live_positions` y ningún consumidor del dominio, de la verificación ni de la
 * app pública lo toca. O sea el daño de equivocarse es cero hoy y silencioso
 * después, que es la peor combinación. Se convierte aquí y se declara la unidad
 * en `GpsPoint`.
 *
 * **2 · El `deviceId` de Traccar NO es el IMEI.** Es un entero propio de su
 * base. El IMEI vive en `uniqueId` del `Device`. Una posición trae `deviceId`,
 * así que hay que cruzarla contra el catálogo de aparatos para saber de quién
 * habla. Confundirlos escribiría un `imei` que es un contador de otra base, y
 * el índice único de `telemetry_points` va sobre (imei, recorded_at).
 *
 * **3 · Traccar marca las posiciones inválidas y hay que tirarlas.** `valid` es
 * `false` cuando el equipo reportó sin fijar satélites. La posición que trae
 * entonces no es «dónde está»: es la última que tenía o un cero. Guardarla
 * sería dibujar lo que el sistema no midió, que es §E. Se descartan y se
 * cuentan aparte.
 *
 * ══════════════════════════════════════════════════════════════════════
 * Por qué `login` pide sesión aunque Traccar no dé token
 * ══════════════════════════════════════════════════════════════════════
 *
 * Traccar autentica por básica, por cookie de sesión o por token de cuenta —
 * las tres van en cada petición, así que no hay un intercambio previo que
 * hacer. Lo fácil sería que `login` armara la cabecera y devolviera sin hablar
 * con nadie.
 *
 * No se hizo, y la razón es lo que acaba de pasar: **una credencial revocada
 * tiene que fallar RUIDOSA.** Si `login` no comprueba nada, una credencial
 * mala no truena — devuelve listas vacías, el archivador escribe cero puntos
 * sin error, y la ingesta se detiene en silencio. El corte de Umbrella se supo
 * al minuto porque su `login` sí falla y deja `No se obtuvo token` en
 * `ingest_alerts`; sin eso habría sido una tabla que dejó de crecer.
 *
 * Así que `login` llama al servidor y revienta si la credencial no sirve. Cuesta
 * una petición por corrida y compra que el próximo corte se vea el mismo día.
 *
 * **Con qué ruta lo comprueba es lo que costó un defecto** — ver
 * `RUTA_DE_COMPROBACION` abajo, que trae la medición contra el servidor real.
 */

/** `Position` de la API de Traccar. Sólo los campos que se usan. */
interface TraccarPosition {
  deviceId?: number;
  /** Cuándo el equipo tomó el fix. Es el que vale. */
  fixTime?: string;
  /** Cuándo el equipo mandó el mensaje. Respaldo si no viene `fixTime`. */
  deviceTime?: string;
  /** Cuándo lo recibió el servidor. **Nunca se usa como hora del punto.** */
  serverTime?: string;
  valid?: boolean;
  latitude?: number;
  longitude?: number;
  /** ⚠ En NUDOS. Ver el encabezado. */
  speed?: number;
  /** Rumbo en grados, 0 = norte. Traccar lo llama `course`. */
  course?: number;
}

/** `Device` de la API de Traccar. Sólo los campos que se usan. */
interface TraccarDevice {
  id?: number;
  name?: string;
  /** El IMEI. Traccar lo llama `uniqueId` porque admite otros identificadores. */
  uniqueId?: string;
  lastUpdate?: string | null;
}

/**
 * Con qué ruta se comprueba que la credencial sirve.
 *
 * ## Era `/api/session`, y estaba mal — medido contra un Traccar real
 *
 * El 11 de septiembre de 2026, contra el servidor recién levantado (Traccar
 * 6.15, Ubuntu 24.04), las tres formas de autorización dieron esto:
 *
 * | | `/api/session` | `/api/devices` | `/api/positions` |
 * |---|---|---|---|
 * | `Authorization: Bearer` | **404** | 200 | 200 |
 * | `Authorization: Basic`  | **404** | 200 | 200 |
 * | `?token=` en la URL     | 200 | — | — |
 *
 * `GET /api/session` **no pregunta «¿esta credencial sirve?»**: devuelve la
 * sesión de la COOKIE, y contesta 404 cuando no hay ninguna. Que acepte
 * `?token=` es otra cosa — ahí crea la sesión desde el token, y eso obliga a
 * meter el secreto en la URL, donde termina en los registros de cualquier proxy
 * que haya en medio.
 *
 * O sea el `login()` viejo **no podía entrar nunca**, ni con credencial buena.
 * Y su prueba pasaba en verde: el servidor falso contestaba 200 a esa ruta
 * porque yo la escribí contestando 200. **Ninguna prueba contra una respuesta
 * que uno mismo inventa puede encontrar esto.** Lo encontró el fierro.
 *
 * ## Por qué `/api/devices` y no otra
 *
 * Acepta las dos formas de cabecera, contesta 401 con credencial mala —o sea el
 * fallo sigue siendo ruidoso, que es la razón de que `login()` hable con el
 * servidor— y **ya está en la lista de rutas que el proxy del paso 8 deja
 * pasar.** Comprobar contra una cuarta ruta obligaría a abrir una cuarta puerta.
 *
 * Una lista vacía es una respuesta válida: lo que se comprueba es que autorizó,
 * no que haya aparatos.
 */
const RUTA_DE_COMPROBACION = "/api/devices";

/** Un nudo son 1.852 km/h, exacto por definición. */
const KMH_POR_NUDO = 1.852;

export function kmhDesdeNudos(nudos: number): number {
  return nudos * KMH_POR_NUDO;
}

export class TraccarGpsProvider implements GpsProvider {
  readonly name = "traccar";

  private baseUrl: string;
  private fetchImpl: typeof fetch;

  /**
   * Catálogo de aparatos cacheado por corrida, para no pedir `/api/devices` en
   * cada llamada. Corto a propósito: un aparato dado de alta a media jornada
   * tiene que aparecer sin reiniciar nada.
   */
  private catalogo: { alExpirar: number; porId: Map<number, string> } | null = null;

  constructor(
    private config: GpsProviderConfig,
    opciones: { fetchImpl?: typeof fetch; catalogoTtlMs?: number } = {},
  ) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opciones.fetchImpl ?? fetch;
    this.catalogoTtlMs = opciones.catalogoTtlMs ?? 60_000;
  }

  private catalogoTtlMs: number;

  /**
   * La cabecera de autorización.
   *
   * Traccar acepta un **token de cuenta** como usuario con contraseña vacía, y
   * también usuario y contraseña. Se resuelve por la forma de la credencial y
   * no por una perilla nueva: un secreto sin usuario es un token.
   */
  private cabecera(creds: GpsCredentials): string {
    const usuario = creds.userId ?? "";
    const secreto = creds.password ?? "";
    if (!usuario && secreto) return `Bearer ${secreto}`;
    const par = Buffer.from(`${usuario}:${secreto}`, "utf8").toString("base64");
    return `Basic ${par}`;
  }

  private async pedir<T>(ruta: string, creds: GpsCredentials): Promise<T> {
    const respuesta = await this.fetchImpl(`${this.baseUrl}${ruta}`, {
      headers: {
        Authorization: this.cabecera(creds),
        Accept: "application/json",
      },
    });

    if (!respuesta.ok) {
      /*
       * El cuerpo de un error de Traccar trae la causa en texto plano y es lo
       * único diagnóstico que hay. Se recorta porque termina en `ingest_alerts`
       * y de ahí a una pantalla — la lección del #361: la causa al frente, y el
       * resumen acotado.
       */
      let detalle = "";
      try {
        detalle = (await respuesta.text()).trim().slice(0, 200);
      } catch {
        /* un error sin cuerpo legible sigue siendo un error */
      }
      throw new Error(
        `Traccar ${respuesta.status} en ${ruta}${detalle ? `: ${detalle}` : ""}`,
      );
    }

    return (await respuesta.json()) as T;
  }

  /**
   * Comprueba la credencial contra `/api/session` y devuelve la cabecera ya
   * armada, que es lo que las demás llamadas necesitan.
   *
   * Devuelve la cabecera y no un token porque Traccar no emite uno: el
   * contrato de `GpsProvider` pide una cadena que las otras llamadas puedan
   * usar, y aquí esa cadena **es** la autorización. Ver el encabezado sobre por
   * qué esto habla con el servidor en vez de armar la cabecera y ya.
   */
  async login(credentials?: GpsCredentials): Promise<string> {
    const creds = credentials ?? this.config.credentials;
    try {
      /*
       * La respuesta de la comprobación **es el catálogo**, así que se guarda en
       * vez de tirarla: sin esto, cada corrida pediría `/api/devices` dos veces
       * —una para comprobar y otra para el cruce `deviceId` → IMEI— y serían
       * dos peticiones idénticas con segundos de diferencia.
       */
      const aparatos = await this.pedir<TraccarDevice[]>(RUTA_DE_COMPROBACION, creds);
      this.guardarCatalogo(aparatos, Date.now());
    } catch (err) {
      const causa = err instanceof Error ? err.message : String(err);
      throw new Error(`No se obtuvo sesión de Traccar: ${causa}`);
    }
    return this.cabecera(creds);
  }

  private guardarCatalogo(aparatos: unknown, ahora: number) {
    /*
     * `Array.isArray` y no `?? []`: si la respuesta no es una lista —un error
     * devuelto con 200, un proxy metiendo una página en medio— recorrerla
     * lanzaría un `TypeError` desde dentro del recolector, lejos de aquí y sin
     * decir qué contestó el servidor. Un catálogo vacío es una respuesta
     * manejable; una excepción de tipos no.
     */
    const lista: TraccarDevice[] = Array.isArray(aparatos) ? aparatos : [];
    const porId = new Map<number, string>();
    for (const d of lista) {
      if (typeof d?.id === "number" && d.uniqueId) porId.set(d.id, d.uniqueId);
    }
    this.catalogo = { alExpirar: ahora + this.catalogoTtlMs, porId };
  }

  /**
   * `login` devolvió la cabecera. Las demás llamadas la reciben como `token` y
   * la vuelven a partir en credenciales para reusar `pedir`. Es feo y es a
   * propósito: el contrato de `GpsProvider` es de Umbrella, donde el token sí
   * es un token, y cambiarlo movería al otro proveedor sin necesidad.
   */
  private credencialesDe(token: string): GpsCredentials {
    if (token.startsWith("Bearer ")) {
      return { userId: "", password: token.slice("Bearer ".length) };
    }
    if (token.startsWith("Basic ")) {
      const plano = Buffer.from(token.slice("Basic ".length), "base64").toString("utf8");
      const corte = plano.indexOf(":");
      return corte < 0
        ? { userId: plano, password: "" }
        : { userId: plano.slice(0, corte), password: plano.slice(corte + 1) };
    }
    return this.config.credentials;
  }

  async getDevices(token: string): Promise<DeviceInfo[]> {
    const creds = this.credencialesDe(token);
    const aparatos = await this.pedir<TraccarDevice[]>("/api/devices", creds);

    return (aparatos ?? [])
      .map((d) => ({
        imei: d.uniqueId ?? "",
        label: d.name,
        lastUpdate: d.lastUpdate ? new Date(d.lastUpdate) : undefined,
      }))
      .filter((d) => d.imei);
  }

  /** El cruce `deviceId` → IMEI, que es el punto 2 del encabezado. */
  private async porIdDeTraccar(token: string, ahora: number): Promise<Map<number, string>> {
    if (this.catalogo && this.catalogo.alExpirar > ahora) return this.catalogo.porId;

    const creds = this.credencialesDe(token);
    const aparatos = await this.pedir<TraccarDevice[]>("/api/devices", creds);
    this.guardarCatalogo(aparatos, ahora);
    return this.catalogo!.porId;
  }

  /**
   * Convierte una posición de Traccar a nuestro punto, o `null` si no se puede
   * afirmar dónde estaba el aparato.
   *
   * Los tres motivos para devolver `null`, y ninguno es un caso raro:
   *   · la posición viene marcada inválida por el propio equipo (§E),
   *   · no trae hora que sirva,
   *   · su `deviceId` no está en el catálogo, así que no se sabe de qué aparato
   *     habla y escribirla con un IMEI adivinado sería peor que perderla.
   */
  private aPunto(p: TraccarPosition, porId: Map<number, string>): GpsPoint | null {
    if (p.valid === false) return null;
    if (typeof p.latitude !== "number" || typeof p.longitude !== "number") return null;

    const cuando = p.fixTime ?? p.deviceTime;
    if (!cuando) return null;
    const timestamp = new Date(cuando);
    if (Number.isNaN(timestamp.getTime())) return null;

    const imei = typeof p.deviceId === "number" ? porId.get(p.deviceId) : undefined;
    if (!imei) return null;

    return {
      imei,
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp,
      speed: typeof p.speed === "number" ? kmhDesdeNudos(p.speed) : undefined,
      heading: typeof p.course === "number" ? p.course : undefined,
    };
  }

  /**
   * La última posición conocida de cada aparato.
   *
   * `/api/positions` sin parámetros devuelve exactamente eso: la última de cada
   * equipo del usuario. El filtro por IMEI es nuestro y va después, porque
   * Traccar filtra por su `deviceId` y nosotros hablamos IMEI.
   */
  async getLastLocations(token: string, imeis?: string[]): Promise<GpsPoint[]> {
    const porId = await this.porIdDeTraccar(token, Date.now());
    const creds = this.credencialesDe(token);
    const posiciones = await this.pedir<TraccarPosition[]>("/api/positions", creds);

    const queridos = imeis?.length ? new Set(imeis) : null;
    const puntos: GpsPoint[] = [];
    for (const p of posiciones ?? []) {
      const punto = this.aPunto(p, porId);
      if (!punto) continue;
      if (queridos && !queridos.has(punto.imei)) continue;
      puntos.push(punto);
    }
    return puntos;
  }

  /**
   * El histórico de una ventana, que es lo que el archivador pide.
   *
   * **Traccar exige `deviceId` para consultar histórico** —su propia
   * documentación lo dice: `deviceId` es opcional pero pide `from` y `to`, y
   * sin él la respuesta es la de últimas posiciones—. O sea no hay una llamada
   * que traiga la ventana de toda la flota: se pide aparato por aparato.
   *
   * Eso es N peticiones por corrida del archivador, con N = aparatos del
   * carrier. Con 82 unidades y el archivador cada 10 minutos son ~492
   * peticiones por hora contra un servidor propio, que es carga trivial para
   * él. **Contra un Traccar administrado por un tercero podría no serlo**, y
   * ahí habría que medirlo antes de suponer.
   */
  async getHistoryLocations(token: string, query: HistoryLocationQuery): Promise<GpsPoint[]> {
    const porId = await this.porIdDeTraccar(token, Date.now());
    const creds = this.credencialesDe(token);

    const queridos = query.imeis?.length ? new Set(query.imeis) : null;
    const desde = encodeURIComponent(query.beginGmt.toISOString());
    const hasta = encodeURIComponent(query.endGmt.toISOString());

    const todos: GpsPoint[] = [];
    for (const [idDeTraccar, imei] of porId) {
      if (queridos && !queridos.has(imei)) continue;

      const posiciones = await this.pedir<TraccarPosition[]>(
        `/api/positions?deviceId=${idDeTraccar}&from=${desde}&to=${hasta}`,
        creds,
      );
      for (const p of posiciones ?? []) {
        const punto = this.aPunto(p, porId);
        if (punto) todos.push(punto);
      }
    }

    /*
     * Ordenado por hora, como los devuelve Umbrella. El archivador calcula su
     * marca de agua con el máximo, así que el orden no lo gobierna — pero un
     * proveedor que devuelve desordenado y otro que no es una diferencia que
     * alguien va a descubrir tarde.
     */
    todos.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return todos;
  }
}

export function createTraccarProvider(config: GpsProviderConfig): TraccarGpsProvider {
  return new TraccarGpsProvider(config);
}
