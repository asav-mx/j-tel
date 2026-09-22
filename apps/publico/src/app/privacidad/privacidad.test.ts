import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fondoDelMapa } from "@/lib/ontoy/mapa-base";

/*
 * La página de privacidad y la declaración para las tiendas, cercadas contra el
 * CÓDIGO. La regla de la Parte B: si el texto y el código no coinciden, gana el
 * código y se corrige el texto. Esta valla se cae cuando el código cambia y el
 * texto se queda atrás — que es justo el momento en que una declaración se
 * vuelve falsa sin que nadie la toque.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(AQUI, "../../../../..");
const leer = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const PAGINA = "apps/publico/src/app/privacidad/page.tsx";
const DECLARACION = "docs/Ontoy-Declaracion-De-Datos.md";

describe("la página de privacidad dice lo que el código hace", () => {
  const pagina = sinComentarios(leer(PAGINA));

  it("no jura el dónde (la regla de los textos de privacidad)", () => {
    expect(pagina).not.toContain("ningún servidor");
    expect(pagina).not.toMatch(/s[oó]lo en este tel[eé]fono/);
  });

  it("el tercero del mapa sale de fondoDelMapa(), no de un texto horneado", () => {
    expect(pagina).toContain("fondoDelMapa()");
    expect(pagina).toContain("mapa.hayTercero");
  });

  it("el contador: dice que la IP y el navegador no se guardan, y que subcuenta", () => {
    expect(pagina).toContain("La dirección IP y el tipo de navegador no se guardan.");
    expect(pagina).toContain("El número real de personas es mayor que el que");
  });

  it("el contacto y el nombre vienen de configuración", () => {
    expect(pagina).toContain("process.env.NEXT_PUBLIC_CONTACTO_PRIVACIDAD");
    expect(pagina).toContain("process.env.NEXT_PUBLIC_APP_NOMBRE");
  });

  it("la app liga a la página (toda pantalla tiene su salida, y la tienda pide que se encuentre)", () => {
    // Inicio es donde abre la app; la lista de rutas, a un toque del Mapa.
    expect(leer("apps/publico/src/components/ontoy/vista-inicio.tsx")).toContain('href="/privacidad"');
    expect(leer("apps/publico/src/components/ontoy/vista-rutas.tsx")).toContain('href="/privacidad"');
  });
});

describe("la declaración para las tiendas sigue al código", () => {
  const declaracion = leer(DECLARACION);

  it("mientras el mapa tenga un tercero, la declaración lo nombra; cuando deje de tenerlo, esto se cae", () => {
    const mapa = fondoDelMapa();
    if (mapa.hayTercero) {
      expect(declaracion).toContain(mapa.tercero!);
    } else {
      // Protomaps: el tercero desapareció del código y la declaración se tiene que revisar.
      expect(declaracion, "revisar las filas del tercero del mapa en la declaración").not.toContain(
        "Ubicación aproximada → compartida",
      );
    }
  });

  it("la ubicación se declara como no recopilada, y el código no la manda: la única petición POST es la apertura, vacía", () => {
    expect(declaracion).toContain("**No recopilada**");
    const apertura = leer("apps/publico/src/lib/ontoy/apertura.ts");
    expect(apertura).toMatch(/method: "POST"/);
    expect(apertura).not.toMatch(/body:/);
    expect(leer("apps/publico/src/lib/ubicacion.ts")).not.toMatch(/fetch\(/);
  });

  it("la lista de paradas de la ciudad está declarada, y su petición no lleva nada del pasajero", () => {
    expect(declaracion).toContain("GET /api/paradas");
    expect(sinComentarios(leer(PAGINA))).toContain("sin ningún dato tuyo");
    // La única petición a /api/paradas es un fetch sin nada más que la dirección.
    const inicio = leer("apps/publico/src/components/ontoy/vista-inicio.tsx");
    expect(inicio).toMatch(/fetch\("\/api\/paradas"\)/);
    expect(leer("apps/publico/src/lib/ontoy/paradas-cerca.ts")).not.toMatch(/fetch\(/);
  });

  it("la ubicación no se pide al abrir: Ontoy la lee con pedirAlAbrir en false (decisión del 22-sep)", () => {
    expect(leer("apps/publico/src/components/ontoy/ontoy.tsx")).toContain("useUbicacion({ pedirAlAbrir: false })");
    expect(leer("apps/publico/src/components/ontoy/ontoy.tsx")).not.toContain("useMiUbicacion");
    expect(leer("apps/publico/src/components/ontoy/atajo-de-parada.tsx")).not.toMatch(/useMiUbicacion|useUbicacion/);
    expect(sinComentarios(leer(PAGINA))).toContain("La app no te pide tu ubicación al abrir.");
  });
});

describe("el hueco de los íconos", () => {
  it("cada ícono que piden el manifiesto y el layout existe, con su nombre fijo", () => {
    const fuentes = leer("apps/publico/src/app/manifest.ts") + leer("apps/publico/src/app/layout.tsx");
    const rutas = [...fuentes.matchAll(/"(\/(?:iconos\/)?icono[^"]*\.(?:svg|png)|\/iconos\/apple-touch-icon\.png)"/g)].map((m) => m[1]!);
    expect(rutas.length).toBeGreaterThanOrEqual(5);
    for (const r of rutas) expect(existsSync(path.join(REPO, "apps/publico/public", r)), r).toBe(true);
  });
});
