"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { conCuenta, estaEnLugar, type Grupo } from "@/lib/casa/casas";

/**
 * Las pestañas — la navegación del cascarón.
 *
 * **Arriba, no al costado.** `docs/Ficha-Navegacion-Completa.md` §G lo prohíbe
 * expresamente: «la navegación es por pestañas arriba y ligas dentro del
 * contenido». El mapa de la casa no se pronuncia sobre arriba o al costado, así
 * que esa ficha es la única que manda ahí, y ASAV la ratificó el 15 de
 * septiembre de 2026. La razón práctica: la puerta del transportista es un
 * mapa, y un menú al costado le come el ancho.
 *
 * **Dos niveles, y ni uno más.** Primer nivel arriba; el segundo cuelga de la
 * pestaña activa y sólo aparece si esa pestaña tiene hijos. El mapa dice que
 * una casa que necesita un tercer nivel está mal partida.
 *
 * **El sello va encima de su sección**, chico y tenue: «Compás» sobre la flota,
 * «Vernier» sobre cumplimiento. Es la opción B ratificada — el menú lista
 * nombres de cosa y la marca se graba por repetición del sello, sin estorbar el
 * camino de todos.
 *
 * **Las ligas arrastran la cuenta.** Si se entró con `?account=`, cada pestaña
 * la lleva; sin ella, quien había elegido Juárez Bus caía en «no hay cuenta» al
 * tocar Expedientes (16 sep 2026). «Estoy aquí» se sigue midiendo contra la
 * ruta pelona: la cuenta no cambia de lugar.
 *
 * Lo que llega aquí ya viene filtrado por `menuDe`: lo que no aplica a la
 * cuenta y lo que todavía no tiene cuarto no llegan a este componente. Este
 * archivo no vuelve a decidir qué se ve — si lo hiciera, habría dos listas.
 */
export function Pestanas({ grupos, cuenta, lugar }: { grupos: Grupo[]; cuenta: string | null; lugar?: string }) {
  // `lugar` gana a la ruta cuando la ficha tiene dos puertas: ver `Marco`.
  const enRuta = usePathname();
  const ruta = lugar ?? enRuta;
  const liga = (href: string) => conCuenta(href, cuenta);

  // Un lugar está activo si la ruta es la suya o cuelga de ella; así el padre
  // sigue marcado mientras se navega su segundo nivel. La regla vive en
  // `casas.ts` y se comparte con el sello de la sección: dos copias de «estoy
  // aquí» se separan en cuanto alguien toque una.
  const estaEn = (href: string) => estaEnLugar(ruta, href);

  const lugares = grupos.flatMap((grupo) => grupo.lugares);
  const activo = lugares.find((lugar) => lugar.ruta !== null && estaEn(lugar.ruta));
  const hijos = activo?.hijos ?? [];

  return (
    <>
      {/* — Computadora: las pestañas arriba, con su sello encima — */}
      <nav
        aria-label="Lugares de esta casa"
        className="hidden border-b border-[var(--linea)] px-6 md:block"
      >
        {/* Entre grupos, 64 px más el relleno de las pestañas: casi cuatro veces
            el espacio entre dos pestañas del mismo grupo. Un sello cubre sólo
            sus pestañas, y una pestaña sin sello no puede leerse como parte
            del grupo de arriba (skill, «Los grupos del menú», 19 sep 2026). */}
        <div className="flex flex-wrap items-end gap-x-16 gap-y-2">
          {grupos.map((grupo, i) => (
            <div key={grupo.sello ?? `grupo-${i}`} className="flex flex-col">
              {/* Un sello sin sección debajo anunciaría algo que no está, así que
                  `menuDe` ya tiró los grupos vacíos antes de llegar aquí. */}
              <span
                data-medida
                aria-hidden={grupo.sello === null}
                className="px-1 pt-2 text-[10px] uppercase tracking-[0.16em] text-[var(--tenue)]"
              >
                {grupo.sello ?? "\u00a0"}
              </span>
              <div className="flex items-end">
                {grupo.lugares.map((lugar) => (
                  <Link
                    key={lugar.ruta}
                    href={liga(lugar.ruta as string)}
                    aria-current={estaEn(lugar.ruta as string) ? "page" : undefined}
                    className={`-mb-px cursor-pointer border-b-2 px-3 py-2.5 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--tinta)] ${
                      estaEn(lugar.ruta as string)
                        ? "border-[var(--senal)] text-[var(--tinta)]"
                        : "border-transparent text-[var(--tenue)] hover:text-[var(--tinta)]"
                    }`}
                  >
                    {lugar.nombre}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* — El segundo nivel: cuelga de la pestaña activa, y sólo si la tiene — */}
      {hijos.length > 0 && (
        <nav
          aria-label={`Dentro de ${activo?.nombre}`}
          className="hidden gap-1 border-b border-[var(--linea)] bg-[var(--roce)] px-6 py-2 md:flex"
        >
          {hijos.map((hijo) => (
            <Link
              key={hijo.ruta}
              href={liga(hijo.ruta as string)}
              aria-current={estaEn(hijo.ruta as string) ? "page" : undefined}
              className={`cursor-pointer rounded px-2.5 py-1 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--tinta)] ${
                estaEn(hijo.ruta as string)
                  ? "text-[var(--tinta)]"
                  : "text-[var(--tenue)] hover:text-[var(--tinta)]"
              }`}
            >
              {hijo.nombre}
            </Link>
          ))}
        </nav>
      )}

      {/* — Celular: la misma casa colapsada a cuatro pestañas abajo — */}
      <BarraDeAbajo grupos={grupos} estaEn={estaEn} liga={liga} />
    </>
  );
}

/**
 * En celular la casa se colapsa a **cuatro pestañas abajo como máximo** — lo
 * dice el mapa, regla 3.
 *
 * Cuando hay más de cuatro lugares, las tres primeras se quedan y la cuarta es
 * «Más», que despliega el resto ahí mismo. Nada se esconde sin decirlo: un
 * lugar que existe pero no cabe sigue estando a un toque, con su nombre
 * completo — **y con su sello encima**, que es lo único que en el teléfono
 * enseña dos secciones juntas.
 *
 * ⚠ Este reparto **no lo ratificó nadie**: hoy ninguna casa tiene un solo
 * cuarto, así que no hay forma de verlo con lugares de verdad. El día que una
 * casa pase de cuatro en celular, se mira y se decide; el mapa dice cuántas
 * caben, no cuál se queda fuera.
 */
function BarraDeAbajo({
  grupos,
  estaEn,
  liga,
}: {
  grupos: Grupo[];
  estaEn: (href: string) => boolean;
  liga: (href: string) => string;
}) {
  const [abierto, setAbierto] = useState(false);

  const lugares = grupos.flatMap((grupo) => grupo.lugares);
  if (lugares.length === 0) return null;

  const caben = lugares.length <= 4 ? lugares : lugares.slice(0, 3);
  const sobran = lugares.length <= 4 ? [] : lugares.slice(3);

  /* Los que no cupieron, devueltos a su grupo: en la lista desplegada sí hay
     sitio para el sello, y es el único lugar del teléfono donde se ven dos
     secciones al mismo tiempo. Un grupo que no aportó ninguno desaparece, como
     en las pestañas de computadora. */
  const gruposDelResto = grupos
    .map((grupo) => ({
      sello: grupo.sello,
      lugares: grupo.lugares.filter((lugar) => sobran.includes(lugar)),
    }))
    .filter((grupo) => grupo.lugares.length > 0);

  return (
    <>
      {abierto && sobran.length > 0 && (
        <div className="fixed inset-x-0 bottom-[52px] z-20 max-h-[60dvh] overflow-y-auto border-t border-[var(--linea)] bg-[var(--pieza)] md:hidden">
          {gruposDelResto.map((grupo, i) => (
            // Un grupo sin sello después de otro abre con un corte: sin él, sus
            // lugares se leerían bajo el sello de arriba.
            <div key={grupo.sello ?? `grupo-${i}`} className={grupo.sello === null && i > 0 ? "mt-3 border-t border-[var(--linea)]" : undefined}>
              {grupo.sello !== null && (
                <p
                  data-medida
                  className="border-b border-[var(--linea)] px-5 pb-1.5 pt-3 text-[10px] uppercase tracking-[0.16em] text-[var(--tenue)]"
                >
                  {grupo.sello}
                </p>
              )}
              {grupo.lugares.map((lugar) => (
                <Link
                  key={lugar.ruta}
                  href={liga(lugar.ruta as string)}
                  onClick={() => setAbierto(false)}
                  aria-current={estaEn(lugar.ruta as string) ? "page" : undefined}
                  className="block cursor-pointer border-b border-[var(--linea)] px-5 py-3 text-[15px] hover:bg-[var(--roce)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--tinta)]"
                >
                  {lugar.nombre}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* El nombre no se repite el de arriba a propósito: las dos barras están
          en el DOM al mismo tiempo —una se esconde por CSS según el ancho— y
          dos navegaciones con el mismo nombre se anuncian igual a quien usa
          lector de pantalla, sin forma de distinguirlas. */}
      <nav
        aria-label="Lugares de esta casa, en celular"
        className="fixed inset-x-0 bottom-0 z-20 flex h-[52px] items-stretch border-t border-[var(--linea)] bg-[var(--pieza)] md:hidden"
      >
        {caben.map((lugar) => (
          <Link
            key={lugar.ruta}
            href={liga(lugar.ruta as string)}
            onClick={() => setAbierto(false)}
            aria-current={estaEn(lugar.ruta as string) ? "page" : undefined}
            /* El lugar activo se marca con la palabra en tinta **y** con una
               barra de cobre arriba, nunca pintando la palabra de cobre: el
               color no carga significado solo, y una etiqueta de 12 px es donde
               peor aguanta que lo intente. */
            className={`relative flex flex-1 items-center justify-center px-1 text-center text-[12px] leading-tight ${
              estaEn(lugar.ruta as string)
                ? "text-[var(--tinta)] before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:bg-[var(--senal)] before:content-['']"
                : "text-[var(--tenue)]"
            }`}
          >
            {lugar.nombre}
          </Link>
        ))}

        {sobran.length > 0 && (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="flex flex-1 cursor-pointer items-center justify-center px-1 text-[12px] text-[var(--tenue)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--tinta)]"
          >
            Más
          </button>
        )}
      </nav>
    </>
  );
}
