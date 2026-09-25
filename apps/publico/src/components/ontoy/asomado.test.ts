import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * **EL MARCO SIN CABECERA** (ASAV, 25-sep): Ontoy asomado en lugar de la barra
 * de arriba, y la campana convertida en la puerta de avisos de Inicio.
 *
 * No monta la pantalla —esta app no tiene `@testing-library`—: cerca las
 * decisiones que se deshacen solas. Que se vea bien **se mira**.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const leer = (...p: string[]) => readFileSync(path.join(AQUI, ...p), "utf8");
const asomado = leer("asomado.tsx");
const raiz = leer("ontoy.tsx");
const inicio = leer("vista-inicio.tsx");
const css = leer("..", "..", "app", "ontoy.css");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("Ontoy asomado: uno por pantalla", () => {
  it("se esconde por CSS en cuanto la pantalla tiene su propio Ontoy", () => {
    /* Lo decide `:has`, no cada pantalla: una pantalla nueva con su Ontoy lo esconde sola. */
    expect(css).toMatch(/\.ontoy:has\(\.ontoy-muneco\) \.ontoy-asomado\s*\{[^}]*visibility: hidden/);
  });

  it("no lleva la clase del muñeco — si la llevara, se escondería a sí mismo", () => {
    expect(sinComentarios(asomado)).not.toContain("ontoy-muneco");
  });

  it("no sale sobre el Mapa, y tocarlo lleva a Inicio", () => {
    expect(sinComentarios(raiz)).toContain('lugar !== "mapa" && <Asomado alTocar={() => irA("inicio")} />');
  });
});

describe("sin cabecera, sin perder nada de lo que tenía", () => {
  it("la cabecera vieja se fue: ni logo, ni campana, ni piel arriba", () => {
    const codigo = sinComentarios(raiz);
    expect(codigo).not.toContain("ontoy-cabeza\"");
    expect(codigo).not.toContain("LogoOntoy");
    expect(codigo).not.toContain("<Campana");
  });

  it("los avisos siguen teniendo puerta: la tarjeta de Inicio abre la lista", () => {
    expect(sinComentarios(raiz)).toContain("alVerAvisos={abrirCampana}");
    expect(sinComentarios(inicio)).toContain("<PuertaDeAvisos avisos={avisos} nuevos={avisosNuevos} alAbrir={alVerAvisos} />");
  });

  it("la piel sigue teniendo interruptor: el renglón al pie de Inicio", () => {
    expect(sinComentarios(raiz)).toContain("alAlternarPiel={alternarPiel}");
    expect(sinComentarios(inicio)).toContain("<RenglonDePiel deNoche={pielDeNoche} alAlternar={alAlternarPiel} />");
  });

  it("volver a Inicio cierra «Tus paradas»: siempre a la pantalla de entrada", () => {
    const irA = raiz.slice(raiz.indexOf("const irA = useCallback"), raiz.indexOf("}, []);", raiz.indexOf("const irA = useCallback")));
    expect(irA).toContain("setVerTusParadas(false)");
  });
});
