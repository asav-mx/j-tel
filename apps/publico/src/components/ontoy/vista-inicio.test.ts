import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * **INICIO Y SUS ESTADOS.**
 *
 * ## Qué NO prueba, y hay que leerlo antes que el verde
 *
 * **No monta la pantalla.** Esta app no tiene `@testing-library` y meterlo por
 * una pantalla sería traer un aparato entero para una prueba. Lo que se cerca
 * aquí son **las decisiones que se deshacen solas** al escribir la siguiente
 * pantalla, leídas del código.
 *
 * Lo que se ve —que la tarjeta quepa, que el dormido se lea— **se mira**. La
 * revisión visual sigue siendo la verificación de un PR de piel.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const vista = readFileSync(path.join(AQUI, "vista-inicio.tsx"), "utf8");
const muneco = readFileSync(path.join(AQUI, "ontoy-muneco.tsx"), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("un Ontoy por pantalla, y sólo si dice algo", () => {
  /*
   * La regla 1 del estándar. Se rompe sin querer: cada estado nuevo trae la
   * tentación de su propio muñeco, y dos en pantalla es uno de los dos sobrando.
   */
  it("los estados de Inicio se excluyen entre sí", () => {
    const codigo = sinComentarios(vista);
    /* Sin red y de noche nunca salen juntos, y ninguno sale en la primera vez. */
    expect(codigo).toContain("sinRed && !primeraVez");
    expect(codigo).toContain("deNoche && !primeraVez && !sinRed");
    /* Y la invitación de texto tampoco se suma a la bienvenida. */
    expect(codigo).toContain("!primeraVez &&\n        puedeGuardar");
  });

  it("la bienvenida se va en cuanto el pasajero conteste cualquiera de las dos", () => {
    /*
     * «Primera vez» es no haber preguntado la ubicación **y** no tener
     * guardadas. Con una sola de las dos, quien dijo que no a la ubicación pero
     * guardó su parada volvería a recibir la bienvenida — o sea, no lo
     * escuchamos.
     */
    expect(sinComentarios(vista)).toContain(
      'ubicacion.estado === "sin-pedir" && guardadas.length === 0',
    );
  });
});

describe("lo que el encabezado NO dice", () => {
  it("no pone una sola edad arriba de varias tarjetas", () => {
    /*
     * El diseño escribe «Posiciones de hace 10 s» bajo el título. Con dos
     * paradas guardadas de dos rutas distintas hay **dos** edades, y una sola
     * arriba de las dos es el §D del Marco: el dato correcto de una,
     * presentado como el de ambas. La edad vive en cada tarjeta, que es donde
     * se puede comprobar.
     */
    expect(sinComentarios(vista)).not.toMatch(/Posiciones de hace|antiguedad/i);
  });
});

describe("los estados se suman, no reemplazan", () => {
  it("sin red y de noche NO se llevan las rutas de abajo", () => {
    /*
     * Lo de abajo sigue valiendo: la promesa publicada no depende de la red
     * (8.2), y a las 2 de la mañana el horario es justamente lo que alguien
     * viene a mirar. Taparlo con una pantalla de error le quita media app al
     * pasajero por una consulta caída.
     *
     * Se comprueba que `RutasDeInicio` se dibuje **fuera** de cualquier rama de
     * estado: su renglón no está dentro de ningún `sinRed ?` ni `deNoche ?`.
     */
    const codigo = sinComentarios(vista);
    const i = codigo.indexOf("<RutasDeInicio");
    expect(i).toBeGreaterThan(0);
    /* Entre el último cierre de los estados y las rutas no queda una rama abierta. */
    const antes = codigo.slice(0, i);
    const ternarios = (antes.match(/sinRed \?|deNoche \?/g) ?? []).length;
    expect(ternarios, "los estados van como bloques sueltos, no como ternarios que envuelvan").toBe(0);
  });
});

describe("sin red, y de dónde puede venir", () => {
  it("queda escrito que sólo se enciende con guardadas", () => {
    /*
     * Medido en el navegador: con un teléfono recién abierto **el estado no
     * sale**, y no es un defecto — sin guardadas ni ruta abierta la app no
     * sondea, así que no hay petición que se pueda caer.
     *
     * Esta prueba cuida el comentario y no el código, a propósito: lo que se
     * rompe aquí no es una función, es que alguien vea que «no sale nunca» y lo
     * encienda por otra vía. Encenderlo sin dato vivo sería decir «te enseño lo
     * último que supe» sobre algo que nunca supimos.
     */
    expect(vista).toMatch(/sólo puede ser cierto si hay paradas guardadas/);
  });
});

describe("las poses de Ontoy", () => {
  it("«al frente» va sin boca: es la versión original", () => {
    /*
     * Handoff §1: todos los personajes nacen sin boca; la boca sólo aparece en
     * las reacciones. Si alguien le pone una sonrisa al de la bienvenida, deja
     * de ser Ontoy y pasa a ser una reacción a un dato que no existe.
     */
    const bloque = muneco.slice(muneco.indexOf("pose === \"contento\""));
    expect(bloque).toContain("al-frente` va SIN boca");
  });

  it("el dormido lleva sus «z»", () => {
    /* Es lo que distingue «duerme» de «parpadeó». La regla del skill los pide juntos. */
    const bloque = muneco.slice(muneco.indexOf('pose === "dormido"'), muneco.indexOf("Los ojos blancos"));
    expect(bloque).toContain("ontoy-muneco-z");
  });

  it("las poses que NO vienen del handoff están declaradas, TODAS", () => {
    /*
     * `sin-red`, `dormido`, `triste` y `al-otro-lado` se armaron aquí con las reglas escritas
     * del skill, no copiadas de un dibujo. Es la única parte de la pieza que no
     * está copiada, y quien la revise tiene que saberlo sin preguntar.
     *
     * **Esta prueba ya cobró una vez**, y por eso se escribe así: al agregar
     * `triste` en el PR de «Ir a», la declaración se quedó nombrando dos poses
     * cuando ya eran tres, y la prueba se cayó. La lista de abajo se compara
     * **contra la declaración**, así que una pose nueva sin declarar la tumba
     * — que es justo lo que tiene que pasar.
     */
    const declaradas = muneco.match(
      /\*\*((?:`[a-z-]+`(?:, | y )?)+) no venían dibujados/,
    );
    expect(declaradas, "falta la frase que declara las poses no copiadas").not.toBeNull();
    const nombradas = [...declaradas![1].matchAll(/`([a-z-]+)`/g)].map((m) => m[1]).sort();
    expect(nombradas).toEqual(["al-otro-lado", "dormido", "sin-red", "triste"]);
  });
});
