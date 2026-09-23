import { describe, expect, it } from "vitest";
import config, { DOMINIOS_VIEJOS, SITIO } from "../../next.config";

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

  /* 308: el navegador lo recuerda y deja de pedirle al dominio viejo. */
  it("es permanente, porque es una mudanza y no volvemos", async () => {
    const redirecciones = await config.redirects!();
    for (const r of redirecciones) expect(r.permanent).toBe(true);
  });

  it("el destino es Ontoy, no el nombre de un transportista", () => {
    expect(SITIO).toBe("https://ontoy.app");
    expect(SITIO).not.toMatch(/juarez|bus/i);
  });
});
