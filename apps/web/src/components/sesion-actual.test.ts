import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * El distintivo de identidad cuelga del layout raíz, así que se renderiza en
 * TODAS las pantallas y consulta la base en cada una. Estas pruebas custodian
 * una sola regla: **un adorno no puede tumbar lo que lo hospeda.**
 *
 * Lo que se perdía sin resguardo no era el distintivo — era `/`, que está
 * escrita justo para atrapar el fallo de base y explicar cómo conectar Neon.
 * El diagnóstico desaparecía exactamente cuando más sirve, y quedaba una
 * pantalla en blanco. Importa el doble mientras estamos conectando Clerk: si
 * algo sale mal en esa configuración, la app tiene que seguir contando qué
 * pasa.
 *
 * Comprobado que estas pruebas sirven: quitando el try/catch de
 * `SesionActual`, las tres del primer bloque fallan y la cuarta sigue verde.
 * Esa cuarta es el control — si también fallara, no sabríamos si las otras
 * pasan porque el resguardo funciona o porque el distintivo nunca se pinta.
 */

const MENSAJE_BASE_CAIDA =
  "DATABASE_URL no configurada. Conecta Neon en Vercel → Storage, o define DATABASE_URL en Environment Variables.";

const getIdentidad = vi.fn();
const headers = vi.fn();

vi.mock("@/lib/auth", () => ({
  getIdentidad: () => getIdentidad(),
}));

vi.mock("next/headers", () => ({
  headers: () => headers(),
}));

/*
 * `next/link` es componente de cliente y exige contexto de router: fuera de
 * Next lanza, y el resguardo lo tragaría — dejando la prueba positiva en verde
 * por la razón equivocada. Se sustituye por un ancla para que lo que se mida
 * sea este componente y no el enrutador.
 */
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    createElement("a", { href }, children),
}));

/** Un `headers()` que contesta como el de Next para la ruta dada. */
function encabezadosDe(ruta: string) {
  return Promise.resolve({ get: (k: string) => (k === "x-jtel-path" ? ruta : null) });
}

const { SesionActual } = await import("./sesion-actual");

beforeEach(() => {
  getIdentidad.mockReset();
  headers.mockReset();
  headers.mockImplementation(() => encabezadosDe("/cliente/cumplimiento"));
});

describe("con la base caída, la pantalla sobrevive y solo falta el distintivo", () => {
  it("no propaga el fallo: devuelve nada en vez de lanzar", async () => {
    getIdentidad.mockRejectedValue(new Error(MENSAJE_BASE_CAIDA));

    await expect(SesionActual()).resolves.toBeNull();
  });

  it("lo que lo hospeda se sigue pintando entero", async () => {
    getIdentidad.mockRejectedValue(new Error(MENSAJE_BASE_CAIDA));

    // El anfitrión: una pantalla cualquiera con el distintivo colgado al final,
    // igual que el layout raíz.
    const pantalla = createElement(
      "main",
      null,
      createElement("h1", null, "Base de datos pendiente"),
      createElement("p", null, MENSAJE_BASE_CAIDA),
      await SesionActual(),
    );

    const html = renderToStaticMarkup(pantalla);

    expect(html).toContain("Base de datos pendiente");
    expect(html).toContain("Conecta Neon en Vercel");
    // Y del distintivo, ni rastro.
    expect(html).not.toContain("quien-soy");
  });

  it("tampoco lo tumba un fallo al leer los encabezados", async () => {
    headers.mockImplementation(() => {
      throw new Error("headers() fuera de contexto de petición");
    });

    await expect(SesionActual()).resolves.toBeNull();
  });
});

describe("cuando todo funciona, el distintivo sí se pinta", () => {
  it("muestra identificador y origen", async () => {
    getIdentidad.mockResolvedValue({
      userId: "tecma_admin",
      origen: "default-heredado",
      memberships: [{ accountId: "a", clerkUserId: "tecma_admin", role: "admin", scopeType: "account" }],
      clerkConfigurado: false,
      sesionActiva: false,
      encabezadoRechazado: false,
    });

    const html = renderToStaticMarkup(
      createElement("main", null, await SesionActual()),
    );

    expect(html).toContain("tecma_admin");
    expect(html).toContain("por defecto");
    expect(html).toContain("quien-soy");
  });
});
