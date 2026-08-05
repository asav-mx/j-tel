import { describe, it, expect } from "vitest";
import { destinoDeVuelta, rutaRelativaSegura } from "./destino-de-vuelta";

/**
 * El redirector abierto, medido.
 *
 * Estas pruebas son la mitad de la pieza 1.j que importa. La otra mitad —pasar
 * el destino a la puerta y usarlo al entrar— es plomería; ésta es la que decide
 * si un enlace que se ve nuestro puede aventar a una persona a un sitio ajeno
 * **justo después de que tecleó su contraseña**.
 *
 * La lista de abajo no salió de imaginar ataques: salió de correr cada cadena
 * contra el parser de Node **antes** de escribir el validador, y de descubrir
 * que la comprobación obvia —el origen no cambia— deja pasar `/..//evil.com`.
 * Cada caso trae al lado lo que el parser contesta, para que quien lea esto no
 * tenga que volver a medirlo.
 */

describe("lo que sí es un destino nuestro", () => {
  it.each([
    ["/cliente", "/cliente"],
    ["/cliente/servicio/abc", "/cliente/servicio/abc"],
    ["/carrier/flota/u-1", "/carrier/flota/u-1"],
    ["/jstaff/diagnostico", "/jstaff/diagnostico"],
    ["/quien-soy", "/quien-soy"],
    // La búsqueda se conserva: hay pantallas cuyo día viaja ahí.
    ["/cliente?account=tecma&fecha=2026-08-04", "/cliente?account=tecma&fecha=2026-08-04"],
    // El fragmento se cae, y da igual: no llega al servidor.
    ["/cliente/servicio/abc#evidencia", "/cliente/servicio/abc"],
    // El `..` que NO sale de casa se resuelve y sigue siendo nuestro.
    ["/cliente/planta/x/../y", "/cliente/planta/y"],
  ])("%s → %s", (entrada, esperado) => {
    expect(destinoDeVuelta(entrada)).toBe(esperado);
  });
});

/**
 * Cada uno de estos, devuelto tal cual, es un redirector abierto.
 *
 * El comentario dice qué contesta `new URL(caso, centinela)`, porque tres de
 * ellos **pasan la comprobación de origen** y hay que ver por qué no basta.
 */
describe("lo que se va de casa — todos devuelven null", () => {
  it.each([
    // Origen propio, evidente.
    ["https://evil.com", "origin: https://evil.com"],
    ["http://evil.com/x", "origin: http://evil.com"],
    // Protocol-relative. El clásico.
    ["//evil.com", "origin: https://evil.com"],
    ["///evil.com", "origin: https://evil.com"],
    // Barras invertidas: el parser las normaliza a barras normales.
    ["/\\evil.com", "origin: https://evil.com"],
    ["\\/evil.com", "origin: https://evil.com"],
    // Esquemas que no navegan a ningún lado bueno.
    ["javascript:alert(1)", "origin: null"],
    ["data:text/html,<h1>x", "origin: null"],

    /*
     * LOS TRES QUE PASAN LA COMPROBACIÓN DE ORIGEN.
     * Aquí es donde un validador razonable se rompe.
     */
    // El `..` se resuelve DURANTE el parseo: pathname queda "//evil.com", que
    // el navegador lee como protocol-relative. Origen: el centinela.
    ["/..//evil.com", "origin: centinela · pathname: //evil.com ⚠"],
    // Los espacios de adelante se recortan y queda protocol-relative.
    ["  //evil.com", "se recorta → //evil.com ⚠"],
    // El parser BORRA los caracteres de control sin avisar, así que lo validado
    // y lo devuelto serían cadenas distintas.
    ["/\tx//evil.com", "el tabulador desaparece ⚠"],
    ["/cliente\n//evil.com", "el salto de línea desaparece ⚠"],
  ])("%s — %s", (entrada) => {
    expect(destinoDeVuelta(entrada)).toBeNull();
    /*
     * Y contra la capa estructural SOLA. Esto es lo que hace que las pruebas
     * signifiquen algo: con las dos capas juntas, quitarle la comprobación de
     * origen no ponía nada en rojo —la lista blanca atajaba los mismos casos un
     * paso después— así que la batería no distinguía si la capa de forma
     * funcionaba. Aquí sí.
     */
    expect(rutaRelativaSegura(entrada)).toBeNull();
  });
});

describe("lo que no es una cara nuestra", () => {
  it.each([
    ["/entrar", "sería un bucle: la puerta mandando a la puerta"],
    ["/entrar?motivo=sin-sesion", "el bucle con motivo"],
    ["/", "volver a la portada no es volver a ningún lado"],
    ["/landing", "el landing es público; no hay a qué regresar"],
    ["/api/cliente/servicios", "una ruta de API no es una pantalla"],
    ["/cliente-falso", "parecido no es igual: la cara se compara entera"],
  ])("%s — %s", (entrada) => {
    expect(destinoDeVuelta(entrada)).toBeNull();
  });

  /*
   * Éstos son de la lista blanca y NO de la forma: estructuralmente son rutas
   * nuestras perfectamente válidas. Decirlo aquí evita leer la capa de forma
   * como si atajara más de lo que ataja.
   */
  it("estructuralmente sí son rutas nuestras — los rechaza la lista blanca, no la forma", () => {
    for (const r of ["/entrar", "/", "/landing", "/api/cliente/servicios"]) {
      expect(rutaRelativaSegura(r)).toBe(r);
      expect(destinoDeVuelta(r)).toBeNull();
    }
  });

  it("sin barra inicial no es una ruta propia, y muere en la capa de forma", () => {
    expect(rutaRelativaSegura("cliente")).toBeNull();
    expect(destinoDeVuelta("cliente")).toBeNull();
  });

  /*
   * El espacio de atrás lo borra el parser en silencio, así que sin el recorte
   * esto devolvería "/cliente" —una cadena que nadie mandó—. Es el único caso
   * que distingue esa comprobación de las demás: con espacio adelante manda
   * antes la barra inicial, y con `"  //evil.com"` manda el origen.
   */
  it("un espacio de sobra no se corrige solo, se rechaza", () => {
    expect(rutaRelativaSegura("/cliente ")).toBeNull();
    expect(destinoDeVuelta("/cliente ")).toBeNull();
  });
});

describe("lo que ni siquiera es una cadena utilizable", () => {
  it.each([
    ["", "vacío"],
    [" ", "un espacio"],
  ])("%s — %s", (entrada) => {
    expect(destinoDeVuelta(entrada)).toBeNull();
  });

  it("tipos que no son cadena", () => {
    // `searchParams` entrega `string | string[] | undefined`. El arreglo llega
    // cuando alguien manda ?volver= dos veces, que es justo lo que haría quien
    // esté probando cómo confundir esto.
    expect(destinoDeVuelta(undefined)).toBeNull();
    expect(destinoDeVuelta(null)).toBeNull();
    expect(destinoDeVuelta(["/cliente", "//evil.com"])).toBeNull();
    expect(destinoDeVuelta(42)).toBeNull();
    expect(destinoDeVuelta({ toString: () => "/cliente" })).toBeNull();
  });

  it("más largo que cualquier enlace real", () => {
    expect(destinoDeVuelta("/cliente/" + "a".repeat(600))).toBeNull();
  });
});

/**
 * La propiedad, dicha una sola vez y comprobada sobre todo lo que pasa.
 *
 * Las pruebas de arriba enumeran casos; ésta fija la regla. Si alguien agrega
 * una cara a la lista blanca y de paso rompe la forma, esto se cae aunque el
 * caso nuevo no esté enumerado.
 */
describe("la propiedad, sobre todo lo que sale de aquí", () => {
  it("todo lo que no es null es una ruta relativa de una sola barra", () => {
    const candidatos = [
      "/cliente",
      "/cliente/servicio/abc",
      "/cliente?account=tecma",
      "/carrier/flota/u-1",
      "/jstaff",
      "/quien-soy",
      "/cliente/planta/x/../y",
      "/cliente/servicio/abc#e",
      "//evil.com",
      "/..//evil.com",
      "https://evil.com",
      "javascript:alert(1)",
      "/entrar",
      "/",
    ];

    const salidas = candidatos.map(destinoDeVuelta).filter((d): d is string => d !== null);

    // Que no se haya quedado vacío es parte de la prueba: cero salidas pasarían
    // en verde sin haber comprobado ninguna.
    expect(salidas.length).toBeGreaterThan(0);

    for (const d of salidas) {
      expect(d.startsWith("/")).toBe(true);
      expect(d.startsWith("//")).toBe(false);
      expect(d.includes("\\")).toBe(false);
      // Y lo definitivo: resuelto contra CUALQUIER origen, se queda en él.
      expect(new URL(d, "https://j-telemetry.com").origin).toBe("https://j-telemetry.com");
      expect(new URL(d, "https://otro.example").origin).toBe("https://otro.example");
    }
  });
});
