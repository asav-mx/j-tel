import { describe, expect, it } from "vitest";
import config, { DOMINIOS_VIEJOS, REDIRECCION_PERMANENTE, SITIO } from "../../next.config";

/**
 * La mudanza a `ontoy.app`, vigilada donde de verdad vive: en la configuración
 * que se despliega.
 *
 * Esto no prueba que el DNS apunte a algún lado —eso se comprueba con `dig`, y
 * el procedimiento dice cómo—. Prueba lo único que el repo puede sostener: que
 * el dominio viejo **redirige y no se apaga**, que conserva la ruta, y que
 * nadie horneó el nombre de un transportista como destino.
 */
describe("el dominio viejo redirige, no se apaga", () => {
  it("los dos nombres del dominio viejo tienen su redirección", async () => {
    const redirecciones = await config.redirects!();
    const hosts = redirecciones.map((r) => r.has?.[0]?.value);
    expect(hosts.sort()).toEqual([...DOMINIOS_VIEJOS].sort());
    expect(redirecciones).toHaveLength(2);
  });

  /*
   * Un letrero impreso o un QR pegado en un poste apunta a una ruta, no a la
   * portada. Mandar todo a `/` convertiría cada letrero viejo en «busca tu
   * ruta otra vez».
   */
  it("conserva la ruta, no manda todo a la portada", async () => {
    const redirecciones = await config.redirects!();
    for (const r of redirecciones) {
      expect(r.source).toBe("/:ruta*");
      expect(r.destination).toBe(`${SITIO}/:ruta*`);
    }
  });

  /*
   * La primera semana va TEMPORAL (decisión de ASAV, 23-sep-2026). Un 307 se
   * deshace revirtiendo el despliegue; un 308 ya no: el teléfono que lo vio
   * deja de preguntarle al dominio viejo, y revertir no lo despega.
   *
   * Esta prueba NO fija el valor: fija que el valor de la redirección sea el
   * de la constante, para que pasar a permanente sea de verdad una línea y no
   * haya que buscar dónde más estaba escrito el 308.
   */
  it("la redirección usa la constante, para que el cambio a permanente sea una línea", async () => {
    const redirecciones = await config.redirects!();
    for (const r of redirecciones) expect(r.permanent).toBe(REDIRECCION_PERMANENTE);
  });

  it("hoy es temporal: la mudanza todavía no se prueba en teléfonos reales", () => {
    expect(REDIRECCION_PERMANENTE).toBe(false);
  });

  it("el destino es Ontoy, no el nombre de un transportista", () => {
    expect(SITIO).toBe("https://ontoy.app");
    expect(SITIO).not.toMatch(/juarez|bus/i);
  });
});
