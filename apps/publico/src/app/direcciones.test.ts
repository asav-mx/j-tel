import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import manifest from "./manifest";

/*
 * Las direcciones de Ontoy no se mueven — `docs/Ontoy-Direcciones.md`.
 *
 * La regla, decidida por ASAV el 23-sep-2026: **ninguna dirección que un pasajero
 * guarde, instale o escanee cambia después.** Las tres cosas que un pasajero hace
 * con una dirección la sacan del repo y la dejan fuera de nuestro alcance:
 *
 *  - la guarda (un marcador, un WhatsApp reenviado veinte veces),
 *  - la instala (el `start_url` **se graba al instalar**: cambiarlo no mueve el
 *    ícono que ya está en la pantalla de inicio de nadie),
 *  - la escanea (una lámina atornillada a un poste; despegarla toma días y un
 *    humano en una escalera).
 *
 * ## Por qué una prueba y no sólo el documento
 *
 * **Mover una carpeta del router compila igual de bien.** Un PR de reorganización
 * que cambia dónde vive una página no pone un solo rojo en CI, y le rompe el ícono
 * a todos los que ya la instalaron.
 *
 * ## Y por qué mide la URL y no el archivo
 *
 * Porque no son lo mismo, y confundirlos daría una valla que miente en las dos
 * direcciones: un grupo de ruta —`app/(algo)/page.tsx`— **no cambia la URL**, así
 * que exigir el archivo se caería con un cambio que no rompe nada; y al revés,
 * hay formas de mover la URL que dejan el archivo donde estaba. Así que esto
 * deriva la URL de cada `page.tsx` como lo hace Next —tirando los grupos de ruta
 * y las ranuras paralelas— y compara direcciones contra direcciones.
 */

const APP = path.dirname(fileURLToPath(import.meta.url));

/** Cada `page.tsx` bajo `app/`, como la ruta relativa de su carpeta. */
function carpetasConPagina(dir: string, base = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return carpetasConPagina(path.join(dir, e.name), path.posix.join(base, e.name));
    return e.name === "page.tsx" || e.name === "page.jsx" ? [base] : [];
  });
}

/**
 * La URL que Next sirve para una carpeta del router.
 *
 * Los grupos de ruta —`(marketing)`— y las ranuras paralelas —`@modal`— organizan
 * archivos y **no aparecen en la dirección**. Todo lo demás sí, incluidos los
 * segmentos dinámicos: `c/[slug]` sirve `/c/‹algo›`.
 */
export function direccionDeLaCarpeta(carpeta: string): string {
  const segmentos = carpeta
    .split("/")
    .filter(Boolean)
    .filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"));
  return "/" + segmentos.join("/");
}

/** Las direcciones que ya existen y que un pasajero puede tener guardada. */
const RESERVADAS = [
  { direccion: "/rutas", que: "la app: Inicio, y el `start_url` del manifiesto" },
  { direccion: "/", que: "la landing" },
  { direccion: "/c/[slug]", que: "una ruta, para compartir por mensaje" },
  { direccion: "/validador", que: "el lector del camión" },
  { direccion: "/privacidad", que: "qué se guarda y qué no" },
];

const SERVIDAS = carpetasConPagina(APP).map(direccionDeLaCarpeta);

describe("la derivación de la dirección", () => {
  it.each([
    ["", "/"],
    ["validador", "/validador"],
    ["c/[slug]", "/c/[slug]"],
    ["(marketing)", "/"],
    ["(marketing)/conoce", "/conoce"],
    ["@modal/aviso", "/aviso"],
  ])("«%s» sirve «%s»", (carpeta, esperada) => {
    expect(direccionDeLaCarpeta(carpeta)).toBe(esperada);
  });
});

describe("las direcciones de Ontoy no se mueven", () => {
  it.each(RESERVADAS)("$direccion sigue sirviendo $que", ({ direccion }) => {
    expect(SERVIDAS).toContain(direccion);
  });

  it("el `start_url` es `/rutas`: es la dirección que el ícono instalado graba", () => {
    /*
     * **ASAV cambió de decisión el 25-sep-2026** y la raíz es de la landing: la
     * gente escribe «ontoy.app» y nada más.
     *
     * Lo que hace que eso NO rompa un ícono instalado es el orden: el
     * `start_url` se mueve **ahora**, mientras casi nadie la tiene instalada, y
     * no el día que la landing entre. Un `start_url` que cambia después no mueve
     * el ícono de nadie — el teléfono ya lo grabó.
     *
     * El argumento que traía esta prueba antes —«la app se queda en la raíz
     * porque el ícono instalado apunta a `/`»— era cierto y se resolvió por
     * fecha, no por dirección.
     */
    expect(manifest().start_url).toBe("/rutas");
    expect(SERVIDAS).toContain("/rutas");
  });

  it("la app vive en `/rutas`, y la landing no se la llevó al tomar la raíz", () => {
    /*
     * **Ésta es la prueba que la mudanza de la raíz vino a hacer posible**, y
     * la que antes decía otra cosa.
     *
     * Hasta que la landing entró, aquí se exigía que `page.tsx` fuera un
     * reenvío a `./rutas/page`. Ese reenvío existía **para este día**: si la
     * app hubiera vivido en `app/page.tsx` y `/rutas` hubiera reenviado, la
     * landing al tomar la raíz **se habría llevado `/rutas` con ella** y el
     * ícono instalado de todos abriría una portada en vez de su camión.
     *
     * Así que lo que se midió antes fue la preparación, y lo que se mide ahora
     * es el resultado: la app **sigue** en `rutas/page.tsx`, con su consulta y
     * todo, y la raíz **ya no es** la app.
     */
    const app = readFileSync(path.join(APP, "rutas/page.tsx"), "utf8");
    expect(app, "la app de verdad tiene que estar en rutas/page.tsx").toContain(
      "listPublishedCircuits",
    );

    /*
     * Y la raíz no puede volver a ser la app por accidente. Lo que la volvería
     * la app es **servir la app**: reexportar su página, como hacía el reenvío,
     * o montar su componente.
     *
     * ⚠ **Lo que NO se mide aquí es que la raíz consulte circuitos**, y la
     * distinción costó pensarla. La landing sí los consulta y debe hacerlo: el
     * número y el color de una ruta **salen del dato, nunca del código**, así
     * que la portada lee los publicados para su ejemplo igual que los lee la
     * app. Prohibir la consulta habría medido el parecido en vez de la
     * identidad, y se habría caído en el primer PR que trajera una sección con
     * una ruta dentro — obligando a aflojar la valla, que es como las vallas
     * dejan de servir.
     */
    const raiz = readFileSync(path.join(APP, "page.tsx"), "utf8");
    expect(raiz, "la raíz ya no reenvía a la app: es la landing").not.toMatch(
      /from\s+"\.\/rutas\/page"/,
    );
    expect(raiz, "la raíz no monta la app: es la landing").not.toMatch(
      /<Ontoy[\s/>]/,
    );
  });
});
